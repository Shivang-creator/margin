// Local dev server: node:http only, no dependencies.
// Serves the static site (never .crew/) and mounts api/*.js default exports at /api/<name>.
// Reads .env.local into process.env with a simple KEY=value parser.
// With MOCK_GENERATE=1, POST /api/generate never reaches api/generate.js or the network — it
// replays fixtures/generations/<action>-1.json with provider forced to "fixture". Production
// (Vercel) has no MOCK_GENERATE and no code path that could serve a fixture (T-09 accept check:
// `grep -rn 'fixture' api/ | wc -l` -> 0).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function isBlocked(urlPath) {
  return (
    urlPath.startsWith("/.crew") ||
    urlPath.includes("/.git") ||
    urlPath.startsWith("/.env") ||
    urlPath.startsWith("/tmp/") ||
    urlPath === "/tmp"
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(data);
      }
    });
    req.on("error", reject);
  });
}

function augmentResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(body) {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

function serveMockGenerate(req, res) {
  augmentResponse(res);
  const action = (req.body && req.body.action) || "ask";
  const fixturePath = path.join(ROOT, "fixtures", "generations", `${action}-1.json`);
  if (!fs.existsSync(fixturePath)) {
    res.status(502).json({ ok: false, code: "bad-model-output", detail: `no fixture recorded for action "${action}"` });
    return;
  }
  let recorded;
  try {
    recorded = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  } catch {
    res.status(502).json({ ok: false, code: "bad-model-output", detail: `fixture ${fixturePath} is not valid JSON` });
    return;
  }
  res.status(200).json({ ...recorded, provider: "fixture" });
}

async function handleApi(req, res, urlPath) {
  const name = urlPath.replace(/^\/api\//, "").replace(/\/$/, "");

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    req.body = await readBody(req);
  }

  if (name === "generate" && process.env.MOCK_GENERATE === "1") {
    serveMockGenerate(req, res);
    return;
  }

  const filePath = path.join(ROOT, "api", `${name}.js`);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  augmentResponse(res);
  const mod = await import(pathToFileURL(filePath).href + `?t=${Date.now()}`);
  await mod.default(req, res);
}

function handleStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, decodeURIComponent(rel));
  if (!filePath.startsWith(ROOT) || isBlocked(urlPath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (isBlocked(urlPath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  if (urlPath.startsWith("/api/")) {
    try {
      await handleApi(req, res, urlPath);
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err && err.stack ? err.stack : err));
    }
    return;
  }
  handleStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log(`Margin dev server on http://localhost:${PORT}`);
});
