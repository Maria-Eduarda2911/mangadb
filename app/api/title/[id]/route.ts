import { NextResponse } from 'next/server';
import { detail } from '@/providers';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try { return NextResponse.json(await detail(decodeURIComponent(id))); }
  catch (e: any) {
    const nf = ['not_found', 'bad_id'].includes(e?.message);
    return NextResponse.json({ error: e?.message ?? 'upstream' }, { status: nf ? 404 : 502 });
  }
}
