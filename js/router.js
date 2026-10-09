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
  // A pop-up's own history entry (see pushLayer in ui.js) is taken over rather than stacked on, so Back
  // from the new screen goes to the screen you were on, not to a stale copy of it.
  // Same screen: leave history alone (the pop-up's entry is dropped or reused by the next pop-up).
  const onLayer = !!(history.state && history.state.kilnLayer);
  if (location.hash !== target) history[replace || onLayer ? 'replaceState' : 'pushState'](null, '', target);
  renderFn();
}

export const rerender = opts => renderFn(opts);
