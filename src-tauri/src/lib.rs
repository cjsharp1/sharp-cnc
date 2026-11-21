mod debug_bridge;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running SharpCNC");
}
