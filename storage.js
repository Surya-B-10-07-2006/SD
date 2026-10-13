// storage.js — LocalStorage wrapper for all persistence needs

const Storage = (() => {
  const KEYS = {
    PREFERENCES: "np_preferences",
    BOOKMARKS: "np_bookmarks",
    HISTORY: "np_history",
    SEARCHES: "np_searches",
    THEME: "np_theme",
    ONBOARDED: "np_onboarded"
  };

  const get = (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Storage write failed:", e);
    }
  };

  const remove = (key) => localStorage.removeItem(key);

  // Preferences: { categories: [], topics: [] }
  const getPreferences = () => get(KEYS.PREFERENCES, { categories: [], topics: [] });
  const setPreferences = (prefs) => set(KEYS.PREFERENCES, prefs);

  // Bookmarks: array of article objects
  const getBookmarks = () => get(KEYS.BOOKMARKS, []);
  const addBookmark = (article) => {
    const bookmarks = getBookmarks();
    if (!bookmarks.find(b => b.id === article.id)) {
      bookmarks.unshift(article);
      set(KEYS.BOOKMARKS, bookmarks);
    }
  };
  const removeBookmark = (id) => {
    set(KEYS.BOOKMARKS, getBookmarks().filter(b => b.id !== id));
  };
  const isBookmarked = (id) => getBookmarks().some(b => b.id === id);

  // Reading history: array of { id, title, url, source, category, visitedAt }
  const getHistory = () => get(KEYS.HISTORY, []);
  const addToHistory = (article) => {
    let history = getHistory().filter(h => h.id !== article.id);
    history.unshift({
      id: article.id, title: article.title, url: article.url,
      source: article.source, category: article.category,
      image: article.image, visitedAt: new Date().toISOString()
    });
    set(KEYS.HISTORY, history.slice(0, 50)); // keep last 50
  };
  const clearHistory = () => remove(KEYS.HISTORY);

  // Recent searches: array of strings
  const getSearches = () => get(KEYS.SEARCHES, []);
  const addSearch = (query) => {
    if (!query.trim()) return;
    const searches = getSearches().filter(s => s !== query);
    searches.unshift(query);
    set(KEYS.SEARCHES, searches.slice(0, 10));
  };
  const clearSearches = () => remove(KEYS.SEARCHES);

  // Theme
  const getTheme = () => get(KEYS.THEME, "light");
  const setTheme = (theme) => set(KEYS.THEME, theme);

  // Onboarding
  const isOnboarded = () => get(KEYS.ONBOARDED, false);
  const setOnboarded = (val) => set(KEYS.ONBOARDED, val);

  // Reset all personalization data
  const resetAll = () => {
    [KEYS.PREFERENCES, KEYS.BOOKMARKS, KEYS.HISTORY, KEYS.SEARCHES, KEYS.ONBOARDED].forEach(remove);
  };

  return {
    getPreferences, setPreferences,
    getBookmarks, addBookmark, removeBookmark, isBookmarked,
    getHistory, addToHistory, clearHistory,
    getSearches, addSearch, clearSearches,
    getTheme, setTheme,
    isOnboarded, setOnboarded,
    resetAll
  };
})();
