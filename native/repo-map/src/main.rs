// native/repo-map/src/main.rs
//
// Standalone CLI interface for CromaX codebase indexing.

use repo_map::RepoMap;
use std::env;
use std::path::Path;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: repo-map <root_directory> [token_budget] [active_file1,active_file2...]");
        std::process::exit(1);
    }

    let root_path = Path::new(&args[1]);
    let token_budget: usize = args
        .get(2)
        .and_then(|s| s.parse().ok())
        .unwrap_or(2048);

    let active_files: Vec<String> = args
        .get(3)
        .map(|s| s.split(',').map(|x| x.trim().to_string()).collect())
        .unwrap_or_default();

    let mapper = RepoMap::new();
    let result = mapper.build(root_path, token_budget, &active_files);

    if args.iter().any(|a| a == "--json") {
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
    } else {
        println!("{}", result.formatted_map);
    }
}
