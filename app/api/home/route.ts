import { NextResponse } from 'next/server';
import { home, toCard } from '@/providers';

export const revalidate = 1800;

export async function GET() {
  try {
    const h = await home();
    const payload = {
      trending: Array.isArray(h?.trending) ? h.trending.map((i) => toCard(i)) : [],
      recent: Array.isArray(h?.recent) ? h.recent.map((i) => toCard(i)) : [],
      top: Array.isArray(h?.top) ? h.top.map((i) => toCard(i)) : [],
      manhwa: Array.isArray(h?.manhwa) ? h.manhwa.map((i) => toCard(i)) : [],
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
