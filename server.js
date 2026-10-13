// server.js — Express server: serves static files + proxies NewsAPI
// Run: node server.js  →  open http://localhost:3001
// Set NEWS_API_KEY in .env for live news; works without it (demo mode).

require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_BASE = "https://newsapi.org/v2";

// ── CORS: allow all origins (covers file://, localhost variants, live server) ─
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Serve frontend static files from the project root ────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Shared NewsAPI fetch helper ───────────────────────────────────────────────
const fetchNewsAPI = async (url) => {
  // Node 18+ has built-in fetch; fall back to dynamic import for older versions
  const fetcher = typeof fetch !== "undefined"
    ? fetch
    : (await import("node-fetch").catch(() => null))?.default;

  if (!fetcher) throw new Error("No fetch implementation available. Run: npm install node-fetch");

  const res = await fetcher(url, {
    headers: { "User-Agent": "NewsPulse/1.0" }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NewsAPI ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
};

// ── GET /api/headlines?category=general&page=1&pageSize=12 ────────────────────
app.get("/api/headlines", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      status: "error",
      code: "no_api_key",
      message: "NEWS_API_KEY not configured — using demo data on the frontend."
    });
  }
  const { category = "general", page = 1, pageSize = 12 } = req.query;
  const safeCat = String(category).toLowerCase().replace(/[^a-z]/g, "") || "general";
  try {
    const data = await fetchNewsAPI(
      `${NEWS_BASE}/top-headlines?category=${safeCat}&page=${page}&pageSize=${pageSize}&language=en&apiKey=${API_KEY}`
    );
    res.json(data);
  } catch (err) {
    console.error("[/api/headlines]", err.message);
    res.status(502).json({ status: "error", message: err.message });
  }
});

// ── GET /api/search?q=query&page=1&pageSize=12 ────────────────────────────────
app.get("/api/search", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      status: "error",
      code: "no_api_key",
      message: "NEWS_API_KEY not configured — using demo data on the frontend."
    });
  }
  const { q, page = 1, pageSize = 12 } = req.query;
  if (!q || !String(q).trim()) {
    return res.status(400).json({ status: "error", message: "q parameter is required" });
  }
  try {
    const data = await fetchNewsAPI(
      `${NEWS_BASE}/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&page=${page}&pageSize=${pageSize}&language=en&apiKey=${API_KEY}`
    );
    res.json(data);
  } catch (err) {
    console.error("[/api/search]", err.message);
    res.status(502).json({ status: "error", message: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: Boolean(API_KEY),
    message: API_KEY ? "Ready — live news enabled." : "No API key — demo mode active."
  });
});

// ── Fallback: serve index.html for any unmatched route ───────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  NewsPulse AI running at http://localhost:${PORT}`);
  console.log(`  API key: ${API_KEY ? "configured ✓" : "not set — demo mode"}`);
  console.log(`  Open http://localhost:${PORT} in your browser\n`);
});
