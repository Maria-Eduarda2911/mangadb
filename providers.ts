import { cached } from '@/cache';
import { classifyUrl, sourceKey, type Source } from '@/classify';
import { mangadexInfo } from '@/mangadex';

export type SortKey = 'relevance' | 'popular' | 'score' | 'recent';
export type Item = {
  id: string; title: string; names: string[]; synopsis: string; genres: string[]; status: string;
  cover: string | null; rating: number | null; externalUrls: string[]; al?: number; mal?: number;
};
export type Card = Omit<Item, 'externalUrls' | 'names' | 'al' | 'mal'> & {
  sources: Source[]; synopsisLang: 'pt-br' | 'pt-br-auto' | 'original';
};
export type Home = { trending: Item[]; recent: Item[]; top: Item[]; manhwa: Item[] };
export type Page = { items: Item[]; hasNext: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STATUS: Record<string, string> = {
  RELEASING: 'Em lançamento', FINISHED: 'Finalizado', HIATUS: 'Em hiato', CANCELLED: 'Cancelado', NOT_YET_RELEASED: 'Em breve',
  Publishing: 'Em lançamento', Finished: 'Finalizado', 'On Hiatus': 'Em hiato', Discontinued: 'Cancelado', 'Not yet published': 'Em breve',
};
const clean = (d?: string | null) => (d ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

// Links iguais (mesma chave canônica) nunca se repetem; gratuitos aparecem primeiro.
export function buildSources(urls: string[]): Source[] {
  const seen = new Set<string>(); const out: Source[] = [];
  for (const u of urls) {
    const s = classifyUrl(u); if (!s) continue;
    const k = sourceKey(s.url); if (seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out.sort((a, b) => Number(b.isFree) - Number(a.isFree));
}
export const toCard = (i: Item, extra: string[] = []): Card => ({
  id: i.id, title: i.title, synopsis: i.synopsis, genres: i.genres, status: i.status,
  cover: i.cover, rating: i.rating, synopsisLang: 'original',
  sources: buildSources([...i.externalUrls, ...extra]),
});

async function http(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(init.headers as Record<string, string>) } });
  } finally { clearTimeout(t); }
}

// ---------- AniList (principal) ----------
const F = `id idMal title{romaji english} description(asHtml:false) genres status averageScore
  coverImage{extraLarge large} externalLinks{url site}`;

async function gql(query: string, variables: Record<string, unknown> = {}, attempt = 0): Promise<any> {
  const r = await http('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (r.status === 429 && attempt < 1) {
    await sleep(Math.min(Number(r.headers.get('retry-after') ?? 1), 3) * 1000);
    return gql(query, variables, attempt + 1);
  }
  if (!r.ok) throw new Error('AniList ' + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0]?.message ?? 'AniList error');
  return j.data;
}
const alItem = (m: any): Item => ({
  id: `al-${m.id}`, title: m.title.english ?? m.title.romaji,
  names: [m.title.english, m.title.romaji].filter(Boolean), synopsis: clean(m.description),
  genres: m.genres ?? [], status: STATUS[m.status] ?? m.status ?? '',
  cover: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
  rating: m.averageScore != null ? Math.round(m.averageScore) / 10 : null,
  externalUrls: (m.externalLinks ?? []).map((l: any) => l.url), al: m.id, mal: m.idMal ?? undefined,
});

// ---------- Jikan / MyAnimeList (reserva) ----------
async function jikanRaw(path: string): Promise<any> {
  const r = await http('https://api.jikan.moe/v4' + path);
  if (!r.ok) throw new Error('Jikan ' + r.status);
  return r.json();
}
const jikan = async (path: string) => (await jikanRaw(path)).data;
const jkItem = (m: any): Item => ({
  id: `mal-${m.mal_id}`, title: m.title_english ?? m.title, names: [m.title_english, m.title].filter(Boolean),
  synopsis: m.synopsis ?? '', genres: (m.genres ?? []).map((g: any) => g.name), status: STATUS[m.status] ?? m.status ?? '',
  cover: m.images?.jpg?.large_image_url ?? m.images?.jpg?.image_url ?? null, rating: m.score ?? null,
  externalUrls: (m.external ?? []).map((e: any) => e.url), mal: m.mal_id,
});

// ---------- busca robusta ----------
const SORT_ENUM: Record<SortKey, string> = {
  relevance: 'SEARCH_MATCH', popular: 'POPULARITY_DESC', score: 'SCORE_DESC', recent: 'START_DATE_DESC',
};
// títulos em português que os catálogos internacionais não conhecem
const ALIASES: [RegExp, string][] = [
  [/ataque dos tit[aã]s/, 'Shingeki no Kyojin'], [/guardi[oõ]es da noite/, 'Kimetsu no Yaiba'],
  [/cavaleiros do zod[ií]aco/, 'Saint Seiya'], [/ca[cç]ador x ca[cç]ador/, 'Hunter x Hunter'],
  [/meu her[oó]i academia/, 'Boku no Hero Academia'], [/homem[- ]motosserra/, 'Chainsaw Man'],
];
const normalizeQ = (q: string) => q.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 100);
const applyAlias = (q: string) => { const l = q.toLowerCase(); for (const [re, to] of ALIASES) if (re.test(l)) return to; return q; };
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

async function aniBrowse(q: string | undefined, genres: string[], sort: SortKey, page: number): Promise<Page> {
  const eff: SortKey = !q && sort === 'relevance' ? 'popular' : sort;
  const vars: Record<string, unknown> = { page };
  const decl = ['$page:Int']; const args = ['type:MANGA', 'isAdult:false'];
  if (q) { decl.push('$q:String'); args.push('search:$q'); vars.q = q; }
  if (genres.length) { decl.push('$genres:[String]'); args.push('genre_in:$genres'); vars.genres = genres; }
  args.push(`sort:${SORT_ENUM[eff]}`);
  if (!q && eff === 'score') args.push('popularity_greater:3000'); // evita obras obscuras com nota 10
  if (!q && eff === 'recent') args.push('status_not:NOT_YET_RELEASED', 'popularity_greater:1500');
  const d = await gql(`query(${decl.join(',')}){Page(page:$page,perPage:24){pageInfo{hasNextPage} media(${args.join(',')}){${F}}}}`, vars);
  return { items: d.Page.media.map(alItem), hasNext: !!d.Page.pageInfo?.hasNextPage };
}

export function browse(o: { q?: string; genres: string[]; sort: SortKey; page: number }): Promise<Page> {
  const q = o.q ? normalizeQ(o.q) : undefined;
  return cached(`b:${q ?? ''}|${o.genres.join(',')}|${o.sort}|${o.page}`, 10 * 60_000, async () => {
    const first = q ? applyAlias(q) : undefined;
    let primary: Page | null = null;
    try {
      primary = await aniBrowse(first, o.genres, o.sort, o.page);
      if (!primary.items.length && first && o.page === 1) { // 2ª tentativa sem acentos/pontuação
        const alt = plain(first);
        if (alt && alt !== first.toLowerCase()) primary = await aniBrowse(alt, o.genres, o.sort, o.page);
      }
    } catch { primary = null; }
    if (primary && (primary.items.length || !first)) return primary;
    if (!first) throw new Error('providers_down');

    try { // reserva: Jikan (só com texto de busca)
      const j = await jikanRaw(`/manga?q=${encodeURIComponent(first)}&sfw=true&limit=24&page=${o.page}`);
      const seen = new Set<string>();
      let items: Item[] = (j.data ?? []).map(jkItem).filter((i: Item) => !seen.has(i.id) && !!seen.add(i.id));
      if (o.genres.length) items = items.filter((i) => i.genres.some((g) => o.genres.includes(g)));
      return { items, hasNext: !!j.pagination?.has_next_page };
    } catch {
      if (primary) return primary; // AniList respondeu "0 resultados"; Jikan fora do ar
      throw new Error('providers_down');
    }
  });
}

export function home(): Promise<Home> {
  return cached('home', 30 * 60_000, async () => {
    try { // uma única requisição GraphQL traz as 4 categorias
      const d = new Date(); d.setMonth(d.getMonth() - 18);
      const since = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      const page = (args: string) => `Page(perPage:12){media(type:MANGA,isAdult:false,${args}){${F}}}`;
      const data = await gql(`{
        trending: ${page('sort:TRENDING_DESC')}
        recent: ${page(`status:RELEASING,startDate_greater:${since},sort:POPULARITY_DESC`)}
        top: ${page('sort:SCORE_DESC,popularity_greater:20000')}
        manhwa: ${page('countryOfOrigin:"KR",sort:TRENDING_DESC')}
      }`);
      const m = (k: string): Item[] => data[k].media.map(alItem);
      return { trending: m('trending'), recent: m('recent'), top: m('top'), manhwa: m('manhwa') };
    } catch {
      const paths: Record<keyof Home, string> = {
        trending: '/top/manga?filter=bypopularity&sfw=true&limit=12',
        recent: '/manga?status=publishing&order_by=start_date&sort=desc&min_score=7&sfw=true&limit=12',
        top: '/top/manga?sfw=true&limit=12',
        manhwa: '/top/manga?type=manhwa&filter=bypopularity&sfw=true&limit=12',
      };
      const out: Home = { trending: [], recent: [], top: [], manhwa: [] };
      for (const k of Object.keys(paths) as (keyof Home)[]) { // sequencial: Jikan limita 3 req/s
        try { out[k] = (await jikan(paths[k])).map(jkItem); } catch { /* categoria vazia */ }
        await sleep(400);
      }
      if (!Object.values(out).some((l) => l.length)) throw new Error('providers_down');
      return out;
    }
  });
}

// ---------- sinopse em português ----------
const unent = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function chunk(text: string, max = 450): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = []; let cur = '';
  for (const s of parts) {
    if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
    cur += s;
    while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Tradução automática (MyMemory, gratuita, limite diário). Se falhar, devolve null e o original é mantido.
async function translatePt(text: string): Promise<string | null> {
  let src = text.replace(/\s+/g, ' ').trim();
  if (src.length > 1500) { src = src.slice(0, 1500); const i = Math.max(src.lastIndexOf('. '), src.lastIndexOf('! '), src.lastIndexOf('? ')); if (i > 600) src = src.slice(0, i + 1); }
  try {
    return await cached('t:' + src.length + ':' + src.slice(0, 80), 24 * 3600_000, async () => {
      const parts = await Promise.all(chunk(src).map(async (c) => {
        const r = await http(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en|pt-BR`, {}, 7000);
        if (!r.ok) throw new Error('mymemory');
        const j = await r.json(); const t = j?.responseData?.translatedText;
        if (!t || Number(j.responseStatus) !== 200 || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(t)) throw new Error('mymemory');
        return unent(t);
      }));
      return parts.join(' ');
    });
  } catch { return null; }
}

export function detail(id: string): Promise<Card> {
  return cached('d:' + id, 15 * 60_000, async () => {
    let item: Item;
    if (id.startsWith('al-')) {
      const d = await gql(`query($id:Int){Media(id:$id,type:MANGA){${F}}}`, { id: Number(id.slice(3)) });
      if (!d.Media) throw new Error('not_found');
      item = alItem(d.Media);
    } else if (id.startsWith('mal-')) {
      item = jkItem(await jikan(`/manga/${Number(id.slice(4))}/full`));
    } else throw new Error('bad_id');

    const md = await mangadexInfo(item.names, { al: item.al, mal: item.mal });
    let synopsis = item.synopsis; let lang: Card['synopsisLang'] = 'original';
    if (md.descriptionPt) { synopsis = md.descriptionPt; lang = 'pt-br'; }          // 1º: texto em PT do MangaDex
    else if (synopsis) { const t = await translatePt(synopsis); if (t) { synopsis = t; lang = 'pt-br-auto'; } } // 2º: tradução automática
    return { ...toCard(item, md.urls), synopsis, synopsisLang: lang };
  });
}
