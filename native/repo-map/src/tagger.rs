// native/repo-map/src/tagger.rs
//
// Multi-language symbol definition and reference extraction.
// Ported and adapted from Aider's repomap tag extraction (aider/repomap.py, MIT License).

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TagKind {
    Definition,
    Reference,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tag {
    pub rel_path: String,
    pub name: String,
    pub kind: TagKind,
    pub line: usize,
    pub signature: Option<String>,
}

pub struct SymbolTagger {
    ident_regex: Regex,
    py_def_regex: Regex,
    ts_def_regex: Regex,
    rs_def_regex: Regex,
}

impl Default for SymbolTagger {
    fn default() -> Self {
        Self::new()
    }
}

impl SymbolTagger {
    pub fn new() -> Self {
        Self {
            ident_regex: Regex::new(r"\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b").unwrap(),
            py_def_regex: Regex::new(
                r"^\s*(?:async\s+)?(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b",
            )
            .unwrap(),
            ts_def_regex: Regex::new(
                r"(?m)^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b",
            )
            .unwrap(),
            rs_def_regex: Regex::new(
                r"(?m)^\s*(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait|type|impl)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b",
            )
            .unwrap(),
        }
    }

    pub fn extract_tags(&self, root: &Path, file_path: &Path) -> Vec<Tag> {
        let rel_path = file_path
            .strip_prefix(root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .replace('\\', "/");

        let content = match fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let ext = file_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        let mut tags = Vec::new();
        let mut def_names = HashSet::new();

        for (line_idx, line) in content.lines().enumerate() {
            let line_num = line_idx + 1;
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
                continue;
            }

            let def_match = match ext.as_str() {
                "py" => self.py_def_regex.captures(line),
                "ts" | "tsx" | "js" | "jsx" => self.ts_def_regex.captures(line),
                "rs" => self.rs_def_regex.captures(line),
                _ => self.ts_def_regex.captures(line),
            };

            if let Some(caps) = def_match {
                if let Some(name_match) = caps.get(1) {
                    let name = name_match.as_str().to_string();
                    def_names.insert(name.clone());
                    tags.push(Tag {
                        rel_path: rel_path.clone(),
                        name,
                        kind: TagKind::Definition,
                        line: line_num,
                        signature: Some(trimmed.to_string()),
                    });
                }
            }
        }

        // Extract identifier references not covered in definitions on the same line
        for (line_idx, line) in content.lines().enumerate() {
            let line_num = line_idx + 1;
            let trimmed = line.trim();
            if trimmed.starts_with("//") || trimmed.starts_with('#') {
                continue;
            }

            for cap in self.ident_regex.find_iter(line) {
                let name = cap.as_str();
                // Exclude common language keywords
                if is_keyword(name) {
                    continue;
                }
                tags.push(Tag {
                    rel_path: rel_path.clone(),
                    name: name.to_string(),
                    kind: TagKind::Reference,
                    line: line_num,
                    signature: None,
                });
            }
        }

        tags
    }
}

fn is_keyword(ident: &str) -> bool {
    matches!(
        ident,
        "if" | "else"
            | "for"
            | "while"
            | "return"
            | "break"
            | "continue"
            | "match"
            | "switch"
            | "case"
            | "default"
            | "try"
            | "catch"
            | "finally"
            | "throw"
            | "import"
            | "from"
            | "export"
            | "as"
            | "class"
            | "struct"
            | "enum"
            | "trait"
            | "impl"
            | "interface"
            | "type"
            | "const"
            | "let"
            | "var"
            | "fn"
            | "def"
            | "function"
            | "async"
            | "await"
            | "pub"
            | "private"
            | "protected"
            | "public"
            | "static"
            | "self"
            | "this"
            | "super"
            | "true"
            | "false"
            | "null"
            | "none"
            | "nil"
            | "undefined"
    )
}
