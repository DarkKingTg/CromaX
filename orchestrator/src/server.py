# orchestrator/src/server.py
#
# High-performance async WebSocket & IPC Server bridging the Python Orchestrator
# to the Void TypeScript / Electron editor frontend.

import argparse
import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Set
import websockets
try:
    from websockets.asyncio.server import ServerConnection as WebSocketConn
except ImportError:
    from websockets.server import WebSocketServerProtocol as WebSocketConn  # type: ignore

from .core.events import AgentEvent, EventType
from .core.loop import AgentSession, AgentSessionConfig
from .core.workspace import LocalWorkspace
from .gateway.server import GatewayServer
from .llm.router import LLMRouter
from .memory.skills import SkillManager
from .memory.store import MemoryStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CromaXServer")


class OrchestratorServer:
    def __init__(
        self,
        workspace_root: str | Path = ".",
        host: str = "127.0.0.1",
        port: int = 4040,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.host = host
        self.port = port
        self.workspace = LocalWorkspace(self.workspace_root)
        self.memory_store = MemoryStore(self.workspace_root / ".cromax_memory.db")
        self.skill_manager = SkillManager(self.workspace_root / ".cromax" / "skills")
        self.gateway = GatewayServer()
        self.router = LLMRouter()
        self.active_sessions: Dict[str, AgentSession] = {}
        self.connected_clients: Set[WebSocketConn] = set()

    def get_or_create_session(
        self, session_id: str, test_command: Optional[str] = None
    ) -> AgentSession:
        if session_id not in self.active_sessions:
            config = AgentSessionConfig(
                session_id=session_id,
                test_command=test_command,
            )
            session = AgentSession(
                workspace=self.workspace,
                config=config,
                router=self.router,
                memory_store=self.memory_store,
                skill_manager=self.skill_manager,
            )
            self.active_sessions[session_id] = session
        return self.active_sessions[session_id]

    async def broadcast_event(self, event: AgentEvent) -> None:
        """Broadcasts an agent event to all connected editor clients."""
        if not self.connected_clients:
            return
        payload = json.dumps(
            {
                "type": "event",
                "event": {
                    "event_id": event.event_id,
                    "event_type": event.event_type.value,
                    "payload": event.payload,
                    "timestamp": event.timestamp.isoformat(),
                },
            }
        )
        await asyncio.gather(
            *[client.send(payload) for client in self.connected_clients],
            return_exceptions=True,
        )

    async def handle_client_message(self, message_str: str) -> str:
        """Processes an incoming JSON message from the editor client."""
        try:
            req = json.loads(message_str)
            action = req.get("action")
            session_id = req.get("session_id", "default_session")

            if action == "ping":
                return json.dumps({"status": "ok", "pong": True})

            elif action == "prompt":
                session = self.get_or_create_session(
                    session_id, test_command=req.get("test_command")
                )
                res = session.run_step(
                    user_prompt=req.get("prompt", ""),
                    active_files=req.get("active_files", []),
                    mock_response=req.get("mock_response"),
                )
                return json.dumps({"status": "ok", "result": res})

            elif action == "get_repo_map":
                session = self.get_or_create_session(session_id)
                repo_map = session.repomap_client.get_repo_map(
                    self.workspace_root,
                    token_budget=req.get("token_budget", 2048),
                    active_files=req.get("active_files", []),
                )
                return json.dumps({"status": "ok", "repo_map": repo_map})

            elif action == "list_skills":
                skills = self.skill_manager.load_all_skills()
                return json.dumps(
                    {
                        "status": "ok",
                        "skills": [
                            {
                                "name": s.name,
                                "description": s.description,
                                "tags": s.tags,
                            }
                            for s in skills
                        ],
                    }
                )

            elif action == "search_memory":
                records = self.memory_store.search_memories(req.get("query", ""))
                return json.dumps(
                    {
                        "status": "ok",
                        "memories": [
                            {"summary": r.summary, "tags": r.tags, "created_at": r.created_at}
                            for r in records
                        ],
                    }
                )

            return json.dumps({"status": "error", "message": f"Unknown action: {action}"})

        except Exception as e:
            logger.exception("Error processing client message")
            return json.dumps({"status": "error", "message": str(e)})

    async def _ws_handler(self, websocket: WebSocketConn) -> None:
        self.connected_clients.add(websocket)
        logger.info(f"Editor client connected: {websocket.remote_address}")
        try:
            async for message in websocket:
                response = await self.handle_client_message(str(message))
                await websocket.send(response)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_clients.discard(websocket)
            logger.info(f"Editor client disconnected: {websocket.remote_address}")

    async def start(self) -> None:
        logger.info(f"Starting CromaX Orchestrator WebSocket on ws://{self.host}:{self.port}")
        async with websockets.serve(self._ws_handler, self.host, self.port):
            await asyncio.Future()  # run forever


def main() -> None:
    parser = argparse.ArgumentParser(description="CromaX Orchestrator Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host address to bind")
    parser.add_argument("--port", type=int, default=4040, help="Port to listen on")
    parser.add_argument("--workspace", default=".", help="Target workspace root")
    args = parser.parse_args()

    server = OrchestratorServer(workspace_root=args.workspace, host=args.host, port=args.port)
    asyncio.run(server.start())


if __name__ == "__main__":
    main()
