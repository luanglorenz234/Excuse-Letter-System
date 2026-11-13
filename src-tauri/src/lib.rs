//! APG Excuse Letters' Rust shell, built the same way as APG Post-It's.
//!
//! Rust does only what the WebView can't. The letters are on the apg-letters
//! Firebase project, and every rule (the letter, the duplicate guard, who may
//! approve) is TypeScript in `src/core`, run by the Cloud Functions. What lives here:
//!
//! - `save_text_file`: the CSV export, into `Downloads\APG Excuse Letters` (files.rs).
//! - The plugins, each scoped in `capabilities/default.json`: opening that folder,
//!   one window per PC, and the window's place and size.

mod files;

use tauri::Manager;

#[cfg(desktop)]
use tauri_plugin_window_state::StateFlags;

/// The one window, as labelled in `tauri.conf.json`.
const MAIN_WINDOW: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            // Registered first, as the plugin requires: a second launch hands over
            // to the first and exits, and the first comes to the front.
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                bring_to_front(app);
            }))
            // Restores the window's place, size and maximised state before it is shown.
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                    .build(),
            );
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![files::save_text_file])
        .setup(|app| {
            // The window starts hidden (tauri.conf.json) so it can be put back
            // where it was first. Its background is the theme's, so showing it
            // before the page has painted is dark, not a white flash.
            bring_to_front(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("APG Excuse Letters could not start");
}

fn bring_to_front<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    // Only when minimised: restoring a window that isn't would un-maximise it.
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    let _ = window.show();
    let _ = window.set_focus();
}
