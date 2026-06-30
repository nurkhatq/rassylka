import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeader } from '@/lib/auth';
import { getCallStatuses, setCallStatus } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'manager') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const statuses = await getCallStatuses(session.managerId!);
  return NextResponse.json(statuses);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'manager') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { merchant_id, status } = await req.json();
  await setCallStatus(session.managerId!, merchant_id, status || null);
  return NextResponse.json({ ok: true });
}
