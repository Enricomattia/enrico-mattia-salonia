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
  let accent = color.map(value => Math.round(value * .65 + gray * .35));
  // Preserve the hue, but give even pale artwork a visible decorative edge.
  // Test the least opaque edge (.7) over white; text colors stay unchanged.
  const linear = value => {value /= 255;return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;};
  const contrast = rgb => {
    const blended = rgb.map(value => linear(value * .7 + 255 * .3));
    return 1.05 / (blended[0] * .2126 + blended[1] * .7152 + blended[2] * .0722 + .05);
  };
  while (contrast(accent) < 2) accent = accent.map(value => Math.floor(value * .96));
  return accent;
}

if (typeof document !== 'undefined') {
  const cache = new Map(), queued = [], pending = new Map();
  let active = 0, epoch = 0;
  function pixels(image) {
    const canvas = document.createElement('canvas');canvas.width = 24;canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 24, 32);
    return prominentColor(context.getImageData(0, 0, 24, 32).data);
  }
  async function sample(url, refresh) {
    if (refresh) {
      // A single cache-reloading retry also avoids reusing a failed/stale image
      // response. CORS still applies, and no cookies or referrer are forwarded.
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      let bitmap;
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'reload', signal: controller.signal });
        if (!response.ok) throw new Error('Image unavailable');
        bitmap = await createImageBitmap(await response.blob());
        return { color: pixels(bitmap), failed: false };
      } catch {return { color: null, failed: true };}
      finally {clearTimeout(timer);bitmap?.close();}
    }
    return new Promise(resolve => {
      const image = new Image();
      const finish = value => {clearTimeout(timer);image.onload = image.onerror = null;resolve(value);};
      const timer = setTimeout(() => {finish({ color: null, failed: true });image.src = '';}, 4000);
      // A separate anonymous image leaves the displayed cover untouched when
      // a remote host disallows pixel access (or an offline cache is opaque).
      image.crossOrigin = 'anonymous';image.referrerPolicy = 'no-referrer';
      image.onload = () => {
        try {
          finish({ color: pixels(image), failed: false });
        } catch {finish({ color: null, failed: true });}
      };
      image.onerror = () => finish({ color: null, failed: true });image.src = url;
    });
  }
  function pump() {
    while (active < 2 && queued.length) {
      const job = queued.shift(), { url, resolve, version, retry } = job;active++;
      sample(url, retry).then(result => {
        if (version !== epoch) {resolve({ color: null, failed: true });return;}
        if (result.failed && !retry && navigator.onLine) {
          // Let other covers take their first turn before retrying this one.
          queued.push({ ...job, retry: true });return;
        }
        cache.set(url, { ...result, expires: result.failed ? Date.now() + 30000 : Infinity });
        if (cache.size > 160) cache.delete(cache.keys().next().value);
        pending.delete(url);resolve(result);
      }).finally(() => {active--;pump();});
    }
  }
  function colorFor(url) {
    if (cache.has(url)) {
      const result = cache.get(url);
      if (result.expires > Date.now()) return Promise.resolve(result);
      cache.delete(url);
    }
    if (!pending.has(url)) {
      const promise = new Promise(resolve => queued.push({ url, resolve, version: epoch }));
      pending.set(url, promise);pump();
    }
    return pending.get(url);
  }
  async function paint(element) {
    const url = element.dataset.coverAccent;
    if (!url || !/^(?:https?:|data:image\/|blob:|\/)/i.test(url)) return;
    const { color, failed } = await colorFor(url);
    if (!failed) visibility.unobserve(element);
    if (color && element.isConnected && element.dataset.coverAccent === url) {
      element.style.setProperty('--cover-accent', color.join(', '));element.classList.add('has-cover-accent');
    }
  }
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) void paint(entry.target);
  }, { rootMargin: '100px' });
  function watch(root) {
    if (root.nodeType !== 1 || !root.isConnected) return;
    const elements = [...root.querySelectorAll('[data-cover-accent]')];
    if (root.matches('[data-cover-accent]')) elements.push(root);
    for (const element of elements) {visibility.unobserve(element);visibility.observe(element);}
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
    epoch++;cache.clear();pending.clear();queued.splice(0).forEach(job => job.resolve({ color: null, failed: true }));
  });
  function retryVisible() {
    if (document.visibilityState === 'hidden') return;
    watch(document.body);
  }
  window.addEventListener('online', () => {
    for (const [url, result] of cache) if (result.failed) cache.delete(url);
    retryVisible();
  });
  window.addEventListener('focus', retryVisible);
  watch(document.body);
}
