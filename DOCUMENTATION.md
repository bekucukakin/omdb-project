# OMDB Movie Search — Technical Documentation

**Live URL:** https://bekucukakin.github.io/omdb-project/  
**Author:** bekucukakin  
**Stack:** Vanilla HTML5 / CSS3 / JavaScript ES6 Modules  
**External API:** [OMDb API](https://www.omdbapi.com/)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Module Breakdown](#4-module-breakdown)
5. [Data Flow](#5-data-flow)
6. [API Integration](#6-api-integration)
7. [State Management](#7-state-management)
8. [UI & Accessibility](#8-ui--accessibility)
9. [Error Handling](#9-error-handling)
10. [Responsive Design](#10-responsive-design)
11. [Performance](#11-performance)
12. [Configuration](#12-configuration)
13. [Deployment](#13-deployment)

---

## 1. Project Overview

**Movie Search** is a client-side Single Page Application (SPA) that allows users to search for movies, TV series, and episodes via the OMDb API and inspect detailed metadata in a modal dialog.

### Key Capabilities

| Capability | Detail |
|---|---|
| Full-text search | Query by movie title, up to 120 characters |
| Type filtering | All / Movie / Series / Episode |
| Year filtering | Any 4-digit year between 1895–2100 |
| Client-side sorting | Relevance / Newest first / Oldest first / A→Z |
| Detail view | Full cast, plot, runtime, IMDb rating in a modal |
| State persistence | LocalStorage caches last query and full result set |
| Accessibility | ARIA live regions, keyboard navigation, semantic HTML |
| Responsive layout | 1–4 column grid adapting to viewport width |

### Design Philosophy

- **Zero dependencies.** No framework, no bundler, no npm. A single `<script type="module">` bootstraps the entire app.
- **Separation of concerns.** API client, storage, view layer, and orchestration logic are each isolated in their own module.
- **Fail gracefully.** Every error path produces a classified error code and a user-visible recovery action (retry button for network errors, config check for missing API key).

---

## 2. Architecture

```
┌─────────────────────────────────────────┐
│                Browser                  │
│                                         │
│  index.html  ──loads──►  js/app.js      │
│                              │          │
│              ┌───────────────┼──────────┤
│              │               │          │
│         js/api.js      js/ui.js         │
│              │               │          │
│         js/config.js   DOM mutations    │
│              │                          │
│         js/storage.js                   │
│              │                          │
│          LocalStorage                   │
└──────────────┼──────────────────────────┘
               │ HTTPS
               ▼
        https://www.omdbapi.com/
```

### Layer Responsibilities

| Layer | File | Responsibility |
|---|---|---|
| Entry / Orchestrator | `app.js` | Wires modules together, owns application state, handles all events |
| API Client | `api.js` | HTTP requests, URL construction, error classification |
| View | `ui.js` | DOM creation, rendering, loading spinner, modal control |
| Storage | `storage.js` | LocalStorage read/write with structured keys |
| Configuration | `config.js` | API key and base URL constants |
| Markup | `index.html` | Semantic HTML shell, zero inline JS |
| Styles | `css/style.css` | Dark theme, CSS custom properties, responsive grid |

---

## 3. Directory Structure

```
omdb-project/
├── index.html            # Application shell (86 lines)
├── DOCUMENTATION.md      # This file
├── README.md             # Setup and quick-start guide
├── css/
│   └── style.css         # All styles — dark theme, grid, components (579 lines)
└── js/
    ├── app.js            # Main orchestrator (327 lines)
    ├── api.js            # OMDb API client (76 lines)
    ├── config.js         # Constants (4 lines)
    ├── storage.js        # LocalStorage wrapper (63 lines)
    └── ui.js             # View/DOM layer (242 lines)
```

Total JavaScript: ~712 lines. No compiled output, no `node_modules`.

---

## 4. Module Breakdown

### 4.1 `js/config.js`

Exports two named constants consumed by `api.js`:

```js
export const OMDB_API_KEY  = '905e16c6';
export const OMDB_BASE_URL = 'https://www.omdbapi.com/';
```

> Replace `OMDB_API_KEY` with your own key from https://www.omdbapi.com/apikey.aspx for production use. The demo key has per-day and per-second rate limits.

---

### 4.2 `js/api.js`

Provides a factory function `createOmdbClient()` that returns two async methods.

#### `ApiError` class

```
ApiError extends Error
  .message  — human-readable description
  .code     — machine-readable enum (see §9)
  .cause    — original thrown value (if any)
```

#### `searchMovies(query, { type, year })`

- Validates: non-empty query, `type` in `{movie, series, episode}`, `year` matches `/^\d{4}$/`
- Constructs URL via `buildUrl()` (omits null/empty parameters)
- Endpoint: `GET /?s=<query>&type=<type>&y=<year>&apikey=<key>`
- Returns the parsed JSON body on success
- Throws `ApiError` on network failure, HTTP error, bad JSON, or `Response: "False"`

#### `getMovieDetails(imdbId)`

- Endpoint: `GET /?i=<imdbId>&plot=full&apikey=<key>`
- Returns the full movie object on success
- Same error-handling contract as `searchMovies`

---

### 4.3 `js/storage.js`

Thin wrapper around `window.localStorage`. All functions are try-caught so private browsing mode and storage-full conditions never crash the app.

| Function | LocalStorage key | Purpose |
|---|---|---|
| `saveLastSearch(query)` | `omdb:lastQuery` | Persist the search term |
| `getLastSearch()` | `omdb:lastQuery` | Retrieve last term |
| `saveResults(payload)` | `omdb:lastResultsPayload` | Persist full result payload (query + filters + array) |
| `getResults()` | `omdb:lastResultsPayload` | Retrieve and structurally validate payload |
| `clearStoredResults()` | `omdb:lastResultsPayload` | Remove cached results |

The `getResults()` validator checks that the stored object has `query`, `type`, `year`, and a non-empty `search` array before returning it, preventing stale or corrupt cache from being rendered.

---

### 4.4 `js/ui.js`

Pure view layer — **no API calls, no storage access.** Returned from factory `createUi(elements)` where `elements` is a bag of pre-queried DOM references.

| Method | What it renders |
|---|---|
| `renderMovieCards(movies)` | Responsive grid of clickable `<article>` cards |
| `renderMovieDetail(movie)` | Modal inner content: poster + `<dl>` of metadata |
| `showError(message, opts)` | Error banner with colored badge and optional retry button |
| `clearError()` | Removes error banner from DOM |
| `showLoading()` | Increments loading counter, shows spinner |
| `hideLoading()` | Decrements loading counter, hides spinner when counter reaches 0 |
| `showModal()` | Removes `hidden`, sets `document.body` overflow hidden |
| `hideModal()` | Adds `hidden` back, restores overflow |
| `setPickHandler(fn)` | Registers the card-click callback in `app.js` |
| `clearResults()` | Empties the results container |

**Loading counter pattern:** `showLoading` / `hideLoading` use a reference counter so nested async operations (search + auto-detail) do not prematurely hide the spinner.

---

### 4.5 `js/app.js`

The orchestrator. Owns all mutable state and wires modules together.

#### Application State

| Variable | Type | Purpose |
|---|---|---|
| `client` | Object | OMDb API client instance |
| `searchInFlight` | Boolean | Prevents concurrent search requests |
| `detailInFlight` | Boolean | Prevents concurrent detail requests |
| `lastResults` | Array | Cached search result array for client-side sort |
| `currentSort` | String | Active sort key (`''`, `'year-desc'`, `'year-asc'`, `'title-asc'`) |

#### Core Functions

**`runSearch(rawQuery)`**
1. Trim and validate query
2. Read type and year from filter DOM elements
3. `showLoading()`
4. Call `client.searchMovies(query, { type, year })`
5. `saveResults()` to LocalStorage
6. `sortResults()` on result array
7. `renderMovieCards()`
8. `updateActiveFilters()` (render filter chips)
9. On error: `showError()` with optional retry button

**`openDetail(imdbId)`**
1. `showModal()` with spinner
2. Call `client.getMovieDetails(imdbId)`
3. `renderMovieDetail()`
4. On error: show error inside modal with retry

**`sortResults(list)`** — pure client-side transform, no API call:
- `year-desc`: parse year string → sort descending
- `year-asc`: parse year string → sort ascending
- `title-asc`: `localeCompare` on title

**`bootstrapFromStorage()`** — runs once on `DOMContentLoaded`:
1. Check `getResults()` — if valid, restore input + filters + render cards
2. Else check `getLastSearch()` — if present, restore input + `runSearch()`
3. Else render empty state

---

## 5. Data Flow

```
User types query → submits form
        │
        ▼
app.js: runSearch(rawQuery)
        │
        ├── validate (empty query, year format)
        ├── showLoading()
        │
        ▼
api.js: searchMovies(query, {type, year})
        │
        ├── buildUrl() → "https://www.omdbapi.com/?s=...&apikey=..."
        ├── fetch(url)
        ├── response.json()
        └── throw ApiError on any failure
        │
        ▼
app.js receives { Search: [...], totalResults, Response }
        │
        ├── storage.js: saveResults(payload)
        ├── sortResults(data.Search)
        │
        ▼
ui.js: renderMovieCards(sortedMovies)
        │
        └── DOM: <article> grid with posters and titles
        │
User clicks a card
        │
        ▼
app.js: openDetail(imdbId)
        │
        ▼
api.js: getMovieDetails(imdbId)
        │
        ▼
ui.js: renderMovieDetail(movie) → showModal()
        │
User presses Escape / clicks backdrop / clicks ×
        │
        ▼
ui.js: hideModal()
```

---

## 6. API Integration

**Base URL:** `https://www.omdbapi.com/`

### Search Endpoint

```
GET /?s={title}&type={type}&y={year}&apikey={key}
```

**Success response:**
```json
{
  "Search": [
    {
      "Title": "Inception",
      "Year": "2010",
      "imdbID": "tt1375666",
      "Type": "movie",
      "Poster": "https://..."
    }
  ],
  "totalResults": "1",
  "Response": "True"
}
```

**Failure response (HTTP 200, body signals error):**
```json
{ "Response": "False", "Error": "Movie not found!" }
```

### Detail Endpoint

```
GET /?i={imdbID}&plot=full&apikey={key}
```

Returns a flat object with fields: `Title`, `Year`, `Genre`, `Director`, `Actors`, `Runtime`, `imdbRating`, `Plot`, `Poster`, `Type`, etc.

### Error Classification

OMDb always returns HTTP 200 regardless of the application-level result. The client must inspect `Response` and `Error` fields manually — handled in `api.js`.

---

## 7. State Management

This application uses **two tiers of state**:

### In-Memory (runtime)

Held in `app.js` module scope. Lost on page refresh. Used for:
- Preventing concurrent requests (`searchInFlight`, `detailInFlight`)
- Enabling client-side sort without re-fetching (`lastResults`, `currentSort`)

### Persisted (LocalStorage)

Managed by `storage.js`. Survives page refresh. Used for:
- Restoring the last search query into the input field
- Restoring the complete result set including filter parameters so the UI looks identical after reload

**Cache invalidation:** The stored payload includes `query`, `type`, and `year`. On boot, `bootstrapFromStorage()` compares the stored filter values against what it restores into the DOM, ensuring the rendered results always match the visible filter state.

---

## 8. UI & Accessibility

### Semantic HTML

```
<header>   — logo, search form, filter bar
<main>     — status region, results meta, results grid
<footer>   — API attribution
<dialog>   — movie detail modal (implemented as div with role="dialog")
```

### ARIA

| Element | ARIA attribute | Purpose |
|---|---|---|
| `#status-region` | `aria-live="polite"` | Announces search results and errors to screen readers |
| `#results` | `role="region"` + `aria-label` | Landmarks the results area |
| Modal | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` | Proper modal semantics |
| Filter bar | `role="group"` + `aria-label` | Groups filter controls |
| Search label | `class="visually-hidden"` | Visible only to assistive tech |

### Keyboard Navigation

- `Enter` / `Space` on a movie card → opens detail modal
- `Escape` → closes modal
- All interactive elements are natively focusable

---

## 9. Error Handling

### Error Code Taxonomy

| Code | Trigger | UI treatment |
|---|---|---|
| `EMPTY_QUERY` | User submitted blank input | Inline validation message |
| `NETWORK` | `fetch()` threw (offline, DNS failure) | Yellow badge + retry button |
| `HTTP` | Server returned non-200 status | Red badge, no retry |
| `OMDB_FALSE` | API returned `Response: "False"` | Red badge (e.g. "Movie not found!") |
| `MISSING_KEY` | `OMDB_API_KEY` is empty | Purple badge, form disabled |
| `BAD_JSON` | `response.json()` threw | Red badge |

### Retry Mechanism

Only `NETWORK` errors display a retry button. Clicking it re-invokes `runSearch()` or `openDetail()` with the same arguments captured via closure.

---

## 10. Responsive Design

All layout is CSS-only — no JavaScript reads or sets widths.

### Grid Breakpoints

| Viewport | Columns |
|---|---|
| < 600px | 1 |
| ≥ 600px | 2 |
| ≥ 900px | 3 |
| ≥ 1200px | 4 |

### Design Tokens (CSS Custom Properties)

```css
--color-bg:        #0f1117   /* page background */
--color-surface:   #1a1d27   /* card / modal surface */
--color-accent:    #3d8bfd   /* primary blue */
--color-text:      #e8ecf1   /* primary text */
--color-muted:     #8b95a1   /* secondary text */
--color-danger:    #f87171   /* errors */
--radius:          10px
--shadow:          0 8px 24px rgba(0,0,0,0.35)
```

---

## 11. Performance

| Technique | Implementation |
|---|---|
| Lazy image loading | `<img loading="lazy">` on all poster images |
| No duplicate requests | Boolean guards (`searchInFlight`, `detailInFlight`) |
| Client-side sort | Sort re-uses `lastResults` — zero network requests |
| LocalStorage cache | Full result set cached — zero network on reload |
| No dependencies | No framework overhead; total JS ~712 lines |
| CSS layout | Grid and Flexbox; no layout JavaScript |

---

## 12. Configuration

To run against your own OMDb API key, edit one file:

```js
// js/config.js
export const OMDB_API_KEY  = 'YOUR_KEY_HERE';
export const OMDB_BASE_URL = 'https://www.omdbapi.com/';
```

Get a free key at: https://www.omdbapi.com/apikey.aspx

No build step is required. Open `index.html` directly in a browser or serve via any static file server:

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

---

## 13. Deployment

The application is deployed to **GitHub Pages** and served as a static site.

**Live URL:** https://bekucukakin.github.io/omdb-project/

### How to deploy your own fork

1. Fork the repository on GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, root folder `/`
4. GitHub Pages will publish to `https://<username>.github.io/<repo-name>/`

No CI/CD pipeline is required. Every push to `main` automatically triggers a Pages rebuild.

---

*Documentation generated 2026-04-26.*
