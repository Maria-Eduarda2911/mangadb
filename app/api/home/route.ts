import { NextResponse } from 'next/server';
import { fallbackHome, home, toCard } from '@/providers';

export const revalidate = 1800;

export async function GET() {
  try {
    const h = await home();
    const payload = {
      manga: Array.isArray(h?.manga) ? h.manga.map((i) => toCard(i)) : [],
      trending: Array.isArray(h?.trending) ? h.trending.map((i) => toCard(i)) : [],
      recent: Array.isArray(h?.recent) ? h.recent.map((i) => toCard(i)) : [],
      top: Array.isArray(h?.top) ? h.top.map((i) => toCard(i)) : [],
      manhwa: Array.isArray(h?.manhwa) ? h.manhwa.map((i) => toCard(i)) : [],
      manhua: Array.isArray(h?.manhua) ? h.manhua.map((i) => toCard(i)) : [],
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  } catch {
    const fallback = fallbackHome();
    return NextResponse.json({
      manga: fallback.manga.map((i) => toCard(i)),
      trending: fallback.trending.map((i) => toCard(i)),
      recent: fallback.recent.map((i) => toCard(i)),
      top: fallback.top.map((i) => toCard(i)),
      manhwa: fallback.manhwa.map((i) => toCard(i)),
      manhua: fallback.manhua.map((i) => toCard(i)),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  }
}
