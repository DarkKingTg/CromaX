# orchestrator/src/mcp/client.py
#
# Standard Model Context Protocol (MCP) client.
# Manages connections to local and remote MCP tool servers.

import json
from typing import Any, Dict, List, Optional
from .catalog import MCPCatalog


class MCPClient:
    def __init__(self, catalog: MCPCatalog) -> None:
        self.catalog = catalog

    def list_available_tools(self) -> List[Dict[str, Any]]:
        """Returns JSON-RPC formatted list of tools for LLM consumption."""
        return self.catalog.list_tools()

    def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Calls the specified MCP tool with arguments."""
        return self.catalog.call_tool(tool_name, arguments)
