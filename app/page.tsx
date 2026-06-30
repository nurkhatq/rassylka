import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAdminCookie, verifyManagerCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('session');

  if (session) {
    const value = session.value;
    if (verifyAdminCookie(value)) {
      redirect('/admin');
    }
    const mgr = verifyManagerCookie(value);
    if (mgr.valid) {
      redirect('/call');
    }
  }

  redirect('/login');
}
