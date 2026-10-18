/* One bounded, cached request per local JSON file. Optional enrichment never
 * shares a promise with essential data. Failed enrichment retries on reload.
 */
// Release token for data files, mirroring the ?v= strategy on index.html assets.
// Bump this when data/*.json changes so deploys invalidate cached responses.
const DATA_VERSION = "20261018-whisky-room";

window.WhiskeyData = (() => {
  const requests = new Map();
  function json(path, { optional = false, fallback = {}, timeoutMs = optional ? 3000 : 10000 } = {}) {
    if (!requests.has(path)) {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Whiskey data request timed out: ${path}`));
        }, timeoutMs);
      });
      const request = Promise.resolve().then(() => fetch(path, { signal: controller.signal }))
        .then(response => {
          if (!response.ok) throw new Error(`Whiskey data could not be loaded: ${path} (${response.status})`);
          return response.json();
        });
      const result = Promise.race([request, timeout]).finally(() => clearTimeout(timer))
        .catch(error => {
          if (!optional) throw error;
          console.warn(error);
          return fallback;
        });
      requests.set(path, result);
    }
    return requests.get(path);
  }
  return Object.freeze({ json, whenIdle: () => Promise.allSettled([...requests.values()]) });
})();
window.WhiskeyDataUrl = path => `${path}?v=${DATA_VERSION}`;
