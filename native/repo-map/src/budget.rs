// native/repo-map/src/budget.rs
//
// Binary-search and greedy token budgeting for compact context generation.
// Formats ranked definitions into a structured hierarchy within a token budget.

use crate::graph::CodebaseGraph;
use std::collections::HashMap;

pub struct BudgetFormatter;

impl BudgetFormatter {
    /// Rough estimation of tokens from string content (approx 3.7 chars per token)
    pub fn estimate_tokens(text: &str) -> usize {
        let chars = text.chars().count();
        ((chars as f64) / 3.7).ceil() as usize
    }

    /// Formats ranked files and their key definitions to fit within `token_budget`.
    pub fn format_map(
        graph: &CodebaseGraph,
        ranks: &HashMap<String, f64>,
        token_budget: usize,
    ) -> String {
        // Sort files by PageRank score descending
        let mut sorted_files = graph.files.clone();
        sorted_files.sort_by(|a, b| {
            let rank_a = ranks.get(a).copied().unwrap_or(0.0);
            let rank_b = ranks.get(b).copied().unwrap_or(0.0);
            rank_b
                .partial_cmp(&rank_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Group definitions by file
        let mut file_defs: HashMap<String, Vec<(usize, String, Option<String>)>> = HashMap::new();
        for (sym_name, defs) in &graph.definitions {
            for (file, line, sig) in defs {
                file_defs
                    .entry(file.clone())
                    .or_default()
                    .push((*line, sym_name.clone(), sig.clone()));
            }
        }

        for list in file_defs.values_mut() {
            list.sort_by_key(|(line, _, _)| *line);
        }

        let mut output = String::new();

        for file in sorted_files {
            let mut file_block = format!("{}:\n", file);

            if let Some(defs) = file_defs.get(&file) {
                for (line, sym, sig) in defs {
                    let entry = match sig {
                        Some(s) => format!("  │ line {}: {}\n", line, s),
                        None => format!("  │ line {}: {}\n", line, sym),
                    };
                    file_block.push_str(&entry);
                }
            }

            let candidate = if output.is_empty() {
                file_block.clone()
            } else {
                format!("{}\n{}", output, file_block)
            };

            if Self::estimate_tokens(&candidate) > token_budget {
                if output.is_empty() {
                    // Truncate first file block if it exceeds budget on its own
                    let max_chars = (token_budget as f64 * 3.7) as usize;
                    output = file_block.chars().take(max_chars).collect();
                }
                break;
            }

            output = candidate;
        }

        output
    }
}
