export function currentStreamVaultUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalizedPath}`;
  }
  return `https://streamvault.xyz${normalizedPath}`;
}

export function xIntentUrl(args: {
  text: string;
  url: string;
  hashtags?: string[];
}): string {
  const params = new URLSearchParams();
  params.set('text', args.text);
  params.set('url', args.url);
  if (args.hashtags?.length) {
    params.set('hashtags', args.hashtags.map((tag) => tag.replace(/^#/, '')).join(','));
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
