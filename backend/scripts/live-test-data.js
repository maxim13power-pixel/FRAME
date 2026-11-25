// backend/scripts/live-test-data.js
// ⭐ №398: данные для живого теста (и уборка за собой).
//
// Запуск:
//   node scripts/live-test-data.js                 # создать данные (300 строк по умолчанию)
//   node scripts/live-test-data.js --rows 400
//   node scripts/live-test-data.js --cleanup       # удалить всё, что создал (по ctx-файлу)
//
// Что создаёт:
//   • админ объекта  live_admin_<ts>@local.test  (владелец объекта и проекта);
//   • прораб со СКРЫТЫМИ ЦЕНАМИ live_foreman_<ts>@local.test (по ссылке-приглашению);
//   • объект «Тест живой 28.11» + проект «Смета на 300 строк»;
//   • строки сметы с ценами (по умолчанию 300, --rows N) и фиксации у каждой третьей;
//   • файл live-test-ctx.json с id — по нему работает --cleanup.
//
// Коды входа: на dev SMTP не настроен, поэтому код приходит в ответе /auth/request-code
// (devCode) и пишется в лог бэкенда как «[DEV MODE] Код верификации для …». Скрипт печатает
// свежие коды при создании; если код истёк — запросите новый (кнопка «получить код» в UI)
// и посмотрите backend-dev.log.
//
// Безопасность: только *@local.test, уборка по записанным id (объект удаляется каскадом).

const fs = require('fs');
const path = require('path');

const BASE = (process.env.API_BASE || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const CTX_FILE = path.join(__dirname, '..', '..', 'live-test-ctx.json');
const stamp = Date.now();
const args = process.argv.slice(2);
const cleanupMode = args.includes('--cleanup');
const rowsArg = args.indexOf('--rows');
const ROWS = rowsArg >= 0 ? Number(args[rowsArg + 1]) || 300 : 300;

const api = async (p, opts = {}, token) => {
  const res = await fetch(BASE + p, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (res.status >= 400) throw new Error(`${p} → ${res.status} ${String(text).slice(0, 300)}`);
  return data;
};

const register = async (email) => {
  const code = await api('/auth/request-code', { method: 'POST', body: { email } });
  const verify = await api('/auth/verify', { method: 'POST', body: { email, code: code.devCode } });
  return { email, token: verify.access_token, userId: verify.user?.id, code: code.devCode };
};

const createData = async () => {
  console.log(`Создаю данные на ${BASE}, строк: ${ROWS}`);

  const admin = await register(`live_admin_${stamp}@local.test`);
  const objects = await api('/objects', {}, admin.token);
  const demo = objects[0];
  if (!demo) throw new Error('у админа нет демо-объекта');
  // Переименовываем демо-объект, чтобы в тесте он был узнаваемым
  await api(`/objects/${demo.id}`, { method: 'PATCH', body: { name: `Тест живой 28.11 (${stamp % 1000})` } }, admin.token);

  const project = await api('/projects', {
    method: 'POST',
    body: {
      name: `Смета на ${ROWS} строк`,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      objectId: demo.id,
    },
  }, admin.token);

  // Второй участник: прораб со скрытыми ценами (проверяем маскировку в живом тесте)
  const foreman = await register(`live_foreman_${stamp}@local.test`);
  const link = await api(`/objects/${demo.id}/invite-link`, {
    method: 'POST',
    body: { role: 'FOREMAN', hidePrices: true },
  }, admin.token);
  await api(`/invite/${link.token}/accept`, { method: 'POST', body: {} }, foreman.token);

  const materialIds = [];
  const started = Date.now();
  for (let i = 1; i <= ROWS; i += 1) {
    const row = await api('/materials', {
      method: 'POST',
      body: {
        name: `Позиция ${String(i).padStart(3, '0')} — ${i % 4 === 0 ? 'штукатурка стен' : i % 3 === 0 ? 'укладка плитки' : 'монтаж каркаса'}`,
        article: `L-${1000 + i}`,
        unit: i % 4 === 0 ? 'SQUARE_METER' : i % 3 === 0 ? 'PIECE' : 'LINEAR_METER',
        specQuantity: (i % 20) + 1,
        note: i % 7 === 0 ? 'примечание строки' : undefined,
        projectId: project.id,
        workPrice: 100 + i,
        materialPrice: 50 + (i % 9),
      },
    }, admin.token);
    materialIds.push(row.id);
  }
  console.log(`  строки: ${materialIds.length} за ${Date.now() - started} мс`);

  let fixes = 0;
  for (let i = 0; i < materialIds.length; i += 3) {
    await api(`/materials/${materialIds[i]}/fix`, {
      method: 'POST',
      body: { amount: (i % 4) + 1, note: 'живой тест' },
    }, admin.token);
    fixes += 1;
  }
  console.log(`  фиксации: ${fixes}`);

  const ctx = {
    createdAt: new Date().toISOString(),
    base: BASE,
    objectId: demo.id,
    projectId: project.id,
    admin: { email: admin.email, userId: admin.userId },
    foreman: { email: foreman.email, userId: foreman.userId },
    materials: materialIds.length,
    fixes,
  };
  fs.writeFileSync(CTX_FILE, JSON.stringify(ctx, null, 2), 'utf8');

  console.log(`\nГотово. ctx: ${CTX_FILE}`);
  console.log(`  админ:  ${admin.email}`);
  console.log(`  прораб: ${foreman.email} (скрытые цены)`);
  console.log(`  объект #${demo.id}, проект #${project.id}`);
  console.log('\nВход в UI: введите e-mail → «получить код» → код смотрите в backend-dev.log');
  console.log('(строка «[DEV MODE] Код верификации для <email>: 123456») или запросите код у Cline.');
};

const cleanup = async () => {
  if (!fs.existsSync(CTX_FILE)) {
    console.error(`нет ${CTX_FILE} — нечего убирать`);
    process.exit(1);
  }
  const ctx = JSON.parse(fs.readFileSync(CTX_FILE, 'utf8'));
  console.log(`Убираю данные из ${ctx.base} (созданы ${ctx.createdAt})`);

  // Удаляем через Prisma: каскад по объекту снимает проекты, строки, фиксации, доступы.
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  process.env.DATABASE_URL = env.match(/DATABASE_URL\s*=\s*"?([^"\r\n]+)/)[1].trim();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const userIds = [ctx.admin?.userId, ctx.foreman?.userId].filter(Boolean);
    if (ctx.objectId) {
      await prisma.object.deleteMany({ where: { id: ctx.objectId } });
      console.log(`  объект #${ctx.objectId} удалён (каскадом: проекты, строки, фиксации)`);
    }
    if (userIds.length > 0) {
      await prisma.priceCatalog.deleteMany({ where: { ownerId: { in: userIds } } }); // onDelete: Restrict
      await prisma.accessRequest.deleteMany({ where: { requesterId: { in: userIds } } });
      await prisma.inviteToken.deleteMany({ where: { createdBy: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.brigade.deleteMany({ where: { createdBy: { in: userIds } } });
      for (const id of userIds) {
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
      console.log(`  пользователей удалено: ${userIds.length}`);
    }
    const left = await prisma.user.count({ where: { email: { endsWith: '@local.test' } } });
    console.log(`  осталось *@local.test в базе: ${left}`);
  } finally {
    await prisma.$disconnect();
    fs.unlinkSync(CTX_FILE);
    console.log('  ctx-файл удалён');
  }
};

if (cleanupMode) {
  cleanup().catch((error) => {
    console.error('❌ уборка не удалась:', error.message);
    process.exit(1);
  });
} else {
  createData().catch((error) => {
    console.error('❌ создание данных не удалось:', error.message);
    process.exit(1);
  });
}

