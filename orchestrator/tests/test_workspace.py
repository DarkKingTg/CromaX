import pytest
from pathlib import Path
import tempfile
from src.core.workspace import LocalWorkspace


def test_local_workspace_io():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)

        ws.write_file("test.txt", "Hello CromaX")
        assert ws.file_exists("test.txt")
        assert ws.read_file("test.txt") == "Hello CromaX"
        assert "test.txt" in ws.list_dir()


def test_local_workspace_traversal_guard():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)

        with pytest.raises(ValueError, match="Path traversal detected"):
            ws.read_file("../../outside.txt")


def test_local_workspace_run_command():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)
        res = ws.run_command("echo CromaX_Test")

        assert res.exit_code == 0
        assert "CromaX_Test" in res.stdout
