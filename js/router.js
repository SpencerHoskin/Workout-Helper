// Hash router: #/today, #/machines, #/scan, #/progress/body, #/log/legpress?m=m_abc
// go() navigates SYNCHRONOUSLY (pushState + render) so code can open a sheet right after it
// without racing an async hashchange. Links and back/forward still arrive via hashchange/popstate.
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
  if (location.hash !== target) history[replace ? 'replaceState' : 'pushState'](null, '', target);
  renderFn();
}

export const rerender = opts => renderFn(opts);
