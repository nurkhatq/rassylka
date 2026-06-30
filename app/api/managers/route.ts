import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeader } from '@/lib/auth';
import { getManagers, addManager } from '@/lib/storage';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  const managers = await getManagers();

  // Админ видит всё включая пароли, остальные — только id+name для дропдауна
  if (session.type === 'admin') {
    return NextResponse.json(managers);
  }
  return NextResponse.json(managers.map(({ id, name }) => ({ id, name })));
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

  const id = crypto.randomUUID();
  await addManager({ id, name, password });

  return NextResponse.json({ ok: true, id });
}
