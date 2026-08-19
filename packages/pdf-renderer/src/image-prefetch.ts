/**
 * Fetch a single image URL and return a base64 data URL.
 * Supports data: URLs (returned as-is), blob: URLs, and http(s): URLs.
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (!url) throw new Error('No URL');
  if (url.startsWith('data:')) return url;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  if (typeof FileReader === 'undefined') {
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Scan rootEl for all <img> elements, fetch each src as a base64 data URL,
 * and return a Map from original src to data URL.
 * Images that fail to load are silently skipped.
 */
export async function prefetchImagesFromDom(rootEl: HTMLElement): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const imgs = rootEl.querySelectorAll('img');
  const seen = new Set<string>();

  await Promise.all(
    [...imgs].map(async (img) => {
      const src = img.getAttribute('src') || img.src;
      if (!src || seen.has(src)) return;
      seen.add(src);
      try {
        const dataUrl = await fetchImageAsDataUrl(src);
        map.set(src, dataUrl);
      } catch {
        // silently skip images that fail to prefetch
      }
    }),
  );

  return map;
}
