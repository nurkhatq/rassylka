import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { makeAdminCookie, makeManagerCookie } from '@/lib/auth';
import { getManagers } from '@/lib/storage';

const ADMIN_PASSWORD = 'L127u127';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { role, password, managerId } = body as {
    role: string;
    password: string;
    managerId?: string;
  };

  if (role === 'admin') {
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    const cookieValue = makeAdminCookie();
    const res = NextResponse.json({ ok: true });
    res.cookies.set('session', cookieValue, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  if (role === 'manager') {
    if (!managerId) {
      return NextResponse.json({ error: 'Manager ID required' }, { status: 400 });
    }
    const managers = await getManagers();
    const manager = managers.find((m) => m.id === managerId);
    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }
    if (manager.password !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    const cookieValue = makeManagerCookie(managerId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set('session', cookieValue, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return res;
}
