import { NextRequest, NextResponse } from 'next/server';
import { browse, toCard, type SortKey } from '@/providers';
import { ALLOWED_GENRES } from '@/genres';

export const revalidate = 600;
const SORTS: SortKey[] = ['relevance', 'popular', 'score', 'recent'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const genres = (sp.get('genres') ?? '').split(',').filter((g) => ALLOWED_GENRES.has(g)).slice(0, 5);
  const s = sp.get('sort') as SortKey;
  const sort: SortKey = SORTS.includes(s) ? s : 'relevance';
  const page = Math.min(Math.max(parseInt(sp.get('page') ?? '1', 10) || 1, 1), 20);
  const hasQ = q.length >= 2;
  if (!hasQ && !genres.length) {
    return NextResponse.json({ items: [], hasNext: false }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' },
    });
  }
  try {
    const r = await browse({ q: hasQ ? q : undefined, genres, sort, page });
    return NextResponse.json({ items: r.items.map((i) => toCard(i)), hasNext: r.hasNext }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' },
    });
  } catch (e: any) {
    const limited = String(e?.message).includes('429');
    return NextResponse.json({ error: limited ? 'rate_limited' : 'upstream' }, {
      status: limited ? 429 : 502,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600' },
    });
  }
}
