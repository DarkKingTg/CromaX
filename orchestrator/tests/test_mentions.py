import tempfile
from src.context.mentions import ContextExpander
from src.core.workspace import LocalWorkspace


def test_context_expander_file_and_folder():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)
        ws.write_file("src/main.py", "print('hello world')")

        expander = ContextExpander(ws)
        expanded = expander.extract_and_expand("Please review @file:src/main.py and @folder:src")

        assert len(expanded) == 2
        assert expanded[0].mention_type == "file"
        assert "print('hello world')" in expanded[0].content
        assert expanded[1].mention_type == "folder"
        assert "main.py" in expanded[1].content
