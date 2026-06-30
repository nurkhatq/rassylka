import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeader } from '@/lib/auth';
import { deleteManager } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromHeader(req.headers.get('cookie'));
  if (session.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteManager(params.id);
  return NextResponse.json({ ok: true });
}
