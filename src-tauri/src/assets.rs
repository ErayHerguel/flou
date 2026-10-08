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

/// Speichert ein Bild inhaltsadressiert (SHA-256) im Asset-Ordner. Gleiche Bilder liegen nur einmal vor.
pub(crate) fn store(app: &AppHandle, bytes: &[u8], ext: &str) -> Result<String, String> {
    if bytes.len() > MAX_BYTES {
        return Err("Bilder dürfen höchstens 50 MB groß sein".into());
    }
    store_raw(app, bytes, &normalize_ext(ext)?)
}

/// Endung beliebiger Anhänge: nur Buchstaben/Ziffern, sonst "bin".
fn file_ext(name: &str) -> String {
    let ext = Path::new(name).extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if !ext.is_empty() && ext.len() <= 10 && ext.chars().all(|c| c.is_ascii_alphanumeric()) {
        ext
    } else {
        "bin".into()
    }
}

fn store_raw(app: &AppHandle, bytes: &[u8], ext: &str) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("Leere Datei".into());
    }
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

const MAX_FILE_BYTES: usize = 500 * 1024 * 1024;

#[derive(serde::Serialize)]
pub struct StoredFile {
    pub(crate) src: String,
    pub(crate) size: usize,
}

/// Anhang unter seinem Originalnamen (nur für die Endung) speichern.
pub(crate) fn store_file(app: &AppHandle, bytes: &[u8], name: &str) -> Result<StoredFile, String> {
    if bytes.len() > MAX_FILE_BYTES {
        return Err("Anhänge dürfen höchstens 500 MB groß sein".into());
    }
    Ok(StoredFile { src: store_raw(app, bytes, &file_ext(name))?, size: bytes.len() })
}

/// Beliebige Datei als Anhang in den App-Ordner kopieren.
#[tauri::command]
pub fn file_import(app: AppHandle, path: String) -> Result<StoredFile, String> {
    let bytes = fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
    store_file(&app, &bytes, &path)
}

/// Anhang aus Zwischenablage oder Drag-and-drop; Dateiname im Header `x-name` (URL-kodiert).
#[tauri::command]
pub fn file_import_bytes(app: AppHandle, request: Request<'_>) -> Result<StoredFile, String> {
    let name = request.headers().get("x-name").and_then(|v| v.to_str().ok()).unwrap_or("datei").to_string();
    match request.body() {
        InvokeBody::Raw(bytes) => store_file(&app, bytes, &name),
        InvokeBody::Json(_) => Err("Erwartet Binärdaten".into()),
    }
}

/// Öffnet einen Anhang mit dem Standardprogramm des Systems.
#[tauri::command]
pub fn open_asset(app: AppHandle, name: String) -> Result<(), String> {
    if name.contains(['/', '\\']) || name.starts_with('.') {
        return Err("Ungültiger Dateiname".into());
    }
    let path = assets_dir(&app)?.join(name);
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())
}

/// Öffnet einen Link im Standardbrowser. Nur auf ausdrückliche Aktion des Nutzers.
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let allowed = ["https://", "http://", "mailto:"];
    if !allowed.iter().any(|p| url.starts_with(p)) {
        return Err("Nur http(s)- und mailto-Links können geöffnet werden".into());
    }
    tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{file_ext, normalize_ext};

    #[test]
    fn sanitizes_file_extensions() {
        assert_eq!(file_ext("Bericht.PDF"), "pdf");
        assert_eq!(file_ext("ohne"), "bin");
        assert_eq!(file_ext("x.$(rm)"), "bin");
    }

    #[test]
    fn accepts_images_only() {
        assert_eq!(normalize_ext("JPEG").unwrap(), "jpg");
        assert_eq!(normalize_ext(".png").unwrap(), "png");
        assert!(normalize_ext("exe").is_err());
    }
}
