const KEY_QUERY = 'omdb:lastQuery';
const KEY_PAYLOAD = 'omdb:lastResultsPayload';

function readJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLastSearch(query) {
  const q = String(query || '').trim();
  if (!q) {
    localStorage.removeItem(KEY_QUERY);
    return;
  }
  try {
    localStorage.setItem(KEY_QUERY, q);
  } catch {
    // private mode veya storage dolu olabilir
  }
}

export function getLastSearch() {
  const v = localStorage.getItem(KEY_QUERY);
  return v ? v.trim() : '';
}

// Sayfa yenilendiğinde tekrar API çağrısı yapmamak için sonuçları önbellekte tut
export function saveResults(data) {
  if (!data || !Array.isArray(data.search)) return;
  const payload = {
    query: data.query,
    type: typeof data.type === 'string' ? data.type : '',
    year: typeof data.year === 'string' ? data.year : '',
    search: data.search,
  };
  try {
    localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function getResults() {
  const parsed = readJson(localStorage.getItem(KEY_PAYLOAD));
  if (!parsed || typeof parsed.query !== 'string' || !Array.isArray(parsed.search)) {
    return null;
  }
  return {
    query: parsed.query,
    type: typeof parsed.type === 'string' ? parsed.type : '',
    year: typeof parsed.year === 'string' ? parsed.year : '',
    search: parsed.search,
  };
}

export function clearStoredResults() {
  localStorage.removeItem(KEY_PAYLOAD);
}
