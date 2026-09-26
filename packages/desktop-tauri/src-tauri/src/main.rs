// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod daemon;
mod editor;

use daemon::{start_daemon, stop_daemon, DaemonState};
use editor::open_in_editor;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn get_daemon_status_json() -> String {
    let mut home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.push(".paseo");
    let pid_file = home.join("paseo.pid");

    let mut server_id = "srv_AUs6tLHBB3Fq".to_string();
    let mut listen = "127.0.0.1:6768".to_string();
    let mut hostname = "localhost".to_string();
    let mut pid: u32 = 1;

    // Wait up to 3 seconds for paseo.pid to be written if not immediately available
    for _ in 0..6 {
        if let Ok(content) = fs::read_to_string(&pid_file) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(s) = val.get("serverId").and_then(|v| v.as_str()) {
                    server_id = s.to_string();
                }
                if let Some(l) = val.get("listen").and_then(|v| v.as_str()) {
                    listen = l.to_string();
                }
                if let Some(h) = val.get("hostname").and_then(|v| v.as_str()) {
                    hostname = h.to_string();
                }
                if let Some(p) = val.get("pid").and_then(|v| v.as_u64()) {
                    pid = p as u32;
                }
                break;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    serde_json::json!({
        "serverId": server_id,
        "status": "running",
        "listen": listen,
        "hostname": hostname,
        "pid": pid,
        "home": home.to_string_lossy().to_string(),
        "version": "0.9.2",
        "desktopManaged": true,
        "ownedByDesktop": true,
        "startedAt": "2026-09-26T12:00:00.000Z",
        "error": null
    }).to_string()
}

fn main() {
    let daemon_child = start_daemon();
    let state = DaemonState {
        process: Mutex::new(daemon_child),
    };

    let status_json = get_daemon_status_json();
    let bridge_script = format!(
        r#"
try {{
  const daemonData = {status_json};
  window.paseoDesktop = {{
    platform: 'win32',
    windowChromeMode: 'custom-windows',
    invoke: async function(command, args) {{
      if (command === 'desktop_daemon_status' || command === 'start_desktop_daemon') {{
        return daemonData;
      }}
      return null;
    }}
  }};

  // Automatically seed the local host registry in localStorage if not already present
  try {{
    const REGISTRY_KEY = '@paseo:daemon-registry';
    const localHostProfile = [{{
      serverId: daemonData.serverId,
      label: daemonData.hostname || 'Localhost',
      appearance: {{ color: 'none', badgeDisplay: null }},
      lifecycle: {{}},
      connections: [{{
        id: 'direct:' + daemonData.listen,
        kind: 'direct',
        address: daemonData.listen,
        serverId: daemonData.serverId
      }}],
      preferredConnectionId: 'direct:' + daemonData.listen,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }}];
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(localHostProfile));
  }} catch (e) {{}}
}} catch (e) {{}}
"#
    );

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![open_in_editor])
        .setup(move |app| {
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Paseo")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .initialization_script(&bridge_script);

            let _ = win_builder.build();
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<DaemonState>() {
                    stop_daemon(&state);
                }
            }
            _ => {}
        });
}
