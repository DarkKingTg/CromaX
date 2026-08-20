// native/repo-map/src/graph.rs
//
// Directed graph construction and personalized PageRank algorithm.
// Adapted from Aider's repomap (aider/repomap.py, MIT) and PageRank power-iteration.

use crate::tagger::{Tag, TagKind};
use std::collections::{HashMap, HashSet};

pub struct CodebaseGraph {
    pub files: Vec<String>,
    pub file_indices: HashMap<String, usize>,
    pub definitions: HashMap<String, Vec<(String, usize, Option<String>)>>, // name -> [(file, line, sig)]
    pub references: HashMap<String, Vec<(String, usize)>>,                  // file -> [(symbol, line)]
}

impl CodebaseGraph {
    pub fn build(tags: &[Tag]) -> Self {
        let mut file_set = HashSet::new();
        let mut definitions: HashMap<String, Vec<(String, usize, Option<String>)>> = HashMap::new();
        let mut references: HashMap<String, Vec<(String, usize)>> = HashMap::new();

        for tag in tags {
            file_set.insert(tag.rel_path.clone());
            match tag.kind {
                TagKind::Definition => {
                    definitions
                        .entry(tag.name.clone())
                        .or_default()
                        .push((tag.rel_path.clone(), tag.line, tag.signature.clone()));
                }
                TagKind::Reference => {
                    references
                        .entry(tag.rel_path.clone())
                        .or_default()
                        .push((tag.name.clone(), tag.line));
                }
            }
        }

        let mut files: Vec<String> = file_set.into_iter().collect();
        files.sort();

        let mut file_indices = HashMap::new();
        for (i, f) in files.iter().enumerate() {
            file_indices.insert(f.clone(), i);
        }

        Self {
            files,
            file_indices,
            definitions,
            references,
        }
    }

    /// Computes personalized PageRank scores for all files.
    /// `active_files` receive elevated teleportation weight.
    pub fn compute_pagerank(&self, active_files: &[String]) -> HashMap<String, f64> {
        let n = self.files.len();
        if n == 0 {
            return HashMap::new();
        }

        let d = 0.85; // Standard damping factor
        let max_iter = 100;
        let epsilon = 1e-6;

        // Build adjacency matrix (weighted directed edges)
        let mut adj: Vec<Vec<f64>> = vec![vec![0.0; n]; n];
        let mut out_weights: Vec<f64> = vec![0.0; n];

        for (src_file, refs) in &self.references {
            if let Some(&src_idx) = self.file_indices.get(src_file) {
                for (sym, _) in refs {
                    if let Some(defs) = self.definitions.get(sym) {
                        let num_defs = defs.len() as f64;
                        if num_defs > 0.0 {
                            let weight = 1.0 / num_defs;
                            for (target_file, _, _) in defs {
                                if target_file != src_file {
                                    if let Some(&target_idx) = self.file_indices.get(target_file) {
                                        adj[src_idx][target_idx] += weight;
                                        out_weights[src_idx] += weight;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Setup personalization vector
        let mut p = vec![1.0 / (n as f64); n];
        if !active_files.is_empty() {
            let active_indices: Vec<usize> = active_files
                .iter()
                .filter_map(|f| self.file_indices.get(f).copied())
                .collect();

            if !active_indices.is_empty() {
                let active_prob = 0.8;
                let rest_prob = 0.2;
                let active_share = active_prob / (active_indices.len() as f64);
                let rest_share = rest_prob / (n as f64);

                for val in p.iter_mut() {
                    *val = rest_share;
                }
                for &idx in &active_indices {
                    p[idx] += active_share;
                }
            }
        }

        // Power-iteration algorithm
        let mut ranks = p.clone();

        for _ in 0..max_iter {
            let mut next_ranks = vec![0.0; n];

            // Distribute dangling node mass
            let mut dangling_sum = 0.0;
            for i in 0..n {
                if out_weights[i] == 0.0 {
                    dangling_sum += ranks[i];
                }
            }

            for j in 0..n {
                let mut incoming = 0.0;
                for i in 0..n {
                    if out_weights[i] > 0.0 && adj[i][j] > 0.0 {
                        incoming += ranks[i] * (adj[i][j] / out_weights[i]);
                    }
                }

                next_ranks[j] = d * (incoming + dangling_sum * p[j]) + (1.0 - d) * p[j];
            }

            // Check convergence
            let mut diff = 0.0;
            for i in 0..n {
                diff += (next_ranks[i] - ranks[i]).abs();
            }

            ranks = next_ranks;

            if diff < epsilon {
                break;
            }
        }

        let mut result = HashMap::new();
        for (i, file) in self.files.iter().enumerate() {
            result.insert(file.clone(), ranks[i]);
        }
        result
    }
}
