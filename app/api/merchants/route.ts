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
  const filePath = path.join(process.cwd(), 'data', 'merchants.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  cachedMerchants = JSON.parse(raw) as Merchant[];
  return cachedMerchants;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromHeader(req.headers.get('cookie'));

  if (session.type === 'none') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const managers = await getManagers();
  const managerIds = managers.map((m) => m.id);
  const merchants = loadMerchants();

  if (session.type === 'admin') {
    // Admin gets all merchants with distribution info
    return NextResponse.json({
      merchants,
      managerIds,
      managers,
    });
  }

  // Manager gets their assigned merchants
  const managerId = session.managerId!;
  const assigned = distributeToManager(merchants, managerId, managerIds);

  return NextResponse.json({ merchants: assigned });
}
