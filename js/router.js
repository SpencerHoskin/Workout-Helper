// Hash router: #/today, #/machines, #/scan, #/progress/body, #/log/legpress?m=m_abc
let renderFn = () => {};
export const setRenderer = fn => { renderFn = fn; };

export function current() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const [name, arg] = (path || 'today').split('/');
  return { name: name || 'today', arg: arg ? decodeURIComponent(arg) : null, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function go(hash, { replace = false } = {}) {
  const target = hash.startsWith('#') ? hash : '#/' + hash;
  if (location.hash === target) return renderFn();
  if (replace) { history.replaceState(null, '', target); renderFn(); } else location.hash = target;
}

export const rerender = (opts) => renderFn(opts);
