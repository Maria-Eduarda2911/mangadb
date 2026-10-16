import { NextResponse } from 'next/server';
import { detail } from '@/providers';

export const revalidate = 900;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payload = await detail(decodeURIComponent(id));
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400' },
    });
  } catch (e: any) {
    const nf = ['not_found', 'bad_id'].includes(e?.message);
    return NextResponse.json({ error: e?.message ?? 'upstream' }, {
      status: nf ? 404 : 502,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600' },
    });
  }
}
