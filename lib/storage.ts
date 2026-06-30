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
  ru: `🔵 СКРИПТ ЗВОНКА (RU)

1. ПРИВЕТСТВИЕ
«Здравствуйте! Меня зовут [Имя], я из компании [Название]. Мы — частная компания, помогаем продавцам Kaspi подключиться к НКТ. Удобно сейчас минуту поговорить?»
Если «занят» → «Хорошо, когда удобно перезвонить — утром или после обеда?»

2. ВЫЯВЛЕНИЕ
«Вы продаёте на Kaspi, верно? Сколько у вас примерно товаров в каталоге?»
(слушаем ответ — это нужно для расчёта цены)

3. БОЛЬ
«Вы уже слышали про НКТ — Национальный каталог товаров? С 1 июля 2026 года все товары на Kaspi обязаны иметь NTIN-код, иначе торговать ими будет нельзя. До дедлайна осталось не так много времени.»

4. ОФФЕР
«Мы берём на себя весь процесс: регистрируем ваши товары в НКТ, получаем NTIN-коды и сами вносим их в ваш кабинет Kaspi. Вам делать ничего не нужно.»

5. ЦЕНА
«При [X] товаров стоимость составит примерно [ЦЕНА] — это разовый платёж, без подписок.»

6. ДОЖИМ
«Если 1 июля наступит, а коды не готовы — товары просто перестанут продаваться, и вы потеряете в продажах больше, чем стоит наша услуга. Давайте я отправлю вам реквизиты в WhatsApp прямо сейчас и начнём — это займёт 1-2 дня.»

7. ВОЗРАЖЕНИЯ
«Сам разберусь» → «Можно, но классификация ОКТРУ сложная — ошибка = отказ модерации. Мы делаем с гарантией за 1-2 дня.»
«Дорого» → «Это разовый платёж. Заблокированные товары на Kaspi обойдутся дороже за один день простоя.»
«Подумаю» → «Конечно. Только учтите — чем ближе к 1 июля, тем больше очередь у нас и у самого НКТ. Лучше начать заранее.»`,

  kz: `🔵 ҚОҢЫРАУ СЦЕНАРИЙІ (KZ)

1. АШЫЛУ
«Сәлеметсіз бе! Менің атым [Есім], мен [Компания атауы] компаниясынанмын. Біз — жеке компания, Kaspi сатушыларына ҰТК-ға қосылуға көмектесеміз. Қазір бір минут сөйлесуге ыңғайлы ма?»
Егер «бос емеспін» → «Жақсы, қашан қайта хабарласайын — таңертең бе, түстен кейін бе?»

2. АНЫҚТАУ
«Сіз Kaspi-де сатасыз ба? Каталогыңызда шамамен қанша тауар бар?»
(жауапты тыңдаймыз — баға есептеу үшін керек)

3. МӘСЕЛЕ
«ҰТК — Ұлттық тауар каталогы туралы естідіңіз бе? 2026 жылдың 1 шілдесінен бастап Kaspi-дегі барлық тауарларда NTIN-код болуы керек, болмаса олармен сауда жасауға болмайды. Дедлайнға дейін көп уақыт қалған жоқ.»

4. ҰСЫНЫС
«Біз барлық процесті өзімізге аламыз: тауарларыңызды ҰТК-ға тіркейміз, NTIN-кодтарды аламыз және өзіміз Kaspi кабинетіңізге енгіземіз. Сізге ештеңе жасаудың қажеті жоқ.»

5. БАҒА
«[X] тауарға баға шамамен [ЦЕНА] құрайды — бұл бір реттік төлем, жазылым жоқ.»

6. ЖАБУ
«1 шілде келгенде кодтар дайын болмаса — тауарлар сатылмай қалады, сіз біздің қызметтің құнынан көп шығынданасыз. Қазір сізге WhatsApp-қа деректерді жіберейін, бастайық — бұл 1-2 күн алады.»

7. ҚАРСЫЛЫҚТАР
«Өзім шешемін» → «Болады, бірақ ОКТРУ жіктемесі күрделі — қате жасасаңыз, модерация қабылдамайды. Біз кепілдікпен 1-2 күнде жасаймыз.»
«Қымбат» → «Бұл бір реттік төлем. Kaspi-де бұғатталған тауарлар бір күндік тоқтаудан да қымбатқа түседі.»
«Ойланайын» → «Әрине. Тек ескеріңіз — 1 шілдеге жақындаған сайын кезек көбейеді. Алдын ала бастаған дұрыс.»`,
};

function getDb() {
  // Try multiple env vars — Neon/Vercel may expose different ones
  const raw =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!raw) throw new Error('DATABASE_URL не задан');

  // Strip params unsupported by @neondatabase/serverless HTTP driver
  const url = raw
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/[?&]connect_timeout=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/&&/g, '&')
    .replace(/[?&]$/, '');

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
