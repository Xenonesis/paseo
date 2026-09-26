use std::env;
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

fn resolve_runtime() -> Option<(PathBuf, PathBuf, PathBuf)> {
    // 1. Installed location (resources/server-dist)
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            let res_dir = parent.join("resources").join("server-dist");
            let res_node = res_dir.join("node.exe");
            let res_script = res_dir.join("dist").join("scripts").join("supervisor-entrypoint.js");
            if res_node.exists() && res_script.exists() {
                return Some((res_dir, res_node, res_script));
            }
        }
    }

    // 2. Local workspace fallback
    if let Ok(mut current) = env::current_exe() {
        for _ in 0..8 {
            if !current.pop() {
                break;
            }
            let server_dist = current.join("packages").join("server").join("dist").join("scripts").join("supervisor-entrypoint.js");
            if server_dist.exists() {
                return Some((current, PathBuf::from("node"), server_dist));
            }
        }
    }

    // 3. Current dir
    if let Ok(cwd) = env::current_dir() {
        let server_dist = cwd.join("packages").join("server").join("dist").join("scripts").join("supervisor-entrypoint.js");
        if server_dist.exists() {
            return Some((cwd, PathBuf::from("node"), server_dist));
        }
    }

    None
}

pub fn start_daemon() -> Option<Child> {
    let (work_dir, node_bin, script_path) = resolve_runtime()?;

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&script_path)
        .env("PASEO_LISTEN", "127.0.0.1:6768");

    // Inherit NODE_PATH from global/user node environment if running installed
    if let Ok(appdata) = env::var("APPDATA") {
        let global_npm = PathBuf::from(appdata).join("npm").join("node_modules");
        if global_npm.exists() {
            cmd.env("NODE_PATH", global_npm);
        }
    }

    cmd.current_dir(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().ok()?;
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
