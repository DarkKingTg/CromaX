import json
import pytest
from src.server import OrchestratorServer


@pytest.mark.asyncio
async def test_server_message_handling():
    server = OrchestratorServer(workspace_root=".")
    
    # Test Ping
    ping_res = await server.handle_client_message(json.dumps({"action": "ping"}))
    data = json.loads(ping_res)
    assert data["status"] == "ok"
    assert data["pong"] is True

    # Test List Skills
    skills_res = await server.handle_client_message(json.dumps({"action": "list_skills"}))
    skills_data = json.loads(skills_res)
    assert skills_data["status"] == "ok"
    assert isinstance(skills_data["skills"], list)

    # Test Unknown Action
    err_res = await server.handle_client_message(json.dumps({"action": "unknown_action_xyz"}))
    err_data = json.loads(err_res)
    assert err_data["status"] == "error"
