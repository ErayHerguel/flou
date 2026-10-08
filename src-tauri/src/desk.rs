//! Arbeiten außerhalb des Hauptfensters: Schnellnotiz per globalem Tastenkürzel und Symbol in der
//! Menüleiste (macOS) bzw. im Infobereich (Windows). Damit kann flou auch ohne offenes Fenster
//! weiterlaufen, etwa solange geteilt wird.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{App, AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const QUICK: &str = "quick";

/// ⌃⌥N (Windows: Strg+Alt+N) öffnet die Schnellnotiz, egal welches Programm vorne ist.
fn quick_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN)
}

/// Zeigt das Hauptfenster (z. B. nach dem Schließen, während flou im Hintergrund weiterläuft).
pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Kleines Fenster für eine schnelle Notiz. Die Notiz selbst legt das Hauptfenster an.
pub fn open_quick(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(QUICK) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let builder = WebviewWindowBuilder::new(app, QUICK, WebviewUrl::App("index.html#quick".into()))
        .title("Schnellnotiz")
        .inner_size(560.0, 250.0)
        .resizable(false)
        .always_on_top(true)
        .center()
        .focused(true);
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true);
    if let Err(err) = builder.build() {
        eprintln!("Schnellnotiz konnte nicht geöffnet werden: {err}");
    }
}

/// Öffnet die Schnellnotiz aus dem Hauptfenster heraus (Befehlspalette).
#[tauri::command]
pub fn quick_note_open(app: AppHandle) {
    open_quick(&app);
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    let shortcut = quick_shortcut();
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, pressed, event| {
                if pressed == &shortcut && event.state() == ShortcutState::Pressed {
                    open_quick(app);
                }
            })
            .build(),
    )?;
    // Ist das Kürzel schon von einem anderen Programm belegt, bleibt die Schnellnotiz über Menü und Palette erreichbar.
    if let Err(err) = app.global_shortcut().register(quick_shortcut()) {
        eprintln!("Kürzel für die Schnellnotiz nicht verfügbar: {err}");
    }

    let quick = MenuItem::with_id(app, "quick", "Schnellnotiz", true, Some("Ctrl+Alt+N"))?;
    let open = MenuItem::with_id(app, "open", "flou öffnen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "flou beenden", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&quick, &open, &separator, &quit])?;
    // macOS: einfarbige Vorlage, die sich der Menüleiste anpasst; Windows: farbiges App-Symbol.
    #[cfg(target_os = "macos")]
    let icon = tauri::include_image!("icons/tray.png");
    #[cfg(not(target_os = "macos"))]
    let icon = app.default_window_icon().cloned().unwrap_or_else(|| tauri::include_image!("icons/tray.png"));
    TrayIconBuilder::with_id("flou")
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("flou")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quick" => open_quick(app),
            "open" => show_main(app),
            // Beenden über das Hauptfenster, damit vorher alles gespeichert wird.
            "quit" => {
                show_main(app);
                let _ = app.emit_to("main", "tray:quit", ());
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
