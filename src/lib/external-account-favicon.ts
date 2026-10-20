// Send only a public hostname to the image provider, never credentials or URL paths.
export function accountFaviconUrl(serviceUrl: string | null | undefined): string | null {
  try {
    const url = new URL(serviceUrl ?? '');
    const domain = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password ||
      !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain) ||
      /\.(localhost|local|internal|test|invalid)$/.test(domain)) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch { return null; }
}
