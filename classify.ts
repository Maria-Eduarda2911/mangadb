export type OfficialStatus = 'official' | 'author_published' | 'unknown';
export interface Source {
  platform: string; url: string; isFree: boolean;
  accessType: 'free' | 'purchase'; officialStatus: OfficialStatus;
}

// Só domínios de plataformas/lojas oficiais. Nada de scans.
const FREE_OFFICIAL = ['mangaplus.shueisha.co.jp', 'webtoons.com', 'tapas.io', 'comic-walker.com', 'comikey.com'];
const PAID_OFFICIAL = ['amazon.com', 'amazon.co.jp', 'amazon.com.br', 'bookwalker.jp', 'ebookjapan.yahoo.co.jp',
  'viz.com', 'panini.com.br', 'editorajbc.com.br', 'newpop.com.br'];

const TRACKING = /^(utm_|fbclid|gclid|ref$|ref_|tag$|linkcode|camp$|creative|th$|psc$|language$)/i;

// URL "limpa": https, sem www, sem #fragmento, sem parâmetros de rastreamento, sem "/" no fim.
export function canonicalUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    x.protocol = 'https:'; x.hash = '';
    x.hostname = x.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of Array.from(x.searchParams.keys())) if (TRACKING.test(k)) x.searchParams.delete(k);
    x.pathname = x.pathname.replace(/\/+$/, '') || '/';
    return x.toString().replace(/\/$/, '');
  } catch { return u.trim(); }
}

// Chave de comparação: dois links "iguais" têm a mesma chave (ex.: Amazon /dp/ASIN vs /gp/product/ASIN).
export function sourceKey(u: string): string {
  const c = canonicalUrl(u);
  const m = c.match(/(amazon\.[a-z.]+)\/(?:[^/]+\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? `${m[1].toLowerCase()}:${m[2].toUpperCase()}` : c.toLowerCase();
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const match = (h: string, list: string[]) => list.some((d) => h === d || h.endsWith('.' + d));

export function classifyUrl(raw: string): Source | null {
  const url = canonicalUrl(raw); const h = host(url);
  if (match(h, FREE_OFFICIAL)) return { platform: h, url, isFree: true, accessType: 'free', officialStatus: 'official' };
  if (match(h, PAID_OFFICIAL)) return { platform: h, url, isFree: false, accessType: 'purchase', officialStatus: 'official' };
  return null; // desconhecido => descartado
}
