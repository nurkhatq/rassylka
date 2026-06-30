import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL не задан в env' });
  }

  try {
    const sql = neon(url);
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const managers = await sql`SELECT id, name FROM managers`;
    return NextResponse.json({
      db_connected: true,
      db_host: url.split('@')[1]?.split('/')[0] || 'unknown',
      tables: tables.map((t: any) => t.table_name),
      managers_count: managers.length,
      managers,
    });
  } catch (e) {
    return NextResponse.json({ db_connected: false, error: String(e) });
  }
}
