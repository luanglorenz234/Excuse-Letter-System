//! Saving a file the person asked for (the HR queue's CSV export) to
//! `Downloads\APG Excuse Letters`, the one folder the app writes outside its own.

use std::path::{Path, PathBuf};

use tauri::Manager;

/// The folder under Downloads, as `capabilities/default.json` scopes it.
pub const EXPORT_FOLDER: &str = "APG Excuse Letters";

/// A file name with nothing that could leave the folder or upset Windows.
fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | ' ') { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() { "export.csv".to_owned() } else { trimmed.to_owned() }
}

fn write_into(folder: &Path, name: &str, contents: &str) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(folder)?;
    let path = folder.join(safe_name(name));
    std::fs::write(&path, contents)?;
    Ok(path)
}

/// Writes `contents` and returns the full path, for the app to show and open.
#[tauri::command]
pub fn save_text_file(app: tauri::AppHandle, file_name: String, contents: String) -> Result<String, String> {
    let downloads = app.path().download_dir().map_err(|_| "This PC has no Downloads folder.".to_owned())?;
    let path = write_into(&downloads.join(EXPORT_FOLDER), &file_name, &contents)
        .map_err(|e| format!("Couldn't save the file: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_stay_inside_the_folder() {
        assert_eq!(safe_name("../../evil.csv"), "_.._evil.csv");
        assert_eq!(safe_name("absences 2026-11.csv"), "absences 2026-11.csv");
        assert_eq!(safe_name("..."), "export.csv");
        assert_eq!(safe_name("a:b\\c/d.csv"), "a_b_c_d.csv");
    }

    #[test]
    fn writes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_into(dir.path(), "x.csv", "a,b").unwrap();
        assert_eq!(std::fs::read_to_string(path).unwrap(), "a,b");
    }
}
