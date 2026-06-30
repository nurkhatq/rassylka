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

// In-memory fallback
let mem: { managers: Manager[]; scripts: Scripts } = {
  managers: [],
  scripts: { ...DEFAULT_SCRIPTS },
};

let kvModule: typeof import('@vercel/kv') | null = null;

async function getKV() {
  if (kvModule) return kvModule;
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return null;
    }
    kvModule = await import('@vercel/kv');
    return kvModule;
  } catch {
    return null;
  }
}

export async function getManagers(): Promise<Manager[]> {
  const kv = await getKV();
  if (kv) {
    try {
      const data = await kv.kv.get<Manager[]>('managers');
      return data || [];
    } catch {
      // fall through to mem
    }
  }
  return mem.managers;
}

export async function setManagers(managers: Manager[]): Promise<void> {
  const kv = await getKV();
  if (kv) {
    try {
      await kv.kv.set('managers', managers);
      return;
    } catch {
      // fall through to mem
    }
  }
  mem.managers = managers;
}

export async function getScripts(): Promise<Scripts> {
  const kv = await getKV();
  if (kv) {
    try {
      const data = await kv.kv.get<Scripts>('scripts');
      return data || { ...DEFAULT_SCRIPTS };
    } catch {
      // fall through to mem
    }
  }
  return mem.scripts;
}

export async function setScripts(scripts: Scripts): Promise<void> {
  const kv = await getKV();
  if (kv) {
    try {
      await kv.kv.set('scripts', scripts);
      return;
    } catch {
      // fall through to mem
    }
  }
  mem.scripts = scripts;
}
