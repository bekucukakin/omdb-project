// Görünüm katmanı: sadece DOM manipülasyonu, fetch veya localStorage yok.

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function posterSrc(url) {
  if (!url || url === 'N/A') return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function formatTypeLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'movie' || t === 'series' || t === 'episode') {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return type || '';
}

export function createUi({ resultsEl, statusEl, modalEl, modalBodyEl }) {
  let loadingCount = 0;
  let onPickMovie = () => {};

  function renderMovieCards(movies) {
    clearNode(resultsEl);
    if (!movies || movies.length === 0) {
      showError('No titles matched your search. Try different keywords or adjust the filters.', { code: 'OMDB_FALSE' });
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    for (const movie of movies) {
      const card = document.createElement('article');
      card.className = 'movie-card';
      card.tabIndex = 0;
      card.dataset.imdbId = movie.imdbID;

      const thumb = document.createElement('div');
      thumb.className = 'movie-card__thumb';
      const src = posterSrc(movie.Poster);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.textContent = 'No poster';
      }

      const body = document.createElement('div');
      body.className = 'movie-card__body';

      const title = document.createElement('h2');
      title.className = 'movie-card__title';
      title.textContent = movie.Title || '—';

      const meta = document.createElement('p');
      meta.className = 'movie-card__meta';
      meta.textContent = [movie.Year || '—', formatTypeLabel(movie.Type)].filter(Boolean).join(' · ');

      body.appendChild(title);
      body.appendChild(meta);
      card.appendChild(thumb);
      card.appendChild(body);

      const activate = () => onPickMovie(movie.imdbID);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });

      grid.appendChild(card);
    }

    resultsEl.appendChild(grid);
  }

  function fieldRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value && String(value).trim() ? String(value) : '—';
    row.appendChild(dt);
    row.appendChild(dd);
    return row;
  }

  function renderMovieDetail(movie) {
    clearNode(modalBodyEl);

    const layout = document.createElement('div');
    layout.className = 'detail-layout';

    const aside = document.createElement('aside');
    aside.className = 'detail-aside';
    const psrc = posterSrc(movie.Poster);
    if (psrc) {
      const img = document.createElement('img');
      img.className = 'detail-poster';
      img.src = psrc;
      img.alt = movie.Title ? `Poster for ${movie.Title}` : '';
      aside.appendChild(img);
    }

    const main = document.createElement('div');
    main.className = 'detail-main';

    const h = document.createElement('h2');
    h.id = 'modal-title';
    h.className = 'detail-title';
    h.textContent = movie.Title || 'Title';

    const dl = document.createElement('dl');
    dl.className = 'detail-list';
    dl.appendChild(fieldRow('Year', movie.Year));
    dl.appendChild(fieldRow('Genre', movie.Genre));
    dl.appendChild(fieldRow('Director', movie.Director));
    dl.appendChild(fieldRow('Cast', movie.Actors));
    dl.appendChild(fieldRow('Runtime', movie.Runtime));
    dl.appendChild(fieldRow('IMDb rating', movie.imdbRating));
    dl.appendChild(fieldRow('Plot', movie.Plot));

    main.appendChild(h);
    main.appendChild(dl);
    layout.appendChild(aside);
    layout.appendChild(main);
    modalBodyEl.appendChild(layout);
  }

  function showModal() {
    modalEl.hidden = false;
    document.body.classList.add('modal-open');
  }

  function hideModal() {
    modalEl.hidden = true;
    document.body.classList.remove('modal-open');
    clearNode(modalBodyEl);
  }

  const ERROR_META = {
    NETWORK:     { label: 'Network Error', mod: 'network' },
    HTTP:        { label: 'Server Error',  mod: '' },
    OMDB_FALSE:  { label: 'Not Found',     mod: '' },
    MISSING_KEY: { label: 'Config Error',  mod: 'config' },
    BAD_JSON:    { label: 'Server Error',  mod: '' },
  };

  function showError(message, opts = {}) {
    const { code, onRetry } = opts;
    clearNode(statusEl);
    statusEl.className = 'status-region';

    const p = document.createElement('p');
    p.className = 'banner banner-error';

    const meta = code ? ERROR_META[code] : null;
    if (meta) {
      if (meta.mod) p.classList.add(`banner-error--${meta.mod}`);
      const badge = document.createElement('span');
      badge.className = 'banner-badge';
      badge.textContent = meta.label;
      p.appendChild(badge);
    }

    const msgSpan = document.createElement('span');
    msgSpan.className = 'banner-msg';
    msgSpan.textContent = message;
    p.appendChild(msgSpan);

    if (typeof onRetry === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'banner-retry';
      btn.textContent = 'Retry';
      btn.addEventListener('click', onRetry);
      p.appendChild(btn);
    }

    statusEl.appendChild(p);
  }

  function clearError() {
    const err = statusEl.querySelector('.banner-error');
    if (err) err.remove();
  }

  function showLoading() {
    loadingCount += 1;
    if (loadingCount !== 1) return;
    clearNode(statusEl);
    statusEl.className = 'status-region status-region--loading';
    const wrap = document.createElement('div');
    wrap.className = 'loading';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.className = 'loading-text';
    txt.textContent = 'Loading…';
    wrap.appendChild(spinner);
    wrap.appendChild(txt);
    statusEl.appendChild(wrap);
  }

  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount !== 0) return;
    const loading = statusEl.querySelector('.loading');
    if (loading) loading.remove();
    if (!statusEl.textContent && statusEl.children.length === 0) {
      statusEl.className = 'status-region';
    }
  }

  return {
    renderMovieCards,
    renderMovieDetail,
    showError,
    clearError,
    showLoading,
    hideLoading,
    showModal,
    hideModal,
    setPickHandler(fn) {
      onPickMovie = typeof fn === 'function' ? fn : () => {};
    },
    clearResults() {
      clearNode(resultsEl);
    },
  };
}
