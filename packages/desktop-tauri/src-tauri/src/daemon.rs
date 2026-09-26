use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;

pub struct DaemonState {
    pub process: Mutex<Option<Child>>,
}

fn find_repo_root() -> Option<PathBuf> {
    let mut current = env::current_exe().ok()?;
    // Ascend up to 8 levels looking for package.json or node_modules
    for _ in 0..8 {
        if !current.pop() {
            break;
        }
        if current.join("package.json").exists() && current.join("packages").join("server").exists() {
            return Some(current);
        }
    }
    // Also check current working directory
    if let Ok(cwd) = env::current_dir() {
        if cwd.join("package.json").exists() && cwd.join("packages").join("server").exists() {
            return Some(cwd);
        }
    }
    None
}

pub fn start_daemon() -> Option<Child> {
    let root = find_repo_root().unwrap_or_else(|| PathBuf::from("."));
    let entrypoint = root.join("packages").join("server").join("dist").join("scripts").join("supervisor-entrypoint.js");

    let script_path = if entrypoint.exists() {
        entrypoint
    } else {
        root.join("packages").join("server").join("dist").join("src").join("server").join("server").join("exports.js")
    };

    println!("[tauri-daemon] Spawning node daemon from: {:?}", script_path);

    Command::new("node")
        .arg(&script_path)
        .env("PASEO_LISTEN", "127.0.0.1:6768")
        .current_dir(&root)
        .spawn()
        .ok()
}

pub fn stop_daemon(state: &DaemonState) {
    if let Ok(mut lock) = state.process.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
}
