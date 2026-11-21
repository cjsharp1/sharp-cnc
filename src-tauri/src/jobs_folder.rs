//! Local jobs folder: pick a directory, list job files, read text.
//! Used by the React shell for watched-folder job loading (SC-11).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const JOB_EXTENSIONS: &[&str] = &["nc", "gcode", "ngc", "tap", "svg"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFileEntry {
    pub name: String,
    pub path: String,
    /// `"gcode"` or `"svg"`.
    pub kind: String,
    pub modified_ms: Option<u64>,
}

fn extension_kind(name: &str) -> Option<&'static str> {
    let lower = name.to_ascii_lowercase();
    let ext = lower.rsplit_once('.')?.1;
    if ext == "svg" {
        Some("svg")
    } else if JOB_EXTENSIONS.contains(&ext) {
        Some("gcode")
    } else {
        None
    }
}

fn modified_ms(meta: &fs::Metadata) -> Option<u64> {
    let modified = meta.modified().ok()?;
    let dur = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(dur.as_millis() as u64)
}

fn canonical_or_abs(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).or_else(|_| {
        if path.is_absolute() {
            Ok(path.to_path_buf())
        } else {
            Err(format!("Path not found: {}", path.display()))
        }
    })
}

/// Ensure `file` resolves under `folder` (after canonicalize when possible).
fn ensure_under_folder(folder: &Path, file: &Path) -> Result<PathBuf, String> {
    let folder_c = canonical_or_abs(folder)?;
    let file_c = canonical_or_abs(file)?;
    if !file_c.starts_with(&folder_c) {
        return Err("File is outside the jobs folder".into());
    }
    if !file_c.is_file() {
        return Err(format!("Not a file: {}", file_c.display()));
    }
    Ok(file_c)
}

/// Native folder picker (desktop). Returns `None` if the user cancels.
#[tauri::command]
pub fn pick_jobs_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select SharpCNC jobs folder")
        .pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().into_owned()))
}

/// List `.nc` / `.gcode` / `.svg` (and related) files in a directory (non-recursive).
#[tauri::command]
pub fn list_job_files(folder: String) -> Result<Vec<JobFileEntry>, String> {
    let dir = PathBuf::from(&folder);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {folder}"));
    }

    let mut entries: Vec<JobFileEntry> = Vec::new();
    let read = fs::read_dir(&dir).map_err(|e| format!("Cannot read folder: {e}"))?;
    for item in read {
        let item = item.map_err(|e| format!("Cannot read entry: {e}"))?;
        let path = item.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let Some(kind) = extension_kind(&name) else {
            continue;
        };
        let meta = item.metadata().ok();
        entries.push(JobFileEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            kind: kind.to_string(),
            modified_ms: meta.as_ref().and_then(modified_ms),
        });
    }

    entries.sort_by(|a, b| {
        b.modified_ms
            .unwrap_or(0)
            .cmp(&a.modified_ms.unwrap_or(0))
            .then_with(|| a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()))
    });
    Ok(entries)
}

/// Read a job file as UTF-8 text. `folder` must be the configured jobs folder;
/// `file_path` must resolve under it.
#[tauri::command]
pub fn read_job_file(folder: String, file_path: String) -> Result<String, String> {
    let folder_path = PathBuf::from(&folder);
    let file = PathBuf::from(&file_path);
    let resolved = ensure_under_folder(&folder_path, &file)?;
    let name = resolved
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    if extension_kind(name).is_none() {
        return Err(format!("Unsupported job file type: {name}"));
    }
    let bytes = fs::read(&resolved).map_err(|e| format!("Cannot read file: {e}"))?;
    // Accept UTF-8; fall back to lossy for Windows-encoded G-code.
    match String::from_utf8(bytes) {
        Ok(s) => Ok(s),
        Err(err) => Ok(String::from_utf8_lossy(err.as_bytes()).into_owned()),
    }
}

/// Cheap existence check used by the UI after restoring a persisted path.
#[tauri::command]
pub fn jobs_folder_exists(folder: String) -> Result<bool, String> {
    Ok(PathBuf::from(folder).is_dir())
}

/// Used by unit-style smoke from Rust tests if needed; keep helpers pure.
#[allow(dead_code)]
pub fn is_job_extension(name: &str) -> bool {
    extension_kind(name).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_extensions() {
        assert_eq!(extension_kind("part.nc"), Some("gcode"));
        assert_eq!(extension_kind("PART.GCODE"), Some("gcode"));
        assert_eq!(extension_kind("logo.SVG"), Some("svg"));
        assert_eq!(extension_kind("notes.txt"), None);
    }

}
