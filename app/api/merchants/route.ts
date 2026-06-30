import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeader } from '@/lib/auth';
import { getManagers } from '@/lib/storage';
import { distributeToManager, Merchant } from '@/lib/distribution';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

let cachedMerchants: Merchant[] | null = null;

function loadMerchants(): Merchant[] {
  if (cachedMerchants) return cachedMerchants;

  // Try multiple paths — Next.js serverless bundles can vary
  const candidates = [
    path.join(process.cwd(), 'data', 'merchants.json'),
    path.join(process.cwd(), '.next', 'server', 'data', 'merchants.json'),
    path.join(__dirname, '..', '..', '..', '..', 'data', 'merchants.json'),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        cachedMerchants = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Merchant[];
        return cachedMerchants;
      }
    } catch {
      // try next path
    }
  }

  throw new Error(`merchants.json не найден. Пробовал: ${candidates.join(', ')}`);
}

export async function GET(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));

  if (session.type === 'none') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let managers;
  try {
    managers = await getManagers();
  } catch (e) {
    return NextResponse.json({ error: 'DB error: ' + String(e) }, { status: 500 });
  }

  let merchants: Merchant[];
  try {
    merchants = loadMerchants();
  } catch (e) {
    return NextResponse.json({ error: 'File error: ' + String(e) }, { status: 500 });
  }

  const managerIds = managers.map((m) => m.id);

  if (session.type === 'admin') {
    return NextResponse.json({ merchants, managerIds, managers });
  }

  const managerId = session.managerId!;

  if (!managerIds.includes(managerId)) {
    return NextResponse.json({
      error: `Manager ${managerId} not found in DB. DB has: ${managerIds.length} managers`,
    }, { status: 403 });
  }

  const assigned = distributeToManager(merchants, managerId, managerIds);
  return NextResponse.json({ merchants: assigned, total: merchants.length, assigned: assigned.length });
}
