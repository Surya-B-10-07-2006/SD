// app.js — Main application logic for NewsPulse AI

// ── State ────────────────────────────────────────────────────────────────────
const State = {
  view: "home",           // home | foryou | latest | explore | bookmarks | history | search
  articles: [],
  filteredArticles: [],
  page: 1,
  pageSize: 9,
  totalArticles: 0,
  isLoading: false,
  isDemo: true,
  activeCategory: "all",
  searchQuery: "",
  activeTopic: null
};

// ── DOM Helpers ───────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => c && node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
};

// ── Image Error Handling ─────────────────────────────────────────────────────
// Tracks URLs that already failed to prevent infinite onerror retry loops
const _failedImgs = new Set();

const handleImgError = (imgEl, category = "World News") => {
  if (_failedImgs.has(imgEl.src)) return; // already handled, stop
  _failedImgs.add(imgEl.src);

  // Try category-specific Unsplash fallback first
  const fallback = NewsService.CATEGORY_IMAGES[category] || NewsService.FALLBACK_IMAGE;
  if (imgEl.src !== fallback) {
    imgEl.src = fallback;
    return;
  }

  // Fallback itself failed — replace with a CSS placeholder so layout is preserved
  imgEl.style.display = "none";
  const placeholder = document.createElement("div");
  placeholder.className = "img-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
  imgEl.parentNode?.insertBefore(placeholder, imgEl);
};


const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", {
  month: "short", day: "numeric", year: "numeric"
});

// ── Article Card ──────────────────────────────────────────────────────────────
const createCard = (article) => {
  const bookmarked = Storage.isBookmarked(article.id);
  const card = el("article", { class: "card", role: "article" });

  const img = el("div", { class: "card-img" });
  const image = el("img", { alt: article.title, loading: "lazy" });
  image.src = article.image;
  image.onerror = () => handleImgError(image, article.category);
  img.appendChild(image);

  const body = el("div", { class: "card-body" });

  const meta = el("div", { class: "card-meta" });
  const catBadge = el("span", { class: "badge", text: article.category });
  const timeEl = el("span", { class: "card-time", text: timeAgo(article.publishedAt) });
  meta.append(catBadge, timeEl);

  const title = el("h3", { class: "card-title" });
  const titleLink = el("a", {
    href: "#",
    text: article.title,
    onclick: (e) => { e.preventDefault(); openArticle(article); }
  });
  title.appendChild(titleLink);

  const desc = el("p", { class: "card-desc", text: article.description });

  const footer = el("div", { class: "card-footer" });
  const sourceInfo = el("div", { class: "card-source" });
  const sourceName = el("span", { class: "source-name", text: article.source });
  const readTimeEl = el("span", { class: "read-time", text: `${article.readTime} min read` });
  sourceInfo.append(sourceName, readTimeEl);

  const actions = el("div", { class: "card-actions" });

  const bookmarkBtn = el("button", {
    class: `btn-icon ${bookmarked ? "bookmarked" : ""}`,
    "aria-label": bookmarked ? "Remove bookmark" : "Bookmark article",
    title: bookmarked ? "Remove bookmark" : "Save article",
    onclick: (e) => { e.stopPropagation(); toggleBookmark(article, bookmarkBtn); }
  });
  bookmarkBtn.innerHTML = `<i data-lucide="${bookmarked ? "bookmark-check" : "bookmark"}"></i>`;

  const readBtn = el("button", {
    class: "btn-read",
    text: "Read Article",
    onclick: () => openArticle(article)
  });

  actions.append(bookmarkBtn, readBtn);
  footer.append(sourceInfo, actions);
  body.append(meta, title, desc, footer);
  card.append(img, body);

  return card;
};

// ── Skeleton Cards ────────────────────────────────────────────────────────────
const createSkeleton = () => {
  const card = el("article", { class: "card skeleton" });
  card.innerHTML = `
    <div class="card-img skeleton-img"></div>
    <div class="card-body">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line medium"></div>
    </div>`;
  return card;
};

const showSkeletons = (count = 6) => {
  const grid = $("#news-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < count; i++) grid.appendChild(createSkeleton());
};

// ── Demo Banner ───────────────────────────────────────────────────────────────
const updateDemoBanner = (isDemo) => {
  const banner = $("#demo-banner");
  if (banner) banner.hidden = !isDemo;
};

// ── Render Feed ───────────────────────────────────────────────────────────────
const renderFeed = (articles, append = false) => {
  const grid = $("#news-grid");
  const emptyState = $("#empty-state");
  const loadMoreBtn = $("#load-more-btn");
  if (!grid) return;

  if (!append) grid.innerHTML = "";

  if (articles.length === 0 && !append) {
    grid.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  articles.forEach(a => grid.appendChild(createCard(a)));

  if (typeof lucide !== "undefined") lucide.createIcons();

  const shown = grid.querySelectorAll(".card:not(.skeleton)").length;
  if (loadMoreBtn) {
    loadMoreBtn.hidden = shown >= State.totalArticles;
  }
};

// ── Load Articles ─────────────────────────────────────────────────────────────
const loadArticles = async (append = false) => {
  if (State.isLoading) return;
  State.isLoading = true;

  if (!append) {
    State.page = 1;
    showSkeletons();
  }

  const prefs = Storage.getPreferences();
  const categories = prefs.categories || [];

  let result;
  try {
    if (!append) {
      result = await NewsService.fetchHeadlines(categories, State.page);
    }
  } catch (err) {
    console.warn("fetchHeadlines threw unexpectedly:", err);
  }

  // Always fall back to demo if live fetch failed or returned nothing
  if (!result || result.isDemo || !result.articles || result.articles.length === 0) {
    result = NewsService.getDemoArticles(categories, State.searchQuery, State.page);
  }

  State.isDemo = result.isDemo;
  updateDemoBanner(State.isDemo);

  let articles = result.articles || [];

  // Apply personalization scoring
  const bookmarks = Storage.getBookmarks();
  articles = Personalization.scoreArticles(articles, prefs, bookmarks);

  // Apply active category filter
  if (State.activeCategory !== "all") {
    articles = Personalization.filterByCategory(articles, State.activeCategory);
  }

  if (append) {
    State.articles = [...State.articles, ...articles];
  } else {
    State.articles = articles;
    State.totalArticles = result.total || DEMO_ARTICLES.length;
  }

  State.isLoading = false;
  renderFeed(articles, append);
};

// ── Toggle Bookmark ───────────────────────────────────────────────────────────
const toggleBookmark = (article, btn) => {
  if (Storage.isBookmarked(article.id)) {
    Storage.removeBookmark(article.id);
    btn.className = "btn-icon";
    btn.setAttribute("aria-label", "Bookmark article");
    btn.innerHTML = `<i data-lucide="bookmark"></i>`;
  } else {
    Storage.addBookmark(article);
    btn.className = "btn-icon bookmarked";
    btn.setAttribute("aria-label", "Remove bookmark");
    btn.innerHTML = `<i data-lucide="bookmark-check"></i>`;
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
  if (State.view === "bookmarks") renderBookmarks();
};

// ── Article Reader ────────────────────────────────────────────────────────────
const openArticle = (article) => {
  Storage.addToHistory(article);

  const modal = $("#article-modal");
  const content = $("#modal-content");
  if (!modal || !content) return;

  const bookmarked = Storage.isBookmarked(article.id);
  const safeUrl = NewsService.isSafeUrl(article.url) ? article.url : "#";

  content.innerHTML = "";

  const img = el("img", { class: "modal-hero", alt: article.title, loading: "lazy" });
  img.onerror = () => handleImgError(img, article.category);
  img.src = article.image;

  const header = el("div", { class: "modal-header" });
  const catBadge = el("span", { class: "badge", text: article.category });
  const dateEl = el("span", { class: "modal-date", text: formatDate(article.publishedAt) });
  header.append(catBadge, dateEl);

  const title = el("h2", { class: "modal-title", text: article.title });

  const byline = el("div", { class: "modal-byline" });
  if (article.author) byline.appendChild(el("span", { text: `By ${article.author}` }));
  byline.appendChild(el("span", { text: ` · ${article.source}` }));
  byline.appendChild(el("span", { text: ` · ${article.readTime} min read` }));

  const desc = el("p", { class: "modal-desc", text: article.description });

  const notice = el("p", { class: "modal-notice",
    text: "Full article content is available at the original publisher. Click below to read the complete story." });

  const modalActions = el("div", { class: "modal-actions" });

  const readOriginal = el("a", {
    class: "btn-primary",
    href: safeUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    text: "Read Full Article"
  });

  const bmBtn = el("button", {
    class: `btn-secondary ${bookmarked ? "bookmarked" : ""}`,
    text: bookmarked ? "Bookmarked" : "Save Article",
    onclick: () => {
      toggleBookmark(article, bmBtn);
      bmBtn.textContent = Storage.isBookmarked(article.id) ? "Bookmarked" : "Save Article";
      bmBtn.className = `btn-secondary ${Storage.isBookmarked(article.id) ? "bookmarked" : ""}`;
    }
  });

  modalActions.append(readOriginal, bmBtn);

  // Related articles
  const related = DEMO_ARTICLES
    .filter(a => a.id !== article.id && a.category === article.category)
    .slice(0, 3);

  content.append(img, header, title, byline, desc, notice, modalActions);

  if (related.length > 0) {
    const relSection = el("div", { class: "related-section" });
    relSection.appendChild(el("h4", { class: "related-title", text: "Related Stories" }));
    const relGrid = el("div", { class: "related-grid" });
    related.forEach(r => {
      const relCard = el("div", { class: "related-card", onclick: () => openArticle(r) });
      const relImg = el("img", { alt: r.title, loading: "lazy" });
      relImg.src = r.image;
      relImg.onerror = () => handleImgError(relImg, r.category);
      relCard.append(relImg, el("p", { text: r.title }));
      relGrid.appendChild(relCard);
    });
    relSection.appendChild(relGrid);
    content.appendChild(relSection);
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (typeof lucide !== "undefined") lucide.createIcons();
};

const closeModal = () => {
  const modal = $("#article-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
};

// ── Views ─────────────────────────────────────────────────────────────────────
const setView = (view) => {
  State.view = view;
  State.activeCategory = "all";
  State.searchQuery = "";
  State.page = 1;
  State.activeTopic = null;

  $$(".view-section").forEach(s => s.hidden = true);
  $$(".nav-link").forEach(l => l.classList.remove("active"));

  const activeLink = $(`.nav-link[data-view="${view}"]`);
  if (activeLink) activeLink.classList.add("active");

  // foryou and latest reuse the home view DOM
  const domView = (view === "foryou" || view === "latest") ? "home" : view;
  const section = $(`#view-${domView}`);
  if (section) section.hidden = false;

  $("#nav-menu")?.classList.remove("open");

  switch (view) {
    case "home":
    case "foryou":
    case "latest":
      renderMainView(view);
      break;
    case "explore":
      renderExplore();
      break;
    case "bookmarks":
      renderBookmarks();
      break;
    case "history":
      renderHistory();
      break;
    case "search":
      renderSearch();
      break;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ── Main Feed View ────────────────────────────────────────────────────────────
const renderMainView = (view) => {
  const prefs = Storage.getPreferences();
  const welcomeSection = $("#welcome-section");
  const briefingSection = $("#briefing-section");
  const categoryFilterWrap = $(".category-filter-wrap");
  const feedTitle = $("#feed-title");

  if (welcomeSection) {
    welcomeSection.hidden = view === "latest";
    if (view !== "latest") renderWelcome(prefs);
  }
  if (briefingSection) briefingSection.hidden = view !== "home";
  if (categoryFilterWrap) categoryFilterWrap.hidden = view === "latest";
  if (feedTitle) {
    feedTitle.textContent = view === "latest" ? "Latest News" : view === "foryou" ? "For You" : "Top Stories";
  }

  if (view === "latest") {
    const sorted = [...DEMO_ARTICLES].sort((a, b) =>
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );
    State.totalArticles = sorted.length;
    State.isDemo = true;
    updateDemoBanner(true);
    renderFeed(sorted.slice(0, State.pageSize));
  } else {
    loadArticles();
  }

  if (view === "home") renderBriefing();
};

const renderWelcome = (prefs) => {
  const el2 = $("#welcome-cats");
  if (!el2) return;
  el2.innerHTML = "";
  const cats = prefs.categories || [];
  if (cats.length === 0) {
    el2.appendChild(el("span", { class: "no-prefs", text: "No interests selected yet — " }));
    const link = el("a", { href: "#", text: "set your preferences", onclick: (e) => { e.preventDefault(); showOnboarding(); } });
    el2.appendChild(link);
  } else {
    cats.forEach(c => el2.appendChild(el("span", { class: "interest-tag", text: c })));
  }
};

const renderBriefing = () => {
  const list = $("#briefing-list");
  if (!list) return;
  list.innerHTML = "";
  const top = DEMO_ARTICLES.slice(0, 4);
  top.forEach(a => {
    const item = el("div", { class: "briefing-item", onclick: () => openArticle(a) });
    item.append(
      el("span", { class: "badge small", text: a.category }),
      el("span", { class: "briefing-title", text: a.title })
    );
    list.appendChild(item);
  });
};

// ── Category Filter ───────────────────────────────────────────────────────────
const renderCategoryFilter = () => {
  const filter = $("#category-filter");
  if (!filter) return;
  filter.innerHTML = "";

  const allBtn = el("button", {
    class: `filter-btn ${State.activeCategory === "all" ? "active" : ""}`,
    text: "All",
    onclick: () => applyCategory("all")
  });
  filter.appendChild(allBtn);

  Personalization.ALL_CATEGORIES.forEach(cat => {
    const btn = el("button", {
      class: `filter-btn ${State.activeCategory === cat ? "active" : ""}`,
      text: cat,
      onclick: () => applyCategory(cat)
    });
    filter.appendChild(btn);
  });
};

const applyCategory = (cat) => {
  State.activeCategory = cat;
  renderCategoryFilter();
  const articles = cat === "all"
    ? DEMO_ARTICLES
    : Personalization.filterByCategory(DEMO_ARTICLES, cat);
  State.totalArticles = articles.length;
  renderFeed(articles.slice(0, State.pageSize));
};

// ── Explore View ──────────────────────────────────────────────────────────────
const renderExplore = () => {
  const grid = $("#explore-grid");
  const topicFeed = $("#topic-feed");
  if (!grid) return;

  grid.innerHTML = "";
  Personalization.EXPLORE_TOPICS.forEach(topic => {
    const card = el("div", {
      class: `topic-card ${State.activeTopic === topic.id ? "active" : ""}`,
      style: `--topic-color: ${topic.color}`,
      onclick: () => selectTopic(topic),
      tabindex: "0",
      role: "button",
      "aria-label": `Explore ${topic.label}`,
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") selectTopic(topic); }
    });
    card.innerHTML = `<i data-lucide="${topic.icon}"></i><span>${topic.label}</span>`;
    grid.appendChild(card);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();

  if (topicFeed) topicFeed.hidden = !State.activeTopic;
};

const selectTopic = (topic) => {
  State.activeTopic = topic.id;
  renderExplore();

  const topicFeed = $("#topic-feed");
  const topicTitle = $("#topic-feed-title");
  const topicGrid = $("#topic-news-grid");
  if (!topicFeed || !topicGrid) return;

  topicFeed.hidden = false;
  if (topicTitle) topicTitle.textContent = topic.label;

  const articles = NewsService.getDemoArticles([], topic.query);
  topicGrid.innerHTML = "";
  articles.articles.forEach(a => topicGrid.appendChild(createCard(a)));
  if (typeof lucide !== "undefined") lucide.createIcons();
};

// ── Bookmarks View ────────────────────────────────────────────────────────────
const renderBookmarks = () => {
  const grid = $("#bookmarks-grid");
  const empty = $("#bookmarks-empty");
  if (!grid) return;

  const bookmarks = Storage.getBookmarks();
  grid.innerHTML = "";

  if (bookmarks.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  bookmarks.forEach(a => grid.appendChild(createCard(a)));
  if (typeof lucide !== "undefined") lucide.createIcons();
};

// ── History View ──────────────────────────────────────────────────────────────
const renderHistory = () => {
  const list = $("#history-list");
  const empty = $("#history-empty");
  if (!list) return;

  const history = Storage.getHistory();
  list.innerHTML = "";

  if (history.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  history.forEach(item => {
    const row = el("div", { class: "history-item" });
    const img = el("img", { alt: item.title, loading: "lazy" });
    img.src = item.image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60";
    img.onerror = () => handleImgError(img, item.category);

    const info = el("div", { class: "history-info" });
    info.append(
      el("p", { class: "history-title", text: item.title }),
      el("span", { class: "history-meta", text: `${item.source} · ${timeAgo(item.visitedAt)}` })
    );

    const openBtn = el("button", {
      class: "btn-icon",
      "aria-label": "Open article",
      onclick: () => {
        const full = DEMO_ARTICLES.find(a => a.id === item.id) || item;
        openArticle(full);
      }
    });
    openBtn.innerHTML = `<i data-lucide="external-link"></i>`;

    row.append(img, info, openBtn);
    list.appendChild(row);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();
};

// ── Search View ───────────────────────────────────────────────────────────────
const renderSearch = () => {
  renderRecentSearches();
};

const renderRecentSearches = () => {
  const container = $("#recent-searches");
  const chips = $("#search-chips");
  if (!container) return;
  const searches = Storage.getSearches();
  if (searches.length === 0) { container.hidden = true; return; }
  container.hidden = false;
  if (chips) chips.innerHTML = "";
  searches.forEach(s => {
    const chip = el("button", {
      class: "search-chip",
      text: s,
      onclick: () => { $("#search-input").value = s; executeSearch(s); }
    });
    (chips || container).appendChild(chip);
  });
};

const executeSearch = (query) => {
  if (!query.trim()) return;
  Storage.addSearch(query.trim());
  State.searchQuery = query.trim();

  const resultsSection = $("#search-results");
  const resultsGrid = $("#search-results-grid");
  const resultsTitle = $("#search-results-title");
  if (!resultsGrid) return;

  if (resultsSection) resultsSection.hidden = false;
  if (resultsTitle) resultsTitle.textContent = `Results for "${query}"`;

  const result = NewsService.getDemoArticles([], query);
  resultsGrid.innerHTML = "";

  if (result.articles.length === 0) {
    resultsGrid.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><p>No articles found for "<strong>${query}</strong>"</p><p class="empty-sub">Try different keywords or browse topics.</p></div>`;
  } else {
    result.articles.forEach(a => resultsGrid.appendChild(createCard(a)));
  }

  renderRecentSearches();
  if (typeof lucide !== "undefined") lucide.createIcons();
};

// ── Onboarding ────────────────────────────────────────────────────────────────
const showOnboarding = () => {
  const modal = $("#onboarding-modal");
  if (!modal) return;
  renderOnboardingCategories();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
};

const renderOnboardingCategories = () => {
  const grid = $("#onboarding-cats");
  if (!grid) return;
  grid.innerHTML = "";
  const prefs = Storage.getPreferences();
  const selected = prefs.categories || [];

  Personalization.ALL_CATEGORIES.forEach(cat => {
    const btn = el("button", {
      class: `cat-btn ${selected.includes(cat) ? "selected" : ""}`,
      text: cat,
      onclick: () => {
        btn.classList.toggle("selected");
      }
    });
    grid.appendChild(btn);
  });
};

const saveOnboarding = () => {
  // Scope strictly to the onboarding modal to avoid picking up prefs panel buttons
  const selected = $$("#onboarding-cats .cat-btn.selected").map(b => b.textContent);
  Storage.setPreferences({ categories: selected });
  Storage.setOnboarded(true);
  $("#onboarding-modal").hidden = true;
  document.body.style.overflow = "";
  setView("home");
};

// ── Theme ─────────────────────────────────────────────────────────────────────
const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  Storage.setTheme(theme);
  const icon = $("#theme-icon");
  if (icon) icon.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
  if (typeof lucide !== "undefined") lucide.createIcons();
};

const toggleTheme = () => {
  const current = Storage.getTheme();
  applyTheme(current === "dark" ? "light" : "dark");
};

// ── Load More ─────────────────────────────────────────────────────────────────
const loadMore = () => {
  State.page += 1;
  const prefs = Storage.getPreferences();
  const cats = prefs.categories || [];

  let articles;
  if (State.view === "latest") {
    const sorted = [...DEMO_ARTICLES].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    articles = sorted.slice((State.page - 1) * State.pageSize, State.page * State.pageSize);
  } else if (State.activeCategory !== "all") {
    const filtered = Personalization.filterByCategory(DEMO_ARTICLES, State.activeCategory);
    articles = filtered.slice((State.page - 1) * State.pageSize, State.page * State.pageSize);
  } else {
    const result = NewsService.getDemoArticles(cats, "", State.page);
    articles = result.articles;
  }

  renderFeed(articles, true);
};

// ── Init ──────────────────────────────────────────────────────────────────────
const init = () => {
  // Apply saved theme
  applyTheme(Storage.getTheme());

  // Render category filter
  renderCategoryFilter();

  // Wire nav links
  $$(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setView(link.dataset.view);
    });
  });

  // Mobile nav toggle
  $("#nav-toggle")?.addEventListener("click", () => {
    $("#nav-menu")?.classList.toggle("open");
  });

  // Theme toggle
  $("#theme-toggle")?.addEventListener("click", toggleTheme);

  // Modal close
  $("#modal-close")?.addEventListener("click", closeModal);
  $("#article-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Keyboard close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      if ($("#onboarding-modal") && !$("#onboarding-modal").hidden) {
        $("#onboarding-modal").hidden = true;
        document.body.style.overflow = "";
      }
    }
  });

  // Onboarding save
  $("#onboarding-save")?.addEventListener("click", saveOnboarding);
  $("#onboarding-skip")?.addEventListener("click", () => {
    Storage.setOnboarded(true);
    $("#onboarding-modal").hidden = true;
    document.body.style.overflow = "";
    setView("home");
  });

  // Settings button opens onboarding/preferences
  $("#edit-prefs-btn")?.addEventListener("click", showOnboarding);

  // Load more
  $("#load-more-btn")?.addEventListener("click", loadMore);

  // Refresh
  $("#refresh-btn")?.addEventListener("click", () => {
    State.page = 1;
    loadArticles();
  });

  // Search
  const searchInput = $("#search-input");
  const searchBtn = $("#search-btn");
  const clearSearchBtn = $("#clear-search-btn");

  searchBtn?.addEventListener("click", () => {
    if (searchInput?.value.trim()) executeSearch(searchInput.value.trim());
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) executeSearch(searchInput.value.trim());
  });

  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    const resultsSection = $("#search-results");
    if (resultsSection) resultsSection.hidden = true;
  });

  // Clear history
  $("#clear-history-btn")?.addEventListener("click", () => {
    Storage.clearHistory();
    renderHistory();
  });

  // Clear searches
  $("#clear-searches-btn")?.addEventListener("click", () => {
    Storage.clearSearches();
    renderRecentSearches();
  });

  // Onboarding backdrop click
  $("#onboarding-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      Storage.setOnboarded(true);
      $("#onboarding-modal").hidden = true;
      document.body.style.overflow = "";
      if (State.view === "home") return;
      setView("home");
    }
  });

  // Show onboarding if first visit, otherwise go home
  if (!Storage.isOnboarded()) {
    showOnboarding();
  } else {
    setView("home");
  }
};

document.addEventListener("DOMContentLoaded", init);
