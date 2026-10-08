//! Öffentliche Adresse über einen Cloudflare Quick Tunnel.
//!
//! cloudflared (Apache-2.0) wird beim ersten Teilen einmalig von GitHub geladen, per SHA-256
//! geprüft und im Datenordner abgelegt. Quick Tunnels brauchen kein Konto; die Adresse
//! (https://….trycloudflare.com) ist bei jedem Start eine neue.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use super::Share;
use crate::paths::data_dir;

/// Feste Version mit bekannten Prüfsummen (GitHub-Release-Digests).
const VERSION: &str = "2026.9.3";

struct Download {
    file: &'static str,
    sha256: &'static str,
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const DOWNLOAD: Option<Download> = Some(Download {
    file: "cloudflared-darwin-arm64.tgz",
    sha256: "587c2cfb1c230fe36c7fa7727da78be459dae028cabe8c001291999350f07095",
});

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const DOWNLOAD: Option<Download> = Some(Download {
    file: "cloudflared-windows-amd64.exe",
    sha256: "f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2",
});

#[cfg(not(any(all(target_os = "macos", target_arch = "aarch64"), all(target_os = "windows", target_arch = "x86_64"))))]
const DOWNLOAD: Option<Download> = None;

/// Bis die öffentliche Adresse steht, höchstens so lange warten.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(60);

fn bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("bin"))
}

fn binary_name() -> String {
    format!("cloudflared-{VERSION}{}", std::env::consts::EXE_SUFFIX)
}

/// Lädt cloudflared, falls es noch nicht da ist. `downloading` wird nur bei einem echten Download aufgerufen.
async fn ensure_binary(app: &AppHandle, downloading: impl FnOnce()) -> Result<PathBuf, String> {
    let dir = bin_dir(app)?;
    let path = dir.join(binary_name());
    if path.exists() {
        return Ok(path);
    }
    let download = DOWNLOAD.ok_or("Teilen über das Internet ist auf diesem System nicht verfügbar")?;
    downloading();
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    let url = format!("https://github.com/cloudflare/cloudflared/releases/download/{VERSION}/{}", download.file);
    let client = reqwest::Client::builder()
        .user_agent(concat!("flou/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let bytes = client
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|_| "cloudflared konnte nicht geladen werden. Besteht eine Internetverbindung?".to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    if format!("{:x}", Sha256::digest(&bytes)) != download.sha256 {
        return Err("Der Download von cloudflared ist beschädigt (Prüfsumme stimmt nicht).".into());
    }
    let binary = if download.file.ends_with(".tgz") { extract_tgz(&bytes)? } else { bytes.to_vec() };
    install(&dir, &path, &binary)?;
    Ok(path)
}

fn extract_tgz(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(bytes));
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        let is_binary = entry.path().map_err(|e| e.to_string())?.file_name().is_some_and(|n| n == "cloudflared");
        if is_binary {
            let mut out = Vec::new();
            entry.read_to_end(&mut out).map_err(|e| e.to_string())?;
            return Ok(out);
        }
    }
    Err("cloudflared fehlt im Archiv".into())
}

/// Atomar ablegen und ältere Versionen entfernen.
fn install(dir: &Path, path: &Path, binary: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(".cloudflared.tmp");
    std::fs::write(&tmp, binary).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("cloudflared-") && entry.path() != path {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}

/// Findet die öffentliche Adresse in einer Logzeile von cloudflared.
pub(super) fn parse_url(line: &str) -> Option<String> {
    let start = line.find("https://")?;
    let rest = &line[start..];
    let end = rest.find(|c: char| c.is_whitespace() || c == '|').unwrap_or(rest.len());
    let url = &rest[..end];
    let host = url.strip_prefix("https://")?;
    let sub = host.strip_suffix(".trycloudflare.com")?;
    let valid = !sub.is_empty() && sub.contains('-') && sub.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    valid.then(|| url.to_string())
}

/// Leere Konfiguration: eine vorhandene ~/.cloudflared/config.yml soll den Quick Tunnel nicht stören.
fn empty_config(app: &AppHandle) -> Result<PathBuf, String> {
    let path = bin_dir(app)?.join("quick-tunnel.yml");
    if !path.exists() {
        std::fs::write(&path, "{}\n").map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn spawn(binary: &Path, config: &Path, port: u16) -> std::io::Result<Child> {
    let mut command = Command::new(binary);
    command
        .arg("tunnel")
        .arg("--no-autoupdate")
        .arg("--config")
        .arg(config)
        .arg("--url")
        .arg(format!("http://127.0.0.1:{port}"))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        // Kein Konsolenfenster
        command.creation_flags(0x0800_0000);
    }
    command.spawn()
}

/// Baut den Tunnel auf und meldet den Fortschritt über den Freigabe-Status.
pub(super) async fn run(app: AppHandle, port: u16, slot: Arc<Mutex<Option<Child>>>, generation: u64) {
    let share = app.state::<Share>();
    let fail = |message: String| {
        share.update(&app, generation, |s| {
            s.phase = "error";
            s.error = Some(message);
        })
    };

    let binary = match ensure_binary(&app, || share.update(&app, generation, |s| s.phase = "downloading")).await {
        Ok(path) => path,
        Err(message) => return fail(message),
    };
    if !share.is_current(generation) {
        return;
    }
    share.update(&app, generation, |s| s.phase = "connecting");
    let config = match empty_config(&app) {
        Ok(path) => path,
        Err(message) => return fail(message),
    };
    let mut child = match spawn(&binary, &config, port) {
        Ok(child) => child,
        Err(e) => return fail(format!("cloudflared startet nicht: {e}")),
    };
    let Some(stderr) = child.stderr.take() else {
        return fail("cloudflared startet nicht".into());
    };
    {
        let mut slot = slot.lock().unwrap();
        // Zwischenzeitlich gestoppt: Prozess sofort beenden.
        if !share.is_current(generation) {
            let _ = child.start_kill();
            return;
        }
        *slot = Some(child);
    }

    let mut lines = BufReader::new(stderr).lines();
    let mut url: Option<String> = None;
    let mut registered = false;
    let mut online = false;
    let mut last_error: Option<String> = None;
    let deadline = tokio::time::Instant::now() + CONNECT_TIMEOUT;
    loop {
        let next = if online {
            lines.next_line().await
        } else {
            match tokio::time::timeout_at(deadline, lines.next_line()).await {
                Ok(line) => line,
                Err(_) => {
                    if let Some(mut child) = slot.lock().unwrap().take() {
                        let _ = child.start_kill();
                    }
                    return fail("Der Tunnel kam nicht zustande. Bitte später erneut versuchen.".into());
                }
            }
        };
        let Ok(Some(line)) = next else { break };
        if url.is_none() {
            if let Some(found) = parse_url(&line) {
                share.update(&app, generation, |s| s.url = Some(found.clone()));
                url = Some(found);
            }
        }
        registered |= line.contains("Registered tunnel connection");
        if url.is_some() && registered && !online {
            online = true;
            share.update(&app, generation, |s| s.phase = "online");
        }
        if line.contains(" ERR ") {
            last_error = line.split(" ERR ").nth(1).map(|s| s.trim().to_string());
        }
    }
    // cloudflared hat sich beendet, obwohl die Freigabe noch läuft.
    let detail = last_error.map(|e| format!(" ({e})")).unwrap_or_default();
    fail(format!("Die Verbindung ins Internet wurde unterbrochen{detail}."));
}

#[cfg(test)]
mod tests {
    use super::parse_url;

    #[test]
    fn finds_quick_tunnel_url() {
        let line = "2026-10-08T10:00:00Z INF |  https://quiet-river-lamp-moon.trycloudflare.com                                        |";
        assert_eq!(parse_url(line).as_deref(), Some("https://quiet-river-lamp-moon.trycloudflare.com"));
        assert_eq!(parse_url("INF Requesting new quick Tunnel on trycloudflare.com..."), None);
        assert_eq!(parse_url("ERR failed https://api.trycloudflare.com/tunnel"), None);
        assert_eq!(parse_url("INF https://www.cloudflare.com/website-terms/"), None);
    }
}
