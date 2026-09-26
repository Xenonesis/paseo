use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct DaemonState {
    pub process: Mutex<Option<Child>>,
}

fn resolve_server_script() -> Option<(PathBuf, PathBuf)> {
    // 1. Check if running in installed directory with bundled resources
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            // Check resources folder created by Tauri bundle
            let resource_entry = parent
                .join("resources")
                .join("packages")
                .join("server")
                .join("dist")
                .join("scripts")
                .join("supervisor-entrypoint.js");
            if resource_entry.exists() {
                return Some((parent.join("resources"), resource_entry));
            }

            // Direct relative entry in installed bundle
            let direct_entry = parent
                .join("dist")
                .join("scripts")
                .join("supervisor-entrypoint.js");
            if direct_entry.exists() {
                return Some((parent.to_path_buf(), direct_entry));
            }
        }
    }

    // 2. Check development workspace by walking up ancestors
    if let Ok(mut current) = env::current_exe() {
        for _ in 0..8 {
            if !current.pop() {
                break;
            }
            let entry = current
                .join("packages")
                .join("server")
                .join("dist")
                .join("scripts")
                .join("supervisor-entrypoint.js");
            if entry.exists() {
                return Some((current, entry));
            }
        }
    }

    // 3. Check current working directory
    if let Ok(cwd) = env::current_dir() {
        let entry = cwd
            .join("packages")
            .join("server")
            .join("dist")
            .join("scripts")
            .join("supervisor-entrypoint.js");
        if entry.exists() {
            return Some((cwd, entry));
        }
    }

    None
}

pub fn start_daemon() -> Option<Child> {
    let (work_dir, script_path) = resolve_server_script()?;

    let mut cmd = Command::new("node");
    cmd.arg(&script_path)
        .env("PASEO_LISTEN", "127.0.0.1:6768")
        .current_dir(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().ok()?;
    
    // Wait briefly for daemon to initialize port
    std::thread::sleep(Duration::from_millis(1500));
    
    Some(child)
}

pub fn stop_daemon(state: &DaemonState) {
    if let Ok(mut lock) = state.process.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
}
