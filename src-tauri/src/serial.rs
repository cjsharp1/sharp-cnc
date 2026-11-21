//! USB serial transport for GRBL (Demon Shield / Arduino).
//!
//! Commands are invoked from the React shell; inbound lines are pushed as
//! Tauri events (`serial-rx`). Soft reset is a real-time `0x18` byte.

use serde::Serialize;
use serialport::{DataBits, FlowControl, Parity, StopBits};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const RX_EVENT: &str = "serial-rx";
const ERR_EVENT: &str = "serial-error";
const READ_TIMEOUT_MS: u64 = 50;
const READ_BUF: usize = 512;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub path: String,
    pub port_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialLinePayload {
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialErrorPayload {
    pub message: String,
}

pub struct SerialState {
    stop: AtomicBool,
    /// Writer half kept for TX / soft reset. Reader runs on a clone in a thread.
    writer: Mutex<Option<Box<dyn serialport::SerialPort>>>,
}

impl SerialState {
    pub fn new() -> Self {
        Self {
            stop: AtomicBool::new(true),
            writer: Mutex::new(None),
        }
    }

    fn clear_writer(&self) {
        if let Ok(mut guard) = self.writer.lock() {
            *guard = None;
        }
    }
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| PortInfo {
            path: p.port_name,
            port_type: match p.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    let product = info.product.unwrap_or_else(|| "USB".into());
                    let mfr = info.manufacturer.unwrap_or_default();
                    if mfr.is_empty() {
                        format!("USB · {product}")
                    } else {
                        format!("USB · {mfr} {product}")
                    }
                }
                serialport::SerialPortType::BluetoothPort => "Bluetooth".into(),
                serialport::SerialPortType::PciPort => "PCI".into(),
                serialport::SerialPortType::Unknown => "Serial".into(),
            },
        })
        .collect())
}

fn close_port(state: &SerialState) {
    state.stop.store(true, Ordering::SeqCst);
    state.clear_writer();
    thread::sleep(Duration::from_millis(READ_TIMEOUT_MS + 20));
}

#[tauri::command]
pub fn serial_open(
    app: AppHandle,
    state: State<'_, Arc<SerialState>>,
    path: String,
    baud_rate: u32,
) -> Result<(), String> {
    // Close any existing session first.
    close_port(&state);

    let port = serialport::new(&path, baud_rate)
        .data_bits(DataBits::Eight)
        .parity(Parity::None)
        .stop_bits(StopBits::One)
        .flow_control(FlowControl::None)
        .timeout(Duration::from_millis(READ_TIMEOUT_MS))
        .open()
        .map_err(|e| format!("Failed to open {path}: {e}"))?;

    let mut reader = port
        .try_clone()
        .map_err(|e| format!("Failed to clone port for reader: {e}"))?;

    {
        let mut guard = state.writer.lock().map_err(|e| e.to_string())?;
        *guard = Some(port);
    }

    state.stop.store(false, Ordering::SeqCst);
    let reader_state: Arc<SerialState> = Arc::clone(&state);

    thread::spawn(move || {
        let mut buf = [0u8; READ_BUF];
        let mut pending = String::new();

        loop {
            if reader_state.stop.load(Ordering::SeqCst) {
                break;
            }

            match reader.read(&mut buf) {
                Ok(0) => continue,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]);
                    pending.push_str(&chunk);
                    drain_lines(&mut pending, |line| {
                        let _ = app.emit(RX_EVENT, SerialLinePayload { line });
                    });
                }
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(e) => {
                    let _ = app.emit(
                        ERR_EVENT,
                        SerialErrorPayload {
                            message: format!("Serial read error: {e}"),
                        },
                    );
                    reader_state.stop.store(true, Ordering::SeqCst);
                    reader_state.clear_writer();
                    break;
                }
            }
        }
    });

    Ok(())
}

fn drain_lines(pending: &mut String, mut emit: impl FnMut(String)) {
    loop {
        let Some(idx) = pending.find(['\n', '\r']) else {
            break;
        };
        let delim = pending.as_bytes()[idx];
        let mut line = pending[..idx].to_string();
        let mut next = idx + 1;
        if next < pending.len() {
            let twin = pending.as_bytes()[next];
            if (delim == b'\r' && twin == b'\n') || (delim == b'\n' && twin == b'\r') {
                next += 1;
            }
        }
        *pending = pending[next..].to_string();
        line = line.trim_end_matches(['\r', '\n']).to_string();
        if !line.is_empty() {
            emit(line);
        }
    }
}

#[tauri::command]
pub fn serial_close(state: State<'_, Arc<SerialState>>) -> Result<(), String> {
    close_port(&state);
    Ok(())
}

#[tauri::command]
pub fn serial_write(state: State<'_, Arc<SerialState>>, data: String) -> Result<(), String> {
    let mut guard = state.writer.lock().map_err(|e| e.to_string())?;
    let port = guard
        .as_mut()
        .ok_or_else(|| "Serial port is not open".to_string())?;
    port.write_all(data.as_bytes())
        .map_err(|e| format!("Serial write failed: {e}"))?;
    port.flush()
        .map_err(|e| format!("Serial flush failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn serial_write_bytes(
    state: State<'_, Arc<SerialState>>,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let mut guard = state.writer.lock().map_err(|e| e.to_string())?;
    let port = guard
        .as_mut()
        .ok_or_else(|| "Serial port is not open".to_string())?;
    port.write_all(&bytes)
        .map_err(|e| format!("Serial write failed: {e}"))?;
    port.flush()
        .map_err(|e| format!("Serial flush failed: {e}"))?;
    Ok(())
}

/// Soft reset (Ctrl-X / 0x18) — real-time GRBL command, not newline-terminated.
#[tauri::command]
pub fn serial_soft_reset(state: State<'_, Arc<SerialState>>) -> Result<(), String> {
    serial_write_bytes(state, vec![0x18])
}
