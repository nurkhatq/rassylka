import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'kaspi-secret-2024';

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

export function makeAdminCookie(): string {
  return `admin:${hmac('admin')}`;
}

export function makeManagerCookie(id: string): string {
  return `mgr:${id}:${hmac('mgr:' + id)}`;
}

export function verifyAdminCookie(value: string): boolean {
  const parts = value.split(':');
  if (parts[0] !== 'admin') return false;
  const sig = parts.slice(1).join(':');
  return sig === hmac('admin');
}

export function verifyManagerCookie(value: string): { valid: boolean; id: string } {
  const parts = value.split(':');
  if (parts[0] !== 'mgr' || parts.length < 3) return { valid: false, id: '' };
  const id = parts[1];
  const sig = parts.slice(2).join(':');
  const valid = sig === hmac('mgr:' + id);
  return { valid, id };
}

export function getSessionFromHeader(cookieHeader: string | null): {
  type: 'admin' | 'manager' | 'none';
  managerId?: string;
} {
  if (!cookieHeader) return { type: 'none' };

  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return { type: 'none' };

  const value = decodeURIComponent(match[1]);
  if (verifyAdminCookie(value)) return { type: 'admin' };

  const mgr = verifyManagerCookie(value);
  if (mgr.valid) return { type: 'manager', managerId: mgr.id };

  return { type: 'none' };
}
