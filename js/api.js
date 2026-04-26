// OMDb API istemcisi — sadece HTTP istekleri ve JSON ayrıştırma.
// İş mantığı app.js'te.

export class ApiError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, val] of Object.entries(params)) {
    if (val != null && val !== '') url.searchParams.set(key, String(val));
  }
  return url.toString();
}

export function createOmdbClient({ apiKey, baseUrl = 'https://www.omdbapi.com/' }) {
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new ApiError('Set OMDB_API_KEY in js/config.js.', { code: 'MISSING_KEY' });
  }

  async function request(params) {
    const url = buildUrl(baseUrl, { apikey: apiKey, ...params });
    let response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new ApiError('Network error: could not reach the server.', { code: 'NETWORK', cause: err });
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new ApiError('Could not read the server response.', { code: 'BAD_JSON', cause: err });
    }

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, { code: 'HTTP' });
    }

    // OMDb başarısız aramalarda HTTP 200 döndürür ama Response="False" koyar
    if (data.Response === 'False') {
      throw new ApiError(data.Error || 'Request was not successful.', { code: 'OMDB_FALSE' });
    }

    return data;
  }

  return {
    searchMovies(query, opts = {}) {
      const q = query.trim();
      if (!q) {
        return Promise.reject(new ApiError('Search text cannot be empty.', { code: 'EMPTY_QUERY' }));
      }
      const params = { s: q };
      const type = String(opts.type || '').trim().toLowerCase();
      if (['movie', 'series', 'episode'].includes(type)) params.type = type;
      const year = String(opts.year || '').trim();
      if (year && /^\d{4}$/.test(year)) params.y = year;
      return request(params);
    },

    getMovieDetails(imdbId) {
      const id = String(imdbId || '').trim();
      if (!id) {
        return Promise.reject(new ApiError('Invalid title id.', { code: 'EMPTY_ID' }));
      }
      return request({ i: id, plot: 'full' });
    },
  };
}
