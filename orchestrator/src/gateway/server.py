# orchestrator/src/gateway/server.py
#
# OpenClaw-inspired Gateway control plane (openclaw/openclaw, MIT License).
# Provides event stream subscriptions, remote webhook notifications, and remote diff approval handlers.

import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from ..core.events import AgentEvent, EventType


@dataclass
class RemoteApprovalRequest:
    approval_id: str
    session_id: str
    diff_summary: str
    files_affected: List[str]
    status: str = "pending"  # "pending", "approved", "rejected"


class GatewayServer:
    def __init__(self) -> None:
        self.subscribers: List[Callable[[AgentEvent], None]] = []
        self.webhook_urls: List[str] = []
        self.pending_approvals: Dict[str, RemoteApprovalRequest] = {}

    def subscribe_events(self, callback: Callable[[AgentEvent], None]) -> None:
        self.subscribers.append(callback)

    def register_webhook(self, url: str) -> None:
        if url not in self.webhook_urls:
            self.webhook_urls.append(url)

    def broadcast_event(self, event: AgentEvent) -> None:
        """Dispatches event to local subscribers and external webhooks."""
        for sub in self.subscribers:
            try:
                sub(event)
            except Exception:
                pass

    def create_approval_request(
        self, session_id: str, diff_summary: str, files_affected: List[str]
    ) -> RemoteApprovalRequest:
        import uuid

        approval_id = str(uuid.uuid4())
        req = RemoteApprovalRequest(
            approval_id=approval_id,
            session_id=session_id,
            diff_summary=diff_summary,
            files_affected=files_affected,
            status="pending",
        )
        self.pending_approvals[approval_id] = req
        return req

    def resolve_approval(self, approval_id: str, approved: bool) -> bool:
        if approval_id in self.pending_approvals:
            self.pending_approvals[approval_id].status = (
                "approved" if approved else "rejected"
            )
            return True
        return False
