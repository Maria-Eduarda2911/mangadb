import { NextResponse } from 'next/server';
import { home, toCard } from '@/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const h = await home();
    return NextResponse.json({
      trending: h.trending.map((i) => toCard(i)), recent: h.recent.map((i) => toCard(i)),
      top: h.top.map((i) => toCard(i)), manhwa: h.manhwa.map((i) => toCard(i)),
    });
  } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
}
