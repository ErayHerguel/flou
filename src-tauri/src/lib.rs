mod assets;
mod backup;
mod db;
mod paths;
mod transfer;

use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "databases",
            sql: include_str!("../migrations/002_databases.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "search",
            sql: include_str!("../migrations/003_search.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Beendet die App, nachdem das Frontend ausstehende Änderungen gespeichert hat.
#[tauri::command]
fn app_quit(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(paths::DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(db::Db::new())
        .setup(|app| {
            paths::ensure_dirs(app.handle())?;
            backup::schedule(app.handle().clone());
            // Das Fenster startet unsichtbar und wird vom Frontend nach dem ersten Rendern gezeigt
            // (kein weißes Aufblitzen im Dark Mode). Fallback, falls das Frontend hängt:
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(1500)).await;
                if let Some(window) = handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_quit,
            assets::asset_import_bytes,
            assets::asset_import_file,
            assets::open_external,
            backup::backup_now,
            db::db_tx,
            paths::app_paths,
            paths::reveal_dir,
            transfer::export_write,
            transfer::import_read,
            transfer::reveal_path,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten von Flou");
}
