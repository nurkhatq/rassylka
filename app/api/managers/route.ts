import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getSessionFromHeader } from '@/lib/auth';
import { getManagers, setManagers } from '@/lib/storage';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const managers = await getManagers();
  return NextResponse.json(managers);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, password } = (await req.json()) as { name: string; password: string };
  if (!name || !password) {
    return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
  }

  const managers = await getManagers();
  const id = crypto.randomUUID();
  managers.push({ id, name, password });
  await setManagers(managers);

  return NextResponse.json({ ok: true, id });
}
