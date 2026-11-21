//! Localhost-only read-only HTTP debug bridge for Cursor agents.
//!
//! Binds `127.0.0.1` only. The frontend pushes a JSON snapshot; this module
//! serves it. Control endpoints return 501 (stub).

use serde::Serialize;
use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

pub const DEFAULT_PORT: u16 = 17832;

#[derive(Serialize, Clone)]
pub struct BridgeStatus {
    pub running: bool,
    pub port: u16,
    pub bind: String,
    pub readonly: bool,
}

pub struct DebugBridgeState {
    running: AtomicBool,
    port: AtomicU16,
    stop: AtomicBool,
    snapshot: Mutex<String>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl DebugBridgeState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            port: AtomicU16::new(DEFAULT_PORT),
            stop: AtomicBool::new(false),
            snapshot: Mutex::new(empty_snapshot_json()),
            worker: Mutex::new(None),
        }
    }

    pub fn status(&self) -> BridgeStatus {
        BridgeStatus {
            running: self.running.load(Ordering::SeqCst),
            port: self.port.load(Ordering::SeqCst),
            bind: "127.0.0.1".into(),
            readonly: true,
        }
    }

    pub fn set_snapshot(&self, snapshot_json: String) {
        if let Ok(mut guard) = self.snapshot.lock() {
            *guard = snapshot_json;
        }
    }

    pub fn start(self: &Arc<Self>, port: u16) -> Result<BridgeStatus, String> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(self.status());
        }

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let listener = TcpListener::bind(addr)
            .map_err(|e| format!("Failed to bind debug bridge on {addr}: {e}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {e}"))?;

        self.stop.store(false, Ordering::SeqCst);
        self.port.store(port, Ordering::SeqCst);
        self.running.store(true, Ordering::SeqCst);

        let state = Arc::clone(self);
        let handle = thread::spawn(move || serve_loop(listener, state));

        if let Ok(mut worker) = self.worker.lock() {
            *worker = Some(handle);
        }

        Ok(self.status())
    }

    pub fn stop(&self) -> BridgeStatus {
        self.stop.store(true, Ordering::SeqCst);
        // Nudge the accept loop by connecting once (best-effort).
        let port = self.port.load(Ordering::SeqCst);
        let _ = TcpStream::connect_timeout(
            &SocketAddr::from(([127, 0, 0, 1], port)),
            Duration::from_millis(50),
        );
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(handle) = worker.take() {
                let _ = handle.join();
            }
        }
        self.running.store(false, Ordering::SeqCst);
        self.status()
    }
}

fn empty_snapshot_json() -> String {
    r#"{"schemaVersion":1,"updatedAt":0,"updatedAtIso":null,"connection":{"phase":"disconnected","port":null,"shell":"tauri","connected":false},"machine":{"state":"Offline","mpos":{"x":0,"y":0,"z":0},"wpos":{"x":0,"y":0,"z":0},"alarm":null},"job":{"name":null,"phase":null,"progress":null},"softTravel":null,"logs":[],"control":{"enabled":false,"note":"No snapshot published yet."}}"#.into()
}

fn serve_loop(listener: TcpListener, state: Arc<DebugBridgeState>) {
    while !state.stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                let snapshot = state
                    .snapshot
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| empty_snapshot_json());
                let _ = handle_client(stream, &snapshot, state.port.load(Ordering::SeqCst));
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(25));
            }
            Err(_) => {
                thread::sleep(Duration::from_millis(50));
            }
        }
    }
    state.running.store(false, Ordering::SeqCst);
}

fn handle_client(mut stream: TcpStream, snapshot: &str, port: u16) -> std::io::Result<()> {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).unwrap_or(0);
    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_uppercase();
    let path_q = parts.next().unwrap_or("/");

    let (path, query) = match path_q.split_once('?') {
        Some((p, q)) => (p, q),
        None => (path_q, ""),
    };

    if method == "OPTIONS" {
        return write_response(
            &mut stream,
            204,
            "No Content",
            "text/plain; charset=utf-8",
            b"",
        );
    }

    if method != "GET" && method != "HEAD" && method != "POST" {
        return write_json(
            &mut stream,
            405,
            r#"{"error":"method_not_allowed","message":"Use GET for read-only endpoints."}"#,
        );
    }

    if method == "POST" && path.starts_with("/v1/control") {
        return write_json(
            &mut stream,
            501,
            r#"{"error":"not_implemented","message":"Control commands (jog / e-stop) are stubbed in this PR — bridge is read-only."}"#,
        );
    }

    match path {
        "/" | "/help" => {
            let body = format!(
                "SharpCNC debug bridge (read-only)\n\
                 Bind: 127.0.0.1:{port}\n\
                 \n\
                 GET /health\n\
                 GET /v1/status\n\
                 GET /v1/logs?limit=100\n\
                 GET /v1/snapshot\n\
                 GET /v1/export.json\n\
                 GET /v1/export.txt\n\
                 POST /v1/control/* → 501 (stub)\n"
            );
            write_response(
                &mut stream,
                200,
                "OK",
                "text/plain; charset=utf-8",
                body.as_bytes(),
            )
        }
        "/health" => write_json(
            &mut stream,
            200,
            &format!(
                r#"{{"ok":true,"bridge":"sharpnc","readonly":true,"port":{port}}}"#
            ),
        ),
        "/v1/snapshot" | "/v1/export.json" => write_json(&mut stream, 200, snapshot),
        "/v1/status" => {
            let body = extract_status_view(snapshot);
            write_json(&mut stream, 200, &body)
        }
        "/v1/logs" => {
            let limit = parse_limit(query, 100);
            let body = extract_logs_view(snapshot, limit);
            write_json(&mut stream, 200, &body)
        }
        "/v1/export.txt" => {
            let body = logs_as_text(snapshot);
            write_response(
                &mut stream,
                200,
                "OK",
                "text/plain; charset=utf-8",
                body.as_bytes(),
            )
        }
        _ => write_json(
            &mut stream,
            404,
            r#"{"error":"not_found","message":"See GET /help for endpoints."}"#,
        ),
    }
}

fn parse_limit(query: &str, default: usize) -> usize {
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == "limit" {
                if let Ok(n) = v.parse::<usize>() {
                    return n.clamp(1, 2000);
                }
            }
        }
    }
    default
}

fn extract_status_view(snapshot: &str) -> String {
    match serde_json::from_str::<serde_json::Value>(snapshot) {
        Ok(v) => {
            let mut out = serde_json::Map::new();
            out.insert(
                "schemaVersion".into(),
                v.get("schemaVersion").cloned().unwrap_or(serde_json::json!(1)),
            );
            out.insert(
                "updatedAt".into(),
                v.get("updatedAt").cloned().unwrap_or(serde_json::json!(0)),
            );
            out.insert(
                "updatedAtIso".into(),
                v.get("updatedAtIso").cloned().unwrap_or(serde_json::Value::Null),
            );
            out.insert(
                "connection".into(),
                v.get("connection").cloned().unwrap_or(serde_json::Value::Null),
            );
            out.insert(
                "machine".into(),
                v.get("machine").cloned().unwrap_or(serde_json::Value::Null),
            );
            out.insert(
                "job".into(),
                v.get("job").cloned().unwrap_or(serde_json::Value::Null),
            );
            out.insert(
                "softTravel".into(),
                v.get("softTravel").cloned().unwrap_or(serde_json::Value::Null),
            );
            out.insert(
                "control".into(),
                v.get("control").cloned().unwrap_or(serde_json::Value::Null),
            );
            serde_json::Value::Object(out).to_string()
        }
        Err(_) => snapshot.to_string(),
    }
}

fn extract_logs_view(snapshot: &str, limit: usize) -> String {
    match serde_json::from_str::<serde_json::Value>(snapshot) {
        Ok(v) => {
            let logs = v
                .get("logs")
                .and_then(|l| l.as_array())
                .cloned()
                .unwrap_or_default();
            let start = logs.len().saturating_sub(limit);
            let slice = &logs[start..];
            serde_json::json!({
                "count": slice.len(),
                "limit": limit,
                "updatedAt": v.get("updatedAt").cloned().unwrap_or(serde_json::json!(0)),
                "entries": slice,
            })
            .to_string()
        }
        Err(_) => r#"{"count":0,"entries":[]}"#.into(),
    }
}

fn logs_as_text(snapshot: &str) -> String {
    match serde_json::from_str::<serde_json::Value>(snapshot) {
        Ok(v) => {
            let Some(logs) = v.get("logs").and_then(|l| l.as_array()) else {
                return String::new();
            };
            let mut lines = Vec::with_capacity(logs.len());
            for entry in logs {
                let at = entry.get("at").and_then(|x| x.as_u64()).unwrap_or(0);
                let kind = entry
                    .get("kind")
                    .and_then(|x| x.as_str())
                    .unwrap_or("event");
                let category = entry
                    .get("category")
                    .and_then(|x| x.as_str())
                    .unwrap_or("event");
                let text = entry
                    .get("text")
                    .and_then(|x| x.as_str())
                    .unwrap_or("");
                let tag = match kind {
                    "tx" => "TX",
                    "rx" => "RX",
                    "alarm" => "ALARM",
                    _ => "EVT",
                };
                let iso = chrono_like(at);
                lines.push(format!("{iso}  {tag:<5}  [{category}]  {text}"));
            }
            lines.join("\n")
        }
        Err(_) => String::new(),
    }
}

fn chrono_like(at_ms: u64) -> String {
    // Local wall-clock formatting without chrono crate: use UTC HH:MM:SS.mmm
    // derived from epoch (agents care about ordering more than TZ).
    let total_ms = at_ms;
    let ms = total_ms % 1000;
    let total_s = total_ms / 1000;
    let s = total_s % 60;
    let total_m = total_s / 60;
    let m = total_m % 60;
    let total_h = total_m / 60;
    let h = total_h % 24;
    format!("{h:02}:{m:02}:{s:02}.{ms:03}Z")
}

fn write_json(stream: &mut TcpStream, code: u16, body: &str) -> std::io::Result<()> {
    let reason = match code {
        200 => "OK",
        204 => "No Content",
        404 => "Not Found",
        405 => "Method Not Allowed",
        501 => "Not Implemented",
        _ => "Error",
    };
    write_response(
        stream,
        code,
        reason,
        "application/json; charset=utf-8",
        body.as_bytes(),
    )
}

fn write_response(
    stream: &mut TcpStream,
    code: u16,
    reason: &str,
    content_type: &str,
    body: &[u8],
) -> std::io::Result<()> {
    let header = format!(
        "HTTP/1.1 {code} {reason}\r\n\
         Content-Type: {content_type}\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Cache-Control: no-store\r\n\
         Connection: close\r\n\
         \r\n",
        body.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()?;
    let _ = stream.shutdown(Shutdown::Both);
    Ok(())
}

#[tauri::command]
pub fn debug_bridge_start(
    state: tauri::State<'_, Arc<DebugBridgeState>>,
    port: Option<u16>,
) -> Result<BridgeStatus, String> {
    let p = port.unwrap_or(DEFAULT_PORT);
    state.start(p)
}

#[tauri::command]
pub fn debug_bridge_stop(
    state: tauri::State<'_, Arc<DebugBridgeState>>,
) -> Result<BridgeStatus, String> {
    Ok(state.stop())
}

#[tauri::command]
pub fn debug_bridge_set_snapshot(
    state: tauri::State<'_, Arc<DebugBridgeState>>,
    snapshot_json: String,
) -> Result<(), String> {
    state.set_snapshot(snapshot_json);
    Ok(())
}

#[tauri::command]
pub fn debug_bridge_status(
    state: tauri::State<'_, Arc<DebugBridgeState>>,
) -> Result<BridgeStatus, String> {
    Ok(state.status())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn localhost_health_and_status() {
        let state = Arc::new(DebugBridgeState::new());
        let port = 17839;
        state
            .start(port)
            .expect("start bridge");
        state.set_snapshot(
            r#"{"schemaVersion":1,"updatedAt":1,"connection":{"phase":"connected","port":"COM3","shell":"tauri","connected":true},"machine":{"state":"Idle","mpos":{"x":1.0,"y":2.0,"z":3.0},"wpos":{"x":0.0,"y":0.0,"z":0.0},"alarm":null},"job":{"name":null,"phase":null,"progress":null},"softTravel":{"maxX":1000.0,"maxY":1000.0,"maxZ":null},"logs":[{"id":1,"at":1,"kind":"event","category":"connect","text":"Connected COM3","chatter":false}],"control":{"enabled":false,"note":"stub"}}"#.into(),
        );

        let health = http_get(port, "/health");
        assert!(health.contains("\"ok\":true"), "{health}");

        let status = http_get(port, "/v1/status");
        assert!(status.contains("\"Idle\""), "{status}");
        assert!(status.contains("COM3"), "{status}");

        let logs = http_get(port, "/v1/logs?limit=10");
        assert!(logs.contains("Connected COM3"), "{logs}");

        let control = http_post(port, "/v1/control/estop");
        assert!(control.contains("not_implemented"), "{control}");

        let stopped = state.stop();
        assert!(!stopped.running);
    }

    fn http_get(port: u16, path: &str) -> String {
        let mut stream = TcpStream::connect(format!("127.0.0.1:{port}")).expect("connect");
        let req = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
        stream.write_all(req.as_bytes()).expect("write");
        let mut buf = String::new();
        stream.read_to_string(&mut buf).expect("read");
        buf
    }

    fn http_post(port: u16, path: &str) -> String {
        let mut stream = TcpStream::connect(format!("127.0.0.1:{port}")).expect("connect");
        let req = format!(
            "POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        stream.write_all(req.as_bytes()).expect("write");
        let mut buf = String::new();
        stream.read_to_string(&mut buf).expect("read");
        buf
    }
}
