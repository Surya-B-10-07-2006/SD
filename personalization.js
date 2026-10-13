// personalization.js — Lightweight scoring and preference engine (no ML, transparent rules)

const Personalization = (() => {
  const ALL_CATEGORIES = [
    "Technology", "Artificial Intelligence", "Science", "Business",
    "Finance", "Politics", "Sports", "Health", "Education",
    "Entertainment", "Environment", "World News"
  ];

  const EXPLORE_TOPICS = [
    { id: "ai", label: "Artificial Intelligence", query: "artificial intelligence", icon: "cpu", color: "#6366f1" },
    { id: "climate", label: "Climate Change", query: "climate change", icon: "leaf", color: "#22c55e" },
    { id: "startups", label: "Startups", query: "startup funding", icon: "rocket", color: "#f59e0b" },
    { id: "cyber", label: "Cybersecurity", query: "cybersecurity", icon: "shield", color: "#ef4444" },
    { id: "space", label: "Space", query: "space exploration", icon: "telescope", color: "#8b5cf6" },
    { id: "economy", label: "Global Economy", query: "global economy", icon: "trending-up", color: "#0ea5e9" },
    { id: "health", label: "Health & Medicine", query: "health medicine", icon: "heart-pulse", color: "#ec4899" },
    { id: "crypto", label: "Crypto & Web3", query: "cryptocurrency blockchain", icon: "bitcoin", color: "#f97316" }
  ];

  // Score articles based on user preferences and recency
  // Scoring: category match = 10pts, recency bonus up to 5pts, bookmarked category = +3pts
  const scoreArticles = (articles, preferences, bookmarks = []) => {
    const preferredCats = (preferences.categories || []).map(c => c.toLowerCase());
    const bookmarkedCats = bookmarks.map(b => b.category?.toLowerCase()).filter(Boolean);
    const now = Date.now();

    return articles.map(article => {
      let score = 0;
      const cat = article.category?.toLowerCase() || "";

      if (preferredCats.includes(cat)) score += 10;
      if (bookmarkedCats.includes(cat)) score += 3;

      // Recency: articles within 6h get up to 5 bonus points
      const ageHours = (now - new Date(article.publishedAt).getTime()) / 3600000;
      score += Math.max(0, 5 - Math.floor(ageHours / 6));

      return { ...article, _score: score };
    }).sort((a, b) => b._score - a._score);
  };

  // Filter articles by category
  const filterByCategory = (articles, category) => {
    if (!category || category === "all") return articles;
    return articles.filter(a => a.category?.toLowerCase() === category.toLowerCase());
  };

  // Filter articles by search query (title, description, source)
  const filterByQuery = (articles, query) => {
    if (!query) return articles;
    const q = query.toLowerCase();
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q) ||
      (a.source || "").toLowerCase().includes(q)
    );
  };

  return { ALL_CATEGORIES, EXPLORE_TOPICS, scoreArticles, filterByCategory, filterByQuery };
})();
