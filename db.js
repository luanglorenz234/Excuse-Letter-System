/**
 * Alpha Premier Group — Absence Request System
 * SQLite Database Layer (Built-in Node.js node:sqlite)
 *
 * Provides persistent SQLite storage for multi-user local hosting.
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "alpha_premier.db");
const SEED_PATH = path.join(__dirname, "seed.json");

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency and durability
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");

// Initialize Schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT,
      role TEXT,
      name TEXT,
      department TEXT,
      internId TEXT,
      status TEXT,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      refNo TEXT,
      uid TEXT,
      status TEXT,
      date TEXT,
      type TEXT,
      isGroup INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS absence_slots (
      slot_key TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      uid TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      action TEXT,
      byUid TEXT,
      byName TEXT,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS counters (
      year TEXT PRIMARY KEY,
      nextRefNo INTEGER NOT NULL
    );
  `);
}

initSchema();

// Load seed data if database is empty
function seedIfEmpty() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (!row || row.count === 0) {
    console.log("[SQLite DB] Initializing database with seed data...");
    if (fs.existsSync(SEED_PATH)) {
      try {
        const seedData = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
        resetDatabase(seedData);
        console.log("[SQLite DB] Seed data successfully populated into alpha_premier.db");
      } catch (err) {
        console.error("[SQLite DB] Failed to seed from seed.json:", err);
      }
    }
  }
}

// Reset database to seed
function resetDatabase(customSeed) {
  let seed = customSeed;
  if (!seed && fs.existsSync(SEED_PATH)) {
    seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  }
  if (!seed) return;

  db.exec("BEGIN TRANSACTION;");
  try {
    db.exec("DELETE FROM users;");
    db.exec("DELETE FROM requests;");
    db.exec("DELETE FROM absence_slots;");
    db.exec("DELETE FROM audit_logs;");
    db.exec("DELETE FROM settings;");
    db.exec("DELETE FROM counters;");

    // Insert users
    if (seed.users) {
      const stmt = db.prepare(`
        INSERT INTO users (uid, email, role, name, department, internId, status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [uid, user] of Object.entries(seed.users)) {
        stmt.run(
          uid,
          user.email || null,
          user.role || null,
          user.name || null,
          user.department || null,
          user.internId || null,
          user.status || "active",
          JSON.stringify(user)
        );
      }
    }

    // Insert requests
    if (seed.requests) {
      const stmt = db.prepare(`
        INSERT INTO requests (id, refNo, uid, status, date, type, isGroup, createdAt, updatedAt, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [id, req] of Object.entries(seed.requests)) {
        stmt.run(
          id,
          req.refNo || null,
          req.uid || null,
          req.status || "submitted",
          req.date || req.startDate || null,
          req.type || "full",
          req.isGroup ? 1 : 0,
          req.createdAt || new Date().toISOString(),
          req.updatedAt || new Date().toISOString(),
          JSON.stringify(req)
        );
      }
    }

    // Insert absence slots
    if (seed.absenceSlots) {
      const stmt = db.prepare(`
        INSERT INTO absence_slots (slot_key, requestId, uid)
        VALUES (?, ?, ?)
      `);
      for (const [slotKey, slot] of Object.entries(seed.absenceSlots)) {
        stmt.run(slotKey, slot.requestId, slot.uid);
      }
    }

    // Insert settings
    if (seed.settings) {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
      `);
      for (const [key, val] of Object.entries(seed.settings)) {
        stmt.run(key, JSON.stringify(val));
      }
    }

    // Insert counters
    if (seed.counters) {
      const stmt = db.prepare(`
        INSERT INTO counters (year, nextRefNo)
        VALUES (?, ?)
      `);
      for (const [year, counter] of Object.entries(seed.counters)) {
        stmt.run(year, counter.nextRefNo || 1);
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// Read full state from SQLite
function getState() {
  const users = {};
  const userRows = db.prepare("SELECT data FROM users").all();
  for (const r of userRows) {
    try {
      const u = JSON.parse(r.data);
      users[u.uid] = u;
    } catch (e) {}
  }

  const requests = {};
  const reqRows = db.prepare("SELECT data FROM requests").all();
  for (const r of reqRows) {
    try {
      const rq = JSON.parse(r.data);
      requests[rq.id] = rq;
    } catch (e) {}
  }

  const absenceSlots = {};
  const slotRows = db.prepare("SELECT slot_key, requestId, uid FROM absence_slots").all();
  for (const r of slotRows) {
    absenceSlots[r.slot_key] = { requestId: r.requestId, uid: r.uid };
  }

  const settings = {};
  const settingRows = db.prepare("SELECT key, value FROM settings").all();
  for (const r of settingRows) {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch (e) {
      settings[r.key] = r.value;
    }
  }

  const counters = {};
  const counterRows = db.prepare("SELECT year, nextRefNo FROM counters").all();
  for (const r of counterRows) {
    counters[r.year] = { nextRefNo: r.nextRefNo };
  }

  const auditLogs = [];
  const logRows = db.prepare("SELECT data FROM audit_logs ORDER BY timestamp ASC").all();
  for (const r of logRows) {
    try {
      auditLogs.push(JSON.parse(r.data));
    } catch (e) {}
  }

  return {
    users,
    requests,
    absenceSlots,
    settings,
    counters,
    auditLogs
  };
}

// Upsert a single request
function saveRequest(req) {
  const stmt = db.prepare(`
    INSERT INTO requests (id, refNo, uid, status, date, type, isGroup, createdAt, updatedAt, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      refNo = excluded.refNo,
      uid = excluded.uid,
      status = excluded.status,
      date = excluded.date,
      type = excluded.type,
      isGroup = excluded.isGroup,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      data = excluded.data
  `);

  stmt.run(
    req.id,
    req.refNo || null,
    req.uid || null,
    req.status || "submitted",
    req.date || req.startDate || null,
    req.type || "full",
    req.isGroup ? 1 : 0,
    req.createdAt || new Date().toISOString(),
    req.updatedAt || new Date().toISOString(),
    JSON.stringify(req)
  );
}

// Delete a request and its slots
function deleteRequest(id) {
  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare("DELETE FROM requests WHERE id = ?").run(id);
    db.prepare("DELETE FROM absence_slots WHERE requestId = ?").run(id);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// Batch Sync from Client (Atomic Transaction)
function syncFullState(payload) {
  db.exec("BEGIN TRANSACTION;");
  try {
    if (payload.requests) {
      const stmt = db.prepare(`
        INSERT INTO requests (id, refNo, uid, status, date, type, isGroup, createdAt, updatedAt, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          refNo = excluded.refNo,
          uid = excluded.uid,
          status = excluded.status,
          date = excluded.date,
          type = excluded.type,
          isGroup = excluded.isGroup,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt,
          data = excluded.data
      `);
      for (const [id, req] of Object.entries(payload.requests)) {
        stmt.run(
          id,
          req.refNo || null,
          req.uid || null,
          req.status || "submitted",
          req.date || req.startDate || null,
          req.type || "full",
          req.isGroup ? 1 : 0,
          req.createdAt || new Date().toISOString(),
          req.updatedAt || new Date().toISOString(),
          JSON.stringify(req)
        );
      }
    }

    if (payload.absenceSlots) {
      // Re-populate slots to match requests
      db.exec("DELETE FROM absence_slots;");
      const stmt = db.prepare(`
        INSERT INTO absence_slots (slot_key, requestId, uid)
        VALUES (?, ?, ?)
        ON CONFLICT(slot_key) DO UPDATE SET
          requestId = excluded.requestId,
          uid = excluded.uid
      `);
      for (const [slotKey, slot] of Object.entries(payload.absenceSlots)) {
        stmt.run(slotKey, slot.requestId, slot.uid);
      }
    }

    if (payload.users) {
      const stmt = db.prepare(`
        INSERT INTO users (uid, email, role, name, department, internId, status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          email = excluded.email,
          role = excluded.role,
          name = excluded.name,
          department = excluded.department,
          internId = excluded.internId,
          status = excluded.status,
          data = excluded.data
      `);
      for (const [uid, user] of Object.entries(payload.users)) {
        stmt.run(
          uid,
          user.email || null,
          user.role || null,
          user.name || null,
          user.department || null,
          user.internId || null,
          user.status || "active",
          JSON.stringify(user)
        );
      }
    }

    if (payload.settings) {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      for (const [key, val] of Object.entries(payload.settings)) {
        stmt.run(key, JSON.stringify(val));
      }
    }

    if (payload.counters) {
      const stmt = db.prepare(`
        INSERT INTO counters (year, nextRefNo)
        VALUES (?, ?)
        ON CONFLICT(year) DO UPDATE SET nextRefNo = excluded.nextRefNo
      `);
      for (const [year, counter] of Object.entries(payload.counters)) {
        stmt.run(year, counter.nextRefNo || 1);
      }
    }

    if (payload.auditLogs && Array.isArray(payload.auditLogs)) {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, timestamp, action, byUid, byName, data)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
      `);
      for (const log of payload.auditLogs) {
        stmt.run(
          log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          log.timestamp || new Date().toISOString(),
          log.action || null,
          log.byUid || null,
          log.byName || null,
          JSON.stringify(log)
        );
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

seedIfEmpty();

module.exports = {
  db,
  getState,
  saveRequest,
  deleteRequest,
  syncFullState,
  resetDatabase
};
