use std::fs;
use std::path::Path;

use sha2::{Digest, Sha256};
use tauri::ipc::{InvokeBody, Request};
use tauri::AppHandle;

use crate::paths::assets_dir;

const IMAGE_EXTENSIONS: [&str; 9] = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "heic"];
const MAX_BYTES: usize = 50 * 1024 * 1024;

fn normalize_ext(ext: &str) -> Result<String, String> {
    let ext = ext.trim_start_matches('.').to_ascii_lowercase();
    if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        Ok(if ext == "jpeg" { "jpg".into() } else { ext })
    } else {
        Err(format!("Dateityp .{ext} wird nicht unterstützt"))
    }
}

/// Speichert Bytes inhaltsadressiert (SHA-256) im Asset-Ordner. Gleiche Bilder liegen nur einmal vor.
fn store(app: &AppHandle, bytes: &[u8], ext: &str) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("Leere Datei".into());
    }
    if bytes.len() > MAX_BYTES {
        return Err("Bilder dürfen höchstens 50 MB groß sein".into());
    }
    let ext = normalize_ext(ext)?;
    let hash = Sha256::digest(bytes);
    let name = format!("{}.{ext}", &format!("{hash:x}")[..32]);
    let dir = assets_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let target = dir.join(&name);
    if !target.exists() {
        // Erst in eine temporäre Datei schreiben, dann atomar umbenennen: nie halbe Bilder.
        let tmp = dir.join(format!(".{name}.tmp"));
        fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    }
    Ok(name)
}

#[tauri::command]
pub fn asset_import_file(app: AppHandle, path: String) -> Result<String, String> {
    let path = Path::new(&path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Datei ohne Endung")?;
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    store(&app, &bytes, ext)
}

/// Rohdaten aus Zwischenablage oder Drag-and-drop. Die Endung kommt im Header `x-ext`.
#[tauri::command]
pub fn asset_import_bytes(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let ext = request
        .headers()
        .get("x-ext")
        .and_then(|v| v.to_str().ok())
        .ok_or("Header x-ext fehlt")?
        .to_string();
    match request.body() {
        InvokeBody::Raw(bytes) => store(&app, bytes, &ext),
        InvokeBody::Json(_) => Err("Erwartet Binärdaten".into()),
    }
}

/// Öffnet einen Link im Standardbrowser. Nur auf ausdrückliche Aktion des Nutzers.
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let allowed = ["https://", "http://", "mailto:"];
    if !allowed.iter().any(|p| url.starts_with(p)) {
        return Err("Nur http(s)- und mailto-Links können geöffnet werden".into());
    }
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::normalize_ext;

    #[test]
    fn accepts_images_only() {
        assert_eq!(normalize_ext("JPEG").unwrap(), "jpg");
        assert_eq!(normalize_ext(".png").unwrap(), "png");
        assert!(normalize_ext("exe").is_err());
    }
}
