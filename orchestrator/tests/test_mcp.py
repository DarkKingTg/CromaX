import tempfile
from src.core.workspace import LocalWorkspace
from src.mcp.catalog import MCPCatalog
from src.mcp.client import MCPClient


def test_mcp_catalog_and_client():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)
        catalog = MCPCatalog(ws)
        client = MCPClient(catalog)

        tools = client.list_available_tools()
        tool_names = [t["name"] for t in tools]
        assert "terminal_exec" in tool_names
        assert "read_file" in tool_names
        assert "write_file" in tool_names

        # Execute write_file via MCP
        write_res = client.execute_tool(
            "write_file", {"path": "hello.txt", "content": "from_mcp"}
        )
        assert write_res.get("success") is True
        assert ws.read_file("hello.txt") == "from_mcp"

        # Execute read_file via MCP
        read_res = client.execute_tool("read_file", {"path": "hello.txt"})
        assert read_res.get("content") == "from_mcp"
