import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getSessionFromHeader } from '@/lib/auth';
import { getScripts, setScripts } from '@/lib/storage';

export async function GET() {
  const scripts = await getScripts();
  return NextResponse.json(scripts);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kz, ru } = (await req.json()) as { kz: string; ru: string };
  await setScripts({ kz: kz || '', ru: ru || '' });
  return NextResponse.json({ ok: true });
}
