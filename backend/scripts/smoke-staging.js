// backend/scripts/smoke-staging.js
// ⭐ №397: короткий smoke-тест «живой ли стенд» — для staging и для прода после деплоя.
//
// Запуск:  node scripts/smoke-staging.js                       # http://127.0.0.1:3000
//          API_BASE=http://127.0.0.1:3101 node scripts/smoke-staging.js
//          API_BASE=https://api.frame-app.ru node scripts/smoke-staging.js
//
// Что проверяет (без Prisma напрямую):
//   1) /health отвечает 200;
//   2) регистрация по коду (devCode) и вход;
//   3) демо-объект «Квартира-образец» создан регистрацией;
//   4) создание проекта и строки сметы с ценами;
//   5) фиксация объёма отражается в смете (totalUsed, процент);
//   6) удаление аккаунта (DELETE /users/me) — убираем за собой.
//
// Особенность: DELETE /users/me — обезличивание (email = null), строка пользователя остаётся.
// На staging её можно вычистить `delete from "User" where email is null;`, на проде безвредно.
//
// ВАЖНО: создаёт только *@local.test и только на указанном API_BASE. Данные реальных
// пользователей не трогает.

const BASE = (process.env.API_BASE || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const stamp = Date.now();
const EMAIL = process.env.SMOKE_EMAIL || `smoke_${stamp}@local.test`;

const results = [];
let failed = 0;

const api = async (path, opts = {}, token) => {
  const res = await fetch(BASE + path, {
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
  return { status: res.status, data };
};

const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ ok: true, name });
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failed += 1;
    results.push({ ok: false, name, error: error.message });
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
};

const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};
const expectStatus = (res, expected, label) => {
  const list = Array.isArray(expected) ? expected : [expected];
  expect(
    list.includes(res.status),
    `${label}: ожидали ${list.join('/')}, получили ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`,
  );
};

(async () => {
  console.log(`\nSmoke ${BASE} (${new Date().toISOString()})\n`);
  let token = null;
  let objectId = null;
  let projectId = null;
  let materialId = null;

  await check('health отвечает 200', async () => {
    const res = await api('/health');
    expectStatus(res, 200, 'health');
    expect(res.data?.status === 'ok', `health: статус «${res.data?.status}»`);
  });

  await check('регистрация по коду и вход', async () => {
    const codeRes = await api('/auth/request-code', { method: 'POST', body: { email: EMAIL } });
    expectStatus(codeRes, [200, 201], 'request-code');
    expect(codeRes.data?.devCode, 'нет devCode — на проде код приходит письмом, нужен тестовый ящик');
    const verify = await api('/auth/verify', {
      method: 'POST',
      body: { email: EMAIL, code: codeRes.data.devCode },
    });
    expectStatus(verify, [200, 201], 'verify');
    expect(verify.data?.access_token, 'нет access_token');
    token = verify.data.access_token;
    return EMAIL;
  });

  await check('демо-объект создан при регистрации', async () => {
    const res = await api('/objects', {}, token);
    expectStatus(res, 200, 'объекты');
    const objects = Array.isArray(res.data) ? res.data : res.data?.items;
    expect(Array.isArray(objects) && objects.length > 0, 'список объектов пуст');
    objectId = objects[0].id;
    return `object #${objectId}`;
  });

  await check('создание проекта', async () => {
    const res = await api(
      '/projects',
      {
        method: 'POST',
        body: {
          name: `Smoke проект ${stamp}`,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          objectId,
        },
      },
      token,
    );
    expectStatus(res, [200, 201], 'создание проекта');
    expect(res.data?.id, 'нет id проекта');
    projectId = res.data.id;
    return `project #${projectId}`;
  });

  await check('строка сметы с ценами', async () => {
    const res = await api(
      '/materials',
      {
        method: 'POST',
        body: {
          name: `Smoke строка ${stamp}`,
          unit: 'SQUARE_METER',
          specQuantity: 10,
          projectId,
          workPrice: 100,
          materialPrice: 50,
        },
      },
      token,
    );
    expectStatus(res, [200, 201], 'создание строки');
    materialId = res.data?.id;
    expect(materialId, 'нет id строки');
    expect(Number(res.data.unitPrice) === 100, `unitPrice=${res.data.unitPrice}`);
    return `material #${materialId}`;
  });

  await check('фиксация объёма попадает в смету', async () => {
    const fix = await api(`/materials/${materialId}/fix`, {
      method: 'POST',
      body: { amount: 4, note: 'smoke' },
    }, token);
    expectStatus(fix, [200, 201], 'фиксация');
    const rows = await api(`/materials/project/${projectId}`, {}, token);
    expectStatus(rows, 200, 'смета');
    const list = Array.isArray(rows.data) ? rows.data : rows.data?.items;
    const row = list.find((m) => m.id === materialId);
    expect(row, 'строки нет в смете');
    expect(Number(row.totalUsed) === 4, `totalUsed=${row.totalUsed}`);
    expect(Number(row.progressPercent) === 40, `progressPercent=${row.progressPercent}`);
    return `totalUsed=${row.totalUsed}, ${row.progressPercent}%`;
  });

  await check('удаление аккаунта (уборка за собой)', async () => {
    const res = await api('/users/me', { method: 'DELETE' }, token);
    expectStatus(res, [200, 204], 'удаление аккаунта');
    const after = await api('/objects', {}, token);
    expect(after.status === 401 || after.status === 403, `после удаления /objects: ${after.status}`);
  });

  console.log(`\nИтог: ${results.length - failed} ✅ / ${failed} ❌ из ${results.length}\n`);
  console.log('⚠️  DELETE /users/me обезличивает аккаунт и оставляет демо-объект — на dev после');
  console.log('    прогонов чистите SQL из docs/STAGING.md (раздел «Уборка после smoke»).\n');
  if (failed > 0) process.exit(1);
})().catch((error) => {
  console.error('❌ smoke упал:', error.message);
  process.exit(1);
});
