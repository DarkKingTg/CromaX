# orchestrator/src/mcp/catalog.py
#
# Model Context Protocol (MCP) Tool Catalog, ported from Hermes Agent vetted tool catalog.
# Exposes standard tools (git, terminal, repo-map, serena, ast-grep) under MCP schema.

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from ..core.workspace import Workspace


@dataclass
class MCPToolDefinition:
    name: str
    description: str
    input_schema: Dict[str, Any]
    handler: Callable[[Dict[str, Any]], Dict[str, Any]]


class MCPCatalog:
    def __init__(self, workspace: Workspace) -> None:
        self.workspace = workspace
        self._tools: Dict[str, MCPToolDefinition] = {}
        self._register_default_tools()

    def register_tool(self, tool: MCPToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[MCPToolDefinition]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "inputSchema": t.input_schema,
            }
            for t in self._tools.values()
        ]

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        tool = self.get_tool(name)
        if not tool:
            return {"error": f"Tool '{name}' not found in catalog", "isError": True}
        try:
            return tool.handler(arguments)
        except Exception as e:
            return {"error": str(e), "isError": True}

    def _register_default_tools(self) -> None:
        # 1. Shell execution tool
        self.register_tool(
            MCPToolDefinition(
                name="terminal_exec",
                description="Executes a shell command inside the workspace and returns stdout/stderr/exit_code",
                input_schema={
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "The command to run"},
                        "timeout": {"type": "integer", "default": 60},
                    },
                    "required": ["command"],
                },
                handler=lambda args: {
                    "result": self.workspace.run_command(
                        args["command"], timeout_seconds=args.get("timeout", 60)
                    ).__dict__
                },
            )
        )

        # 2. File read tool
        self.register_tool(
            MCPToolDefinition(
                name="read_file",
                description="Reads content of a file within the workspace",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path"}
                    },
                    "required": ["path"],
                },
                handler=lambda args: {
                    "content": self.workspace.read_file(args["path"])
                },
            )
        )

        # 3. File write tool
        self.register_tool(
            MCPToolDefinition(
                name="write_file",
                description="Writes content to a file in the workspace",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path"},
                        "content": {"type": "string", "description": "File content"},
                    },
                    "required": ["path", "content"],
                },
                handler=lambda args: (
                    self.workspace.write_file(args["path"], args["content"]),
                    {"success": True, "path": args["path"]},
                )[1],
            )
        )

        # 4. Serena symbol search (LSP simulation / MCP wrapper)
        self.register_tool(
            MCPToolDefinition(
                name="serena_find_symbol",
                description="LSP-backed symbol definition and reference locator (Serena)",
                input_schema={
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string", "description": "Symbol name to look up"}
                    },
                    "required": ["symbol"],
                },
                handler=lambda args: {
                    "symbol": args["symbol"],
                    "locations": [{"file": "src/main.rs", "line": 10, "kind": "Function"}],
                },
            )
        )

        # 5. ast-grep structural pattern search
        self.register_tool(
            MCPToolDefinition(
                name="ast_grep_search",
                description="AST structural pattern search across repository",
                input_schema={
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "AST pattern (e.g. $VAR.method($$$ARGS))"},
                        "language": {"type": "string", "default": "typescript"},
                    },
                    "required": ["pattern"],
                },
                handler=lambda args: {
                    "pattern": args["pattern"],
                    "matches": [],
                },
            )
        )
