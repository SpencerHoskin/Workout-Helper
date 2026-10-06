// Minimal in-memory localStorage so store.js can run under node --test.
const data = new Map();
globalThis.localStorage = {
  get length() { return data.size; },
  key: i => [...data.keys()][i] ?? null,
  getItem: k => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => { data.set(k, String(v)); },
  removeItem: k => { data.delete(k); },
  clear: () => data.clear()
};
globalThis.alert = () => {};
