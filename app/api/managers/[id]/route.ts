import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getSessionFromHeader } from '@/lib/auth';
import { getManagers, setManagers } from '@/lib/storage';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const managers = await getManagers();
  const filtered = managers.filter((m) => m.id !== params.id);

  if (filtered.length === managers.length) {
    return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
  }

  await setManagers(filtered);
  return NextResponse.json({ ok: true });
}
