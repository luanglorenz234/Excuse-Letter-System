//! The data, in one SQLite file on this PC:
//! `%LOCALAPPDATA%\com.alphapremier.apgexcuseletters\excuse-letters.db` on Windows.
//!
//! Rust only stores. Every rule (the duplicate guard, who may edit, approvals)
//! is TypeScript in `src/core`, which hands over a finished set of changes;
//! `db_commit` writes the whole set in one transaction, like a Firestore batch,
//! so a save is never half done. Each document is kept as JSON beside the
//! columns worth looking it up by, the same tables the old Node server used.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The open database, shared by every command.
pub struct Database(Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Slot {
    pub request_id: String,
    pub uid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Counter {
    pub next_ref_no: i64,
}

/// Everything stored, in the shape `src/core/types.ts` calls `Db`.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub users: BTreeMap<String, Value>,
    pub requests: BTreeMap<String, Value>,
    pub absence_slots: BTreeMap<String, Slot>,
    pub settings: Value,
    pub counters: BTreeMap<String, Counter>,
}

/// One save, in the shape `src/core/types.ts` calls `Changes`.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Changes {
    #[serde(default)]
    pub users: Vec<Value>,
    #[serde(default)]
    pub requests: Vec<Value>,
    #[serde(default)]
    pub put_slots: BTreeMap<String, Slot>,
    #[serde(default)]
    pub delete_slots: Vec<String>,
    #[serde(default)]
    pub settings: Option<Value>,
    #[serde(default)]
    pub counters: BTreeMap<String, Counter>,
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT,
      role TEXT,
      status TEXT,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      uid TEXT,
      status TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS absence_slots (
      slot_key TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      uid TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS absence_slots_by_request ON absence_slots (request_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS counters (
      year TEXT PRIMARY KEY,
      next_ref_no INTEGER NOT NULL
    );
";

fn text(value: &Value, field: &str) -> Option<String> {
    value.get(field).and_then(Value::as_str).map(str::to_owned)
}

impl Database {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self(Mutex::new(conn)))
    }

    #[cfg(test)]
    pub fn in_memory() -> rusqlite::Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self(Mutex::new(conn)))
    }

    fn conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.0.lock().map_err(|_| "The database is busy after an earlier error. Restart the app.".to_owned())
    }

    /// Everything stored, or None before anything has been (the first run).
    pub fn load(&self) -> Result<Option<Snapshot>, String> {
        let conn = self.conn()?;
        load(&conn).map_err(|e| format!("Couldn't read the database: {e}"))
    }

    pub fn commit(&self, changes: &Changes) -> Result<(), String> {
        let mut conn = self.conn()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        apply(&tx, changes).map_err(|e| format!("Couldn't save: {e}"))?;
        tx.commit().map_err(|e| format!("Couldn't save: {e}"))
    }

    /// Empties every table and writes `changes`: how sample data is put back.
    pub fn reset(&self, changes: &Changes) -> Result<(), String> {
        let mut conn = self.conn()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch("DELETE FROM users; DELETE FROM requests; DELETE FROM absence_slots; DELETE FROM settings; DELETE FROM counters;")
            .map_err(|e| e.to_string())?;
        apply(&tx, changes).map_err(|e| format!("Couldn't reset: {e}"))?;
        tx.commit().map_err(|e| format!("Couldn't reset: {e}"))
    }
}

fn load(conn: &Connection) -> rusqlite::Result<Option<Snapshot>> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
    if count == 0 {
        return Ok(None);
    }
    let docs = |sql: &str| -> rusqlite::Result<BTreeMap<String, Value>> {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        let mut out = BTreeMap::new();
        for row in rows {
            let (key, json) = row?;
            // A row that isn't JSON is skipped rather than failing the whole app.
            if let Ok(value) = serde_json::from_str(&json) {
                out.insert(key, value);
            }
        }
        Ok(out)
    };
    let users = docs("SELECT uid, data FROM users")?;
    let requests = docs("SELECT id, data FROM requests")?;

    let mut absence_slots = BTreeMap::new();
    {
        let mut stmt = conn.prepare("SELECT slot_key, request_id, uid FROM absence_slots")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, Slot { request_id: r.get(1)?, uid: r.get(2)? })))?;
        for row in rows {
            let (key, slot) = row?;
            absence_slots.insert(key, slot);
        }
    }

    let mut counters = BTreeMap::new();
    {
        let mut stmt = conn.prepare("SELECT year, next_ref_no FROM counters")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, Counter { next_ref_no: r.get(1)? })))?;
        for row in rows {
            let (year, counter) = row?;
            counters.insert(year, counter);
        }
    }

    let settings = conn
        .query_row("SELECT value FROM settings WHERE key = 'settings'", [], |r| r.get::<_, String>(0))
        .optional()?
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or(Value::Null);

    Ok(Some(Snapshot { users, requests, absence_slots, settings, counters }))
}

fn apply(tx: &rusqlite::Transaction<'_>, changes: &Changes) -> rusqlite::Result<()> {
    for user in &changes.users {
        let Some(uid) = text(user, "uid") else { continue };
        tx.execute(
            "INSERT OR REPLACE INTO users (uid, email, role, status, data) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![uid, text(user, "email"), text(user, "role"), text(user, "status"), user.to_string()],
        )?;
    }
    for request in &changes.requests {
        let Some(id) = text(request, "id") else { continue };
        tx.execute(
            "INSERT OR REPLACE INTO requests (id, uid, status, updated_at, data) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, text(request, "uid"), text(request, "status"), text(request, "updatedAt"), request.to_string()],
        )?;
    }
    for key in &changes.delete_slots {
        tx.execute("DELETE FROM absence_slots WHERE slot_key = ?1", params![key])?;
    }
    for (key, slot) in &changes.put_slots {
        tx.execute(
            "INSERT OR REPLACE INTO absence_slots (slot_key, request_id, uid) VALUES (?1, ?2, ?3)",
            params![key, slot.request_id, slot.uid],
        )?;
    }
    if let Some(settings) = &changes.settings {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?1)",
            params![settings.to_string()],
        )?;
    }
    for (year, counter) in &changes.counters {
        tx.execute(
            "INSERT OR REPLACE INTO counters (year, next_ref_no) VALUES (?1, ?2)",
            params![year, counter.next_ref_no],
        )?;
    }
    Ok(())
}

// ---- the commands the window calls ---------------------------------------------

#[tauri::command]
pub fn db_load(db: tauri::State<'_, Database>) -> Result<Option<Snapshot>, String> {
    db.load()
}

#[tauri::command]
pub fn db_commit(db: tauri::State<'_, Database>, changes: Changes) -> Result<(), String> {
    db.commit(&changes)
}

#[tauri::command]
pub fn db_reset(db: tauri::State<'_, Database>, changes: Changes) -> Result<(), String> {
    db.reset(&changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn changes(value: Value) -> Changes {
        serde_json::from_value(value).expect("valid changes")
    }

    #[test]
    fn empty_database_loads_as_none() {
        let db = Database::in_memory().unwrap();
        assert_eq!(db.load().unwrap(), None);
    }

    #[test]
    fn commit_then_load_round_trips() {
        let db = Database::in_memory().unwrap();
        db.commit(&changes(json!({
            "users": [{ "uid": "intern-john", "email": "john@x.ph", "role": "intern", "status": "active", "name": "John" }],
            "requests": [{ "id": "req-1", "uid": "intern-john", "status": "submitted", "updatedAt": "2026-11-12T00:00:00Z" }],
            "putSlots": { "intern-john_2026-11-13_am": { "requestId": "req-1", "uid": "intern-john" } },
            "settings": { "letter": { "subject": "Request for Absent" } },
            "counters": { "2026": { "nextRefNo": 43 } }
        })))
        .unwrap();

        let snap = db.load().unwrap().expect("data");
        assert_eq!(snap.users["intern-john"]["name"], "John");
        assert_eq!(snap.requests["req-1"]["status"], "submitted");
        assert_eq!(snap.absence_slots["intern-john_2026-11-13_am"].request_id, "req-1");
        assert_eq!(snap.settings["letter"]["subject"], "Request for Absent");
        assert_eq!(snap.counters["2026"].next_ref_no, 43);
    }

    #[test]
    fn deleting_slots_and_replacing_documents() {
        let db = Database::in_memory().unwrap();
        db.commit(&changes(json!({
            "users": [{ "uid": "u1", "name": "Old" }],
            "putSlots": { "u1_2026-11-13_am": { "requestId": "r", "uid": "u1" }, "u1_2026-11-13_pm": { "requestId": "r", "uid": "u1" } }
        })))
        .unwrap();
        db.commit(&changes(json!({
            "users": [{ "uid": "u1", "name": "New" }],
            "deleteSlots": ["u1_2026-11-13_am"]
        })))
        .unwrap();
        let snap = db.load().unwrap().unwrap();
        assert_eq!(snap.users["u1"]["name"], "New");
        assert_eq!(snap.absence_slots.len(), 1);
        assert!(snap.absence_slots.contains_key("u1_2026-11-13_pm"));
    }

    #[test]
    fn reset_replaces_everything() {
        let db = Database::in_memory().unwrap();
        db.commit(&changes(json!({ "users": [{ "uid": "a" }, { "uid": "b" }] }))).unwrap();
        db.reset(&changes(json!({ "users": [{ "uid": "c" }] }))).unwrap();
        let snap = db.load().unwrap().unwrap();
        assert_eq!(snap.users.keys().collect::<Vec<_>>(), vec!["c"]);
    }

    #[test]
    fn data_survives_reopening_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");
        Database::open(&path).unwrap().commit(&changes(json!({ "users": [{ "uid": "keep" }] }))).unwrap();
        let snap = Database::open(&path).unwrap().load().unwrap().unwrap();
        assert!(snap.users.contains_key("keep"));
    }
}
