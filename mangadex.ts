const BASE = 'https://api.mangadex.org';
const OFFICIAL_KEYS = ['amz', 'ebj', 'bw', 'engtl'];

async function get(path: string) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(BASE + path, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('MangaDex ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// remove markdown e a parte "--- links/notas" que o MangaDex costuma anexar à descrição
function cleanMd(s: string) {
  return s.split(/\n\s*-{3,}\s*\n?/)[0]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`#>]/g, '')
    .replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export type MdInfo = { urls: string[]; descriptionPt?: string };

// Só aceita a obra se o MangaDex a ligar ao mesmo id do AniList/MAL (evita dados de outra obra).
export async function mangadexInfo(names: string[], ids: { al?: number; mal?: number }): Promise<MdInfo> {
  try {
    let manga: any = null;
    for (const name of Array.from(new Set(names.filter(Boolean)))) {
      const j = await get(`/manga?title=${encodeURIComponent(name)}&limit=5`);
      manga = (j.data ?? []).find((m: any) => {
        const l = m.attributes?.links ?? {};
        return (ids.al && l.al === String(ids.al)) || (ids.mal && l.mal === String(ids.mal));
      });
      if (manga) break;
    }
    if (!manga) return { urls: [] };

    const urls: string[] = [];
    const links = manga.attributes?.links ?? {};
    for (const k of OFFICIAL_KEYS) {
      const v = links[k]; if (!v) continue;
      urls.push(k === 'bw' && !/^https?:/.test(v) ? `https://bookwalker.jp/${v}` : v);
    }
    try { // capítulos que só apontam pra fora (ex.: MANGA Plus); nunca páginas hospedadas no MangaDex
      const f = await get(`/manga/${manga.id}/feed?limit=30&translatedLanguage[]=en&translatedLanguage[]=pt-br`);
      for (const c of f.data ?? []) if (c.attributes?.externalUrl) urls.push(c.attributes.externalUrl);
    } catch { /* opcional */ }

    const d = manga.attributes?.description ?? {};
    const pt = d['pt-br'] || d['pt'];
    return { urls, descriptionPt: pt ? cleanMd(pt) : undefined };
  } catch { return { urls: [] }; }
}
