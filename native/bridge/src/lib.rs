// native/bridge/src/lib.rs
//
// Bridge interface exposing repo-map and native indexing to external runtimes.

use repo_map::RepoMap;
use std::path::Path;

pub fn build_repo_context(
    root_path: &str,
    token_budget: usize,
    active_files: &[String],
) -> String {
    let mapper = RepoMap::new();
    let result = mapper.build(Path::new(root_path), token_budget, active_files);
    serde_json::to_string(&result).unwrap_or_default()
}
