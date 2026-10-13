// news-service.js — Fetches and normalizes news; falls back to demo data gracefully

const NewsService = (() => {
  const PROXY_BASE = "http://localhost:3001/api";

  // Auto-detect: if page is served from the Express server, use the proxy.
  // If opened as file:// or from a different port, skip the proxy and use demo data.
  const USE_PROXY = (() => {
    try {
      const loc = window.location;
      return loc.protocol === "http:" && loc.hostname === "localhost" && loc.port === "3001";
    } catch { return false; }
  })();

  // Domains known to block hotlinking (HTTP 406 / 403)
  const BLOCKED_DOMAINS = [
    "ichef.bbci.co.uk", "static.independent.co.uk", "i.guim.co.uk",
    "media.cnn.com", "s.abcnews.com", "nypost.com", "pagesix.com",
    "image.cnbcfm.com", "images.wsj.net", "static01.nyt.com"
  ];

  // Unsplash fallbacks keyed by category — reliable, no hotlink protection
  const CATEGORY_IMAGES = {
    "Artificial Intelligence": "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=75",
    "Technology":              "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=75",
    "Science":                 "https://images.unsplash.com/photo-1532094349884-543559c5f185?w=600&q=75",
    "Business":                "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=75",
    "Finance":                 "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=75",
    "Politics":                "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&q=75",
    "Sports":                  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=75",
    "Health":                  "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=75",
    "Education":               "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=75",
    "Entertainment":           "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&q=75",
    "Environment":             "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75",
    "World News":              "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=75"
  };
  const FALLBACK_IMAGE = CATEGORY_IMAGES["World News"];

  // Returns a safe image URL — strips hotlink-blocked domains at normalization time
  const safeImage = (url, category = "World News") => {
    if (!url || !url.startsWith("http")) return CATEGORY_IMAGES[category] || FALLBACK_IMAGE;
    try {
      const host = new URL(url).hostname;
      if (BLOCKED_DOMAINS.some(d => host.includes(d))) return CATEGORY_IMAGES[category] || FALLBACK_IMAGE;
    } catch { return FALLBACK_IMAGE; }
    return url;
  };

  // Normalize a raw NewsAPI article into our internal format
  const normalize = (raw, category = "World News") => {
    const wordCount = ((raw.description || "") + " " + (raw.content || "")).split(/\s+/).length;
    return {
      id: btoa(encodeURIComponent(raw.url || raw.title || Math.random())).slice(0, 20),
      title: raw.title || "Untitled",
      description: raw.description || raw.content?.split("[+")[0] || "No description available.",
      url: raw.url || "#",
      image: safeImage(raw.urlToImage, category),
      source: raw.source?.name || raw.source || "Unknown Source",
      author: raw.author || null,
      publishedAt: raw.publishedAt || new Date().toISOString(),
      category,
      readTime: Math.max(1, Math.round(wordCount / 200))
    };
  };

  // Validate URL before opening
  const isSafeUrl = (url) => {
    try {
      const u = new URL(url);
      return ["http:", "https:"].includes(u.protocol);
    } catch { return false; }
  };

  // Fetch from proxy with a timeout so a dead server never hangs the UI
  const fetchFromProxy = async (endpoint, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${PROXY_BASE}${endpoint}?${qs}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5 s timeout

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      const data = await res.json();
      // Server returns 503 when no API key is set — treat as demo
      if (data.code === "no_api_key") throw new Error("no_api_key");
      return data;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  // Map NewsAPI category names to our internal category labels
  const NEWSAPI_CATEGORY_MAP = {
    "technology": "Technology",
    "science": "Science",
    "business": "Business",
    "health": "Health",
    "sports": "Sports",
    "entertainment": "Entertainment",
    "general": "World News",
    "artificial intelligence": "Artificial Intelligence",
    "finance": "Finance",
    "politics": "Politics",
    "education": "Education",
    "environment": "Environment"
  };

  const resolveCategory = (raw) =>
    NEWSAPI_CATEGORY_MAP[raw?.toLowerCase()] || raw || "World News";

  // Fetch top headlines for given categories
  const fetchHeadlines = async (categories = [], page = 1) => {
    if (!USE_PROXY) return { articles: [], isDemo: true };
    try {
      // Pick the first preferred category, map to NewsAPI-compatible name
      const cat = (categories[0] || "general").toLowerCase();
      const apiCat = ["technology","science","business","health","sports","entertainment","general"].includes(cat)
        ? cat : "general";

      const data = await fetchFromProxy("/headlines", { category: apiCat, page, pageSize: 12 });
      const internalCat = resolveCategory(categories[0] || "general");
      const articles = (data.articles || [])
        .filter(a => a.title && a.title !== "[Removed]")
        .map(a => normalize(a, internalCat));
      return { articles, isDemo: false };
    } catch (err) {
      if (err.name !== "AbortError") console.warn("Headlines fetch failed:", err.message);
      return { articles: [], isDemo: true };
    }
  };

  // Search articles by query
  const searchArticles = async (query, page = 1) => {
    if (!USE_PROXY) return { articles: [], isDemo: true };
    try {
      const data = await fetchFromProxy("/search", { q: query, page, pageSize: 12 });
      const articles = (data.articles || [])
        .filter(a => a.title && a.title !== "[Removed]")
        .map(a => normalize(a, "World News"));
      return { articles, isDemo: false };
    } catch (err) {
      if (err.name !== "AbortError") console.warn("Search fetch failed:", err.message);
      return { articles: [], isDemo: true };
    }
  };

  // Get demo articles filtered by categories/query — always synchronous, never fails
  const getDemoArticles = (categories = [], query = "", page = 1, pageSize = 9) => {
    let articles = [...DEMO_ARTICLES];

    if (query) {
      const q = query.toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.source || "").toLowerCase().includes(q)
      );
    } else if (categories.length > 0) {
      const cats = categories.map(c => c.toLowerCase());
      const preferred = articles.filter(a => cats.includes((a.category || "").toLowerCase()));
      const rest = articles.filter(a => !cats.includes((a.category || "").toLowerCase()));
      articles = [...preferred, ...rest];
    }

    const start = (page - 1) * pageSize;
    return {
      articles: articles.slice(start, start + pageSize),
      total: articles.length,
      isDemo: true
    };
  };

  return {
    fetchHeadlines, searchArticles, getDemoArticles,
    isSafeUrl, normalize,
    CATEGORY_IMAGES, FALLBACK_IMAGE,
    get isProxyMode() { return USE_PROXY; }
  };
})();
