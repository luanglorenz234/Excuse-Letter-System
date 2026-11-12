/**
 * Alpha Premier Group — Absence Request System
 * Local Development Server with SQLite REST API & Static Hosting
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const dbModule = require("./db");

const PORT = 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      // 50 MB limit for base64 signatures/attachments
      if (raw.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Request payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  const [reqPath] = req.url.split("?");

  /* ==========================================
     SQLITE REST API ROUTES
     ========================================== */
  if (reqPath.startsWith("/api/")) {
    try {
      // GET /api/state — Retrieve full state from SQLite
      if (req.method === "GET" && reqPath === "/api/state") {
        const state = dbModule.getState();
        return sendJson(res, 200, { success: true, state });
      }

      // POST /api/sync — Batch sync client state to SQLite
      if (req.method === "POST" && reqPath === "/api/sync") {
        const body = await parseJsonBody(req);
        dbModule.syncFullState(body);
        return sendJson(res, 200, { success: true, timestamp: new Date().toISOString() });
      }

      // POST /api/requests — Save or update single request
      if (req.method === "POST" && reqPath === "/api/requests") {
        const body = await parseJsonBody(req);
        if (!body || !body.request) {
          return sendJson(res, 400, { success: false, error: "Missing request data" });
        }
        dbModule.saveRequest(body.request);
        return sendJson(res, 200, { success: true, id: body.request.id });
      }

      // DELETE /api/requests/:id
      if (req.method === "DELETE" && reqPath.startsWith("/api/requests/")) {
        const id = reqPath.replace("/api/requests/", "");
        dbModule.deleteRequest(id);
        return sendJson(res, 200, { success: true, deletedId: id });
      }

      // POST /api/reset — Reset SQLite DB to seed
      if (req.method === "POST" && reqPath === "/api/reset") {
        dbModule.resetDatabase();
        const state = dbModule.getState();
        return sendJson(res, 200, { success: true, state });
      }

      return sendJson(res, 404, { success: false, error: "API route not found" });
    } catch (err) {
      console.error(`[API Error] ${req.method} ${reqPath}:`, err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  /* ==========================================
     STATIC FILE HOSTING
     ========================================== */
  let filePath = decodeURIComponent(reqPath);
  if (filePath === "/" || filePath === "") filePath = "/index.html";

  const safePath = path.normalize(path.join(ROOT_DIR, filePath));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    res.end("403 Forbidden");
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Alpha Premier System] Local server running with SQLite at http://localhost:${PORT}/`);
});
