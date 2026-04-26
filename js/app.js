import { OMDB_API_KEY, OMDB_BASE_URL } from './config.js';
import { createOmdbClient, ApiError } from './api.js';
import * as storage from './storage.js';
import { createUi } from './ui.js';

function getEl(id) {
  const n = document.getElementById(id);
  if (!n) throw new Error(`Missing DOM node: #${id}`);
  return n;
}

function readYearInput(yearInput) {
  const raw = String(yearInput.value || '').trim();
  if (!raw) return { year: '', error: null };
  if (!/^\d{4}$/.test(raw)) {
    return { year: '', error: 'Year must be four digits, or leave it blank.' };
  }
  const n = parseInt(raw, 10);
  if (n < 1895 || n > 2100) {
    return { year: '', error: 'Year must be between 1895 and 2100.' };
  }
  return { year: raw, error: null };
}

const TYPE_LABELS = { movie: 'Movie', series: 'Series', episode: 'Episode' };
function formatType(val) {
  return TYPE_LABELS[String(val).toLowerCase()] || val;
}

const SORT_LABELS = { 'year-desc': 'Newest first', 'year-asc': 'Oldest first', 'title-asc': 'A → Z' };

function parseYear(str) {
  const m = String(str || '').match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}

function init() {
  const form          = getEl('search-form');
  const input         = getEl('search-input');
  const typeSelect    = getEl('filter-type');
  const yearInput     = getEl('filter-year');
  const sortEl        = getEl('filter-sort');
  const resultsEl     = getEl('results');
  const statusEl      = getEl('status-region');
  const modalEl       = getEl('modal');
  const modalBodyEl   = getEl('modal-body');
  const activeFiltersEl = getEl('active-filters');
  const resultsMetaEl   = getEl('results-meta');
  const resultsCountEl  = getEl('results-count');

  const ui = createUi({ resultsEl, statusEl, modalEl, modalBodyEl });
  let client;
  let searchInFlight = false;
  let detailInFlight = false;
  let lastResults = [];
  let currentSort = '';

  try {
    client = createOmdbClient({ apiKey: OMDB_API_KEY, baseUrl: OMDB_BASE_URL });
  } catch (e) {
    const code = e instanceof ApiError ? e.code : undefined;
    ui.showError(e instanceof ApiError ? e.message : 'Configuration error.', { code });
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', 'true');
    input.setAttribute('disabled', 'true');
    typeSelect.setAttribute('disabled', 'true');
    yearInput.setAttribute('disabled', 'true');
    sortEl.setAttribute('disabled', 'true');
    return;
  }

  // ── Sorting ────────────────────────────────────────────────────────────────

  function sortResults(list) {
    if (!currentSort) return list;
    const arr = [...list];
    if (currentSort === 'year-desc') arr.sort((a, b) => parseYear(b.Year) - parseYear(a.Year));
    if (currentSort === 'year-asc')  arr.sort((a, b) => parseYear(a.Year) - parseYear(b.Year));
    if (currentSort === 'title-asc') arr.sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
    return arr;
  }

  // ── Results meta bar ───────────────────────────────────────────────────────

  function setResultMeta(count) {
    if (count === null || count === undefined) {
      resultsMetaEl.hidden = true;
      return;
    }
    resultsMetaEl.hidden = false;
    if (count === 0) {
      resultsCountEl.innerHTML = '';
    } else {
      resultsCountEl.innerHTML = `<strong>${count}</strong> result${count !== 1 ? 's' : ''} found`;
    }
  }

  // ── Active filter chips ────────────────────────────────────────────────────

  function updateActiveFilters() {
    while (activeFiltersEl.firstChild) activeFiltersEl.removeChild(activeFiltersEl.firstChild);

    const type = typeSelect.value;
    const year = yearInput.value.trim();
    const sort = sortEl.value;

    const chips = [];
    const q = String(input.value || '').trim();

    if (type) {
      chips.push({
        label: `Type: ${formatType(type)}`,
        remove() { typeSelect.value = ''; updateActiveFilters(); if (q) runSearch(q); },
      });
    }
    if (year) {
      chips.push({
        label: `Year: ${year}`,
        remove() { yearInput.value = ''; updateActiveFilters(); if (q) runSearch(q); },
      });
    }
    if (sort) {
      chips.push({
        label: `Sort: ${SORT_LABELS[sort] || sort}`,
        remove() {
          sortEl.value = '';
          currentSort = '';
          updateActiveFilters();
          if (lastResults.length) ui.renderMovieCards(lastResults);
        },
      });
    }

    if (chips.length === 0) {
      activeFiltersEl.hidden = true;
      return;
    }

    activeFiltersEl.hidden = false;

    chips.forEach(({ label, remove }) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'filter-chip__remove';
      removeBtn.setAttribute('aria-label', `Remove filter: ${label}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', remove);

      chip.appendChild(labelSpan);
      chip.appendChild(removeBtn);
      activeFiltersEl.appendChild(chip);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'filter-chip filter-chip--clear';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearAllFilters);
    activeFiltersEl.appendChild(clearBtn);
  }

  function clearAllFilters() {
    typeSelect.value = '';
    yearInput.value = '';
    sortEl.value = '';
    currentSort = '';
    updateActiveFilters();
    const q = String(input.value || '').trim();
    if (!q) return;
    runSearch(q);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async function runSearch(rawQuery) {
    const query = String(rawQuery || '').trim();
    ui.clearError();
    if (!query) {
      ui.showError('Please enter a search term.');
      return;
    }

    const { year, error: yearErr } = readYearInput(yearInput);
    if (yearErr) {
      ui.showError(yearErr);
      return;
    }

    if (searchInFlight) return;
    searchInFlight = true;

    const type = String(typeSelect.value || '').trim();

    ui.showLoading();
    ui.clearResults();
    setResultMeta(null);
    storage.saveLastSearch(query);

    try {
      const data = await client.searchMovies(query, { type, year });
      const list = Array.isArray(data.Search) ? data.Search : [];
      lastResults = list;
      storage.saveResults({ query, type, year, search: list });
      ui.hideLoading();
      ui.renderMovieCards(sortResults(list));
      setResultMeta(list.length);
      updateActiveFilters();
    } catch (e) {
      lastResults = [];
      ui.hideLoading();
      const isApi = e instanceof ApiError;
      const code  = isApi ? e.code : undefined;
      const msg   = isApi ? e.message : 'Something went wrong. Please try again.';
      const onRetry = code === 'NETWORK' ? () => runSearch(rawQuery) : undefined;
      ui.showError(msg, { code, onRetry });
      storage.clearStoredResults();
      setResultMeta(null);
      updateActiveFilters();
    } finally {
      searchInFlight = false;
    }
  }

  // ── Detail modal ──────────────────────────────────────────────────────────

  async function openDetail(imdbId) {
    if (detailInFlight) return;
    detailInFlight = true;
    ui.showLoading();
    try {
      const movie = await client.getMovieDetails(imdbId);
      ui.hideLoading();
      ui.renderMovieDetail(movie);
      ui.showModal();
    } catch (e) {
      ui.hideLoading();
      const isApi = e instanceof ApiError;
      const code  = isApi ? e.code : undefined;
      const msg   = isApi ? e.message : 'Could not load details.';
      const onRetry = code === 'NETWORK' ? () => openDetail(imdbId) : undefined;
      ui.showError(msg, { code, onRetry });
    } finally {
      detailInFlight = false;
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  ui.setPickHandler((imdbId) => { openDetail(imdbId); });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    runSearch(input.value);
  });

  typeSelect.addEventListener('change', () => {
    updateActiveFilters();
    if (!String(input.value || '').trim()) return;
    runSearch(input.value);
  });

  yearInput.addEventListener('change', () => {
    updateActiveFilters();
    if (!String(input.value || '').trim()) return;
    runSearch(input.value);
  });

  sortEl.addEventListener('change', () => {
    currentSort = sortEl.value;
    updateActiveFilters();
    if (lastResults.length > 0) {
      ui.renderMovieCards(sortResults(lastResults));
    }
  });

  modalEl.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t && 'closest' in t && t.closest('[data-close-modal]')) {
      ui.hideModal();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !modalEl.hidden) {
      ui.hideModal();
    }
  });

  // ── Bootstrap from cache ──────────────────────────────────────────────────

  function applyCachedFilters(cached) {
    typeSelect.value = cached.type || '';
    yearInput.value  = cached.year || '';
  }

  function bootstrapFromStorage() {
    const cached = storage.getResults();
    if (cached && cached.search.length > 0) {
      input.value = cached.query;
      applyCachedFilters(cached);
      lastResults = cached.search;
      ui.renderMovieCards(sortResults(cached.search));
      setResultMeta(cached.search.length);
      updateActiveFilters();
      return;
    }
    const last = storage.getLastSearch();
    if (last) {
      input.value = last;
      runSearch(last);
    }
  }

  bootstrapFromStorage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
