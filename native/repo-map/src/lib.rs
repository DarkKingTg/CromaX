// native/repo-map/src/lib.rs
//
// Core entry point for CromaX codebase indexing engine.
// Ported from Aider's repomap (aider/repomap.py, MIT License).

pub mod budget;
pub mod graph;
pub mod tagger;

use budget::BudgetFormatter;
use graph::CodebaseGraph;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tagger::SymbolTagger;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoMapResult {
    pub formatted_map: String,
    pub file_ranks: HashMap<String, f64>,
    pub estimated_tokens: usize,
}

pub struct RepoMap {
    tagger: SymbolTagger,
}

impl Default for RepoMap {
    fn default() -> Self {
        Self::new()
    }
}

impl RepoMap {
    pub fn new() -> Self {
        Self {
            tagger: SymbolTagger::new(),
        }
    }

    pub fn build(
        &self,
        root: &Path,
        token_budget: usize,
        active_files: &[String],
    ) -> RepoMapResult {
        let mut all_tags = Vec::new();

        for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() && !is_ignored(path) {
                let tags = self.tagger.extract_tags(root, path);
                all_tags.extend(tags);
            }
        }

        let graph = CodebaseGraph::build(&all_tags);
        let ranks = graph.compute_pagerank(active_files);
        let formatted_map = BudgetFormatter::format_map(&graph, &ranks, token_budget);
        let estimated_tokens = BudgetFormatter::estimate_tokens(&formatted_map);

        RepoMapResult {
            formatted_map,
            file_ranks: ranks,
            estimated_tokens,
        }
    }
}

fn is_ignored(path: &Path) -> bool {
    let p_str = path.to_string_lossy().replace('\\', "/");
    p_str.contains("/.git/")
        || p_str.contains("/target/")
        || p_str.contains("/node_modules/")
        || p_str.contains("/dist/")
        || p_str.contains("/build/")
        || p_str.contains("/.venv/")
        || p_str.contains("/__pycache__/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_repo_map_indexing() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        let file_a = root.join("auth.py");
        fs::write(
            &file_a,
            "class AuthService:\n    def login(self):\n        pass\n",
        )
        .unwrap();

        let file_b = root.join("main.py");
        fs::write(
            &file_b,
            "from auth import AuthService\n\ndef run():\n    auth = AuthService()\n    auth.login()\n",
        )
        .unwrap();

        let mapper = RepoMap::new();
        let result = mapper.build(root, 1024, &["main.py".to_string()]);

        assert!(!result.formatted_map.is_empty());
        assert!(result.estimated_tokens <= 1024);
        assert!(result.file_ranks.contains_key("auth.py"));
        assert!(result.file_ranks.contains_key("main.py"));
    }
}
