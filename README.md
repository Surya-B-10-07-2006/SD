# NewsPulse AI — Personalized News Platform

A modern, responsive, editorial-style news platform built with HTML5, CSS3, and vanilla JavaScript.

---

## Features

- Personalized feed ranked by your selected interests
- Daily briefing with top stories at a glance
- Category filtering across 12 topics
- Smart search with recent search history
- Explore trending topics (AI, Climate, Space, Cybersecurity, etc.)
- Bookmark articles and revisit them anytime
- Full reading history with clear action
- Article reader with related stories
- Light / dark theme toggle
- Fully responsive (desktop, tablet, mobile)
- Works in demo mode with no API key required

---

## Quick Start (Demo Mode — No API Key Needed)

1. Open `index.html` directly in your browser, **or** use a local server:

```bash
# Python
python -m http.server 3000

# Node (npx)
npx serve .
```

2. Visit `http://localhost:3000`
3. Select your interests in the onboarding screen and start reading.

> All content in demo mode is clearly labeled as **sample content** and does not represent live news.

---

## Live News Setup (Optional)

To load real news, you need a [NewsAPI](https://newsapi.org/register) key (free tier available).

### Step 1 — Configure the proxy server

```bash
cp .env.example .env
# Edit .env and set NEWS_API_KEY=your_key_here
```

### Step 2 — Install dependencies and start the proxy

```bash
npm install
npm start
# Proxy runs at http://localhost:3001
```

### Step 3 — Enable the proxy in the frontend

In `news-service.js`, change:

```js
const USE_PROXY = false;
// to:
const USE_PROXY = true;
```

Reload `index.html` — live news will now load from NewsAPI via the proxy.

> **Security note:** The API key is stored only in `.env` on the server. It is never exposed in frontend JavaScript. Never commit `.env` to version control.

---

## File Structure

```
newspulse/
├── index.html          # App shell and all view sections
├── styles.css          # Design tokens, components, responsive layout
├── app.js              # UI logic, view routing, event wiring
├── news-service.js     # API fetching, normalization, demo fallback
├── personalization.js  # Scoring engine, category/topic definitions
├── storage.js          # LocalStorage wrapper (prefs, bookmarks, history)
├── data/
│   └── demo-news.js    # 16 sample articles used when no API is configured
├── server.js           # Minimal Express proxy (only needed for live news)
├── package.json        # Server dependencies
├── .env.example        # Environment variable template
└── README.md
```

---

## Architecture

| Layer | File | Responsibility |
|---|---|---|
| UI Shell | `index.html` | Semantic markup, all view containers, modals |
| Styles | `styles.css` | CSS custom properties, component styles, dark mode, responsive |
| App Logic | `app.js` | View routing, card rendering, event handling, state |
| Data Layer | `news-service.js` | Fetch, normalize, fallback to demo data |
| Personalization | `personalization.js` | Category scoring, topic definitions, filtering |
| Persistence | `storage.js` | LocalStorage CRUD for prefs, bookmarks, history, searches |
| Demo Data | `data/demo-news.js` | 16 realistic sample articles across all categories |
| Proxy | `server.js` | Express server that proxies NewsAPI to hide the API key |

### Personalization Scoring (transparent rules)

Each article receives a score before rendering:

- **+10** — article category matches a user-selected interest
- **+3** — article category matches a bookmarked article's category
- **+0–5** — recency bonus (articles under 6 hours old score higher)

Articles are sorted by score descending. No machine learning is used.

---

## Testing Checklist

- [ ] Onboarding modal appears on first visit; interests can be selected and saved
- [ ] Skip onboarding works; home feed loads with all articles
- [ ] Home feed shows personalized order based on selected interests
- [ ] For You view shows interest-ranked feed with welcome section
- [ ] Latest view shows articles sorted newest first, no welcome/briefing
- [ ] Category filter buttons filter the feed correctly; "All" resets it
- [ ] Load More appends additional articles
- [ ] Bookmark button saves article; icon changes to filled state
- [ ] Bookmarks view shows saved articles; removing bookmark updates the view
- [ ] Reading history records opened articles with timestamps
- [ ] Clear History removes all history entries
- [ ] Search returns matching articles; empty query shows no results message
- [ ] Recent searches appear as chips; clicking a chip re-runs the search
- [ ] Clear searches removes all chips
- [ ] Explore topics grid renders; clicking a topic loads related articles
- [ ] Article modal opens with title, description, source, date, and image
- [ ] "Read Full Article" link opens original URL in a new tab
- [ ] Save Article button in modal toggles bookmark state
- [ ] Related stories appear in the modal for articles with matching categories
- [ ] Close modal via X button, backdrop click, or Escape key
- [ ] Light/dark theme toggle persists across page reloads
- [ ] Edit Preferences (settings icon) opens panel; saving updates the feed
- [ ] Reset All clears all data and shows onboarding again
- [ ] Demo banner is visible when showing sample content
- [ ] Layout is usable on mobile (320px+), tablet, and desktop
- [ ] Mobile nav hamburger opens and closes correctly
- [ ] No console errors on initial load or during normal use
