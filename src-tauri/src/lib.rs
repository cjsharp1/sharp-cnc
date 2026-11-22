mod debug_bridge;
mod jobs_folder;
mod serial;

use debug_bridge::DebugBridgeState;
use serial::SerialState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let serial_state = Arc::new(SerialState::new());
    let debug_bridge_state = Arc::new(DebugBridgeState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Official in-app updater (signed NSIS/MSI via latest.json on GitHub Releases).
            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            let _ = app;
            Ok(())
        })
        .manage(serial_state)
        .manage(debug_bridge_state)
        .invoke_handler(tauri::generate_handler![
            serial::list_serial_ports,
            serial::serial_open,
            serial::serial_close,
            serial::serial_write,
            serial::serial_write_bytes,
            serial::serial_soft_reset,
            debug_bridge::debug_bridge_start,
            debug_bridge::debug_bridge_stop,
            debug_bridge::debug_bridge_set_snapshot,
            debug_bridge::debug_bridge_status,
            jobs_folder::pick_jobs_folder,
            jobs_folder::list_job_files,
            jobs_folder::read_job_file,
            jobs_folder::jobs_folder_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SharpCNC");
}
