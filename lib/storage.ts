import { neon } from '@neondatabase/serverless';

export interface Manager {
  id: string;
  name: string;
  password: string;
}

export interface Scripts {
  kz: string;
  ru: string;
}

const DEFAULT_SCRIPTS: Scripts = {
  kz: 'Сәлеметсіз бе! Менің атым [Аты]. Мен Kaspi.kz маркетплейсінде сатушыларға арналған мамандарының бірімін. Сіздің дүкеніңіз туралы сөйлесе алсақ болар ма еді?',
  ru: 'Здравствуйте! Меня зовут [Имя]. Я специалист по продвижению на Kaspi.kz. Могу я поговорить с вами о возможностях для вашего магазина?',
};

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL не задан');
  return neon(url);
}

async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS managers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY DEFAULT 'default',
      kz TEXT NOT NULL,
      ru TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO scripts (id, kz, ru)
    VALUES ('default', ${DEFAULT_SCRIPTS.kz}, ${DEFAULT_SCRIPTS.ru})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getManagers(): Promise<Manager[]> {
  const sql = getDb();
  await ensureTables();
  const rows = await sql`SELECT id, name, password FROM managers ORDER BY created_at`;
  return rows as Manager[];
}

export async function setManagers(managers: Manager[]): Promise<void> {
  const sql = getDb();
  await ensureTables();
  await sql`DELETE FROM managers`;
  for (const m of managers) {
    await sql`INSERT INTO managers (id, name, password) VALUES (${m.id}, ${m.name}, ${m.password})`;
  }
}

export async function addManager(manager: Manager): Promise<void> {
  const sql = getDb();
  await ensureTables();
  await sql`INSERT INTO managers (id, name, password) VALUES (${manager.id}, ${manager.name}, ${manager.password})`;
}

export async function deleteManager(id: string): Promise<void> {
  const sql = getDb();
  await ensureTables();
  await sql`DELETE FROM managers WHERE id = ${id}`;
}

export async function getScripts(): Promise<Scripts> {
  const sql = getDb();
  await ensureTables();
  const rows = await sql`SELECT kz, ru FROM scripts WHERE id = 'default'`;
  if (rows.length === 0) return { ...DEFAULT_SCRIPTS };
  return rows[0] as Scripts;
}

export async function setScripts(scripts: Scripts): Promise<void> {
  const sql = getDb();
  await ensureTables();
  await sql`
    INSERT INTO scripts (id, kz, ru) VALUES ('default', ${scripts.kz}, ${scripts.ru})
    ON CONFLICT (id) DO UPDATE SET kz = ${scripts.kz}, ru = ${scripts.ru}
  `;
}
