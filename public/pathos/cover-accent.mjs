// Presentation only. No archive writes, persistent palette cache or image proxy.
export function prominentColor(pixels) {
  const bins = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = pixels.slice(i, i + 4);
    const high = Math.max(r, g, b), low = Math.min(r, g, b);
    if (a < 200 || high < 35 || low > 235 || high - low < 22) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0, saturation: 0 };
    bin.count++;bin.r += r;bin.g += g;bin.b += b;bin.saturation += (high - low) / high;
    bins.set(key, bin);
  }
  const winner = [...bins.values()].filter(bin => bin.count >= pixels.length / 4 * .025)
    .sort((a, b) => (b.count * .7 + b.saturation * .3) - (a.count * .7 + a.saturation * .3))[0];
  if (!winner) return null;
  const color = [winner.r, winner.g, winner.b].map(value => value / winner.count);
  const gray = color.reduce((sum, value) => sum + value, 0) / 3;
  return color.map(value => Math.round(value * .65 + gray * .35));
}

if (typeof document !== 'undefined') {
  const cache = new Map(), queued = [], pending = new Map();
  let active = 0, epoch = 0;
  function sample(url) {
    return new Promise(resolve => {
      const image = new Image();
      const finish = value => {clearTimeout(timer);image.onload = image.onerror = null;resolve(value);};
      const timer = setTimeout(() => {finish(null);image.src = '';}, 4000);
      // A separate anonymous image leaves the displayed cover untouched when
      // a remote host disallows pixel access (or an offline cache is opaque).
      image.crossOrigin = 'anonymous';image.referrerPolicy = 'no-referrer';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');canvas.width = 24;canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 24, 32);
          finish(prominentColor(context.getImageData(0, 0, 24, 32).data));
        } catch {finish(null);}
      };
      image.onerror = () => finish(null);image.src = url;
    });
  }
  function pump() {
    while (active < 2 && queued.length) {
      const { url, resolve, version } = queued.shift();active++;
      sample(url).then(color => {
        if (version !== epoch) {resolve(null);return;}
        cache.set(url, color);if (cache.size > 160) cache.delete(cache.keys().next().value);
        pending.delete(url);resolve(color);
      }).finally(() => {active--;pump();});
    }
  }
  function colorFor(url) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (!pending.has(url)) {
      const promise = new Promise(resolve => queued.push({ url, resolve, version: epoch }));
      pending.set(url, promise);pump();
    }
    return pending.get(url);
  }
  async function paint(element) {
    const url = element.dataset.coverAccent;
    if (!url || !/^(?:https?:|data:image\/|blob:|\/)/i.test(url)) return;
    const color = await colorFor(url);
    if (color && element.isConnected && element.dataset.coverAccent === url) {
      element.style.setProperty('--cover-accent', color.join(', '));element.classList.add('has-cover-accent');
    }
  }
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {visibility.unobserve(entry.target);void paint(entry.target);}
  }, { rootMargin: '100px' });
  function watch(root) {
    if (root.nodeType !== 1 || !root.isConnected) return;
    const elements = [...root.querySelectorAll('[data-cover-accent]')];
    if (root.matches('[data-cover-accent]')) elements.push(root);
    for (const element of elements) visibility.observe(element);
  }
  new MutationObserver(records => {
    // Do not retain detached archive cards (including private cards on sign-out).
    for (const record of records) for (const node of record.removedNodes) {
      if (node.nodeType !== 1) continue;
      visibility.unobserve(node);node.querySelectorAll('[data-cover-accent]').forEach(element => visibility.unobserve(element));
    }
    for (const record of records) {
      if (record.type === 'attributes') {
        record.target.classList.remove('has-cover-accent');record.target.style.removeProperty('--cover-accent');watch(record.target);
      } else record.addedNodes.forEach(watch);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cover-accent'] });
  window.addEventListener('pathos-owner-change', event => {
    if (event.detail.active) return;
    epoch++;cache.clear();pending.clear();queued.splice(0).forEach(job => job.resolve(null));
  });
  watch(document.body);
}
