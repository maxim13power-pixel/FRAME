// backend/scripts/api-regression.js
// ⭐ №355: регрессия по API для самых сложных разделов (объекты → проекты → сметы → доступы).
//
// Запуск:  npm --prefix backend run test:api
// Требует: backend на :3000, БД из backend/.env (DATABASE_URL).
// Создаёт временных пользователей *@local.test и удаляет их вместе с объектами в конце.
// Ничего не делает с данными реальных пользователей: трогает только объекты,
// в доступе которых есть тестовые пользователи.

const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
process.env.DATABASE_URL = env
  .match(/DATABASE_URL\s*=\s*"?([^"\r\n]+)/)[1]
  .trim();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = process.env.API_BASE || 'http://localhost:3000';
const stamp = Date.now();

const results = [];
let failures = 0;

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
  return { status: res.status, data };
};

const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};

const check = async (name, fn) => {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failures += 1;
    results.push({ ok: false, name, error: error.message });
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
};

const expectStatus = (res, expected, label) => {
  const exp = Array.isArray(expected) ? expected : [expected];
  expect(
    exp.includes(res.status),
    `${label}: ожидали ${exp.join('/')}, получили ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`,
  );
};

const register = async (name) => {
  const email = `regr_${name}_${stamp}@local.test`;
  const codeRes = await api('/auth/request-code', {
    method: 'POST',
    body: { email },
  });
  expectStatus(codeRes, [200, 201], `request-code ${name}`);
  const verifyRes = await api('/auth/verify', {
    method: 'POST',
    body: { email, code: codeRes.data.devCode },
  });
  expectStatus(verifyRes, [200, 201], `verify ${name}`);
  return { email, token: verifyRes.data.access_token, userId: verifyRes.data.user.id };
};

const accessList = async (objectId, token) =>
  (await api(`/objects/${objectId}/access`, {}, token)).data;

const findGrant = async (objectId, token, userId) => {
  const rows = await accessList(objectId, token);
  return rows.find((r) => r.userId === userId && !r.revokedAt) ?? null;
};

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@local.test' } },
    select: { id: true, email: true },
  });
  const objectIds = new Set();
  for (const u of users) {
    const rows = await prisma.objectAccess.findMany({
      where: { userId: u.id },
      select: { objectId: true },
    });
    rows.forEach((r) => objectIds.add(r.objectId));
  }
  if (objectIds.size > 0) {
    await prisma.object.deleteMany({ where: { id: { in: [...objectIds] } } });
  }
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.priceCatalog.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.accessRequest.deleteMany({ where: { requesterId: { in: ids } } });
    await prisma.inviteToken.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  }
  for (const u of users) {
    await prisma.verificationToken.deleteMany({ where: { email: u.email } });
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  }
}

async function main() {
  console.log(`\nРегрессия API ${BASE} (${new Date().toISOString()})\n`);

  // ── Подготовка ─────────────────────────────────────────────
  const admin = await register('admin');
  const foreman = await register('foreman');
  const viewer = await register('viewer');
  const projectOnly = await register('project');
  const mergeUser = await register('merge');
  const requester = await register('requester');
  const secondAdmin = await register('admin2');
  const hiddenAdmin = await register('hiddenadmin');
  const pricesWorker = await register('pricesworker');
  const participants = [
    foreman,
    viewer,
    projectOnly,
    mergeUser,
    requester,
    secondAdmin,
    hiddenAdmin,
    pricesWorker,
  ];

  // ⭐ При регистрации каждому создаётся демо-объект — у участников его убираем,
  // иначе он попадает в дашборд и счётчики (и «наблюдатель видит деньги» — это его собственный объект).
  const dropOwnObjects = async (user) => {
    const own = await prisma.objectAccess.findMany({
      where: { userId: user.userId, projectId: null, role: 'CUSTOMER' },
      select: { objectId: true },
    });
    if (own.length > 0) {
      await prisma.object.deleteMany({ where: { id: { in: own.map((o) => o.objectId) } } });
    }
  };
  for (const user of participants) await dropOwnObjects(user);

  const objectsRes = await api('/objects', {}, admin.token);
  expectStatus(objectsRes, 200, 'список объектов админа');
  const object = objectsRes.data[0];
  expect(!!object, 'у админа нет объекта (демо-объект не создался)');

  const projectsRes = await api(`/projects/object/${object.id}`, {}, admin.token);
  expectStatus(projectsRes, 200, 'проекты объекта');
  const [project1, project2] = projectsRes.data;
  expect(!!project1 && !!project2, 'нужно минимум 2 проекта для проверок');

  const createLink = async (body) => {
    const res = await api(`/objects/${object.id}/invite-link`, { method: 'POST', body }, admin.token);
    expectStatus(res, [200, 201], 'создание ссылки');
    return res.data;
  };
  const accept = async (token, user, body = {}) =>
    api(`/invite/${token}/accept`, { method: 'POST', body }, user.token);
  const inviteLinks = async (projectId) =>
    (
      await api(
        `/objects/${object.id}/invite-links${projectId ? `?projectId=${projectId}` : ''}`,
        {},
        admin.token,
      )
    ).data;

  // ── 1. Базовые доступы и деньги ───────────────────────────
  console.log('1. Доступы и деньги');

  let link;
  await check('ссылка FOREMAN выдаёт доступ на объект', async () => {
    link = await createLink({ role: 'FOREMAN' });
    const res = await accept(link.token, foreman);
    expectStatus(res, [200, 201], 'принятие ссылки');
    const grant = await findGrant(object.id, admin.token, foreman.userId);
    expect(grant && grant.role === 'FOREMAN', `роль доступа: ${grant && grant.role}`);
  });

  await check('прораб не видит список участников (403)', async () => {
    expectStatus(await api(`/objects/${object.id}/access`, {}, foreman.token), 403, 'список участников');
  });

  await check('прораб не может выдавать доступ (403)', async () => {
    const res = await api(
      `/objects/${object.id}/access`,
      { method: 'POST', body: { userId: viewer.userId, role: 'VIEWER' } },
      foreman.token,
    );
    expectStatus(res, 403, 'выдача доступа');
  });

  await check('наблюдатель со скрытыми ценами получает доступ', async () => {
    const viewerLink = await createLink({ role: 'VIEWER', hidePrices: true });
    expectStatus(await accept(viewerLink.token, viewer), [200, 201], 'принятие ссылки наблюдателя');
    const grant = await findGrant(object.id, admin.token, viewer.userId);
    expect(grant?.hidePrices === true, 'у наблюдателя должен быть hidePrices');
  });

  let material;
  await check('админ создаёт материал с ценами', async () => {
    const res = await api('/materials', {
      method: 'POST',
      body: {
        name: `Регресс-материал ${stamp}`,
        unit: 'SQUARE_METER',
        specQuantity: 10,
        projectId: project1.id,
        workPrice: 100,
        materialPrice: 50,
      },
    }, admin.token);
    expectStatus(res, [200, 201], 'создание материала');
    material = res.data;
    expect(Number(material.unitPrice) === 100, `unitPrice: ${material.unitPrice}`);
    // totalCost считается по ФАКТУ (totalUsed), а не по спецификации — пока факта нет, 0
    expect(Number(material.materialUnitPrice) === 50, `materialUnitPrice: ${material.materialUnitPrice}`);
    expect(Number(material.totalCost) === 0, `totalCost без факта: ${material.totalCost}`);
  });

  await check('наблюдатель не видит цены в смете', async () => {
    const res = await api(`/materials/project/${project1.id}`, {}, viewer.token);
    expectStatus(res, 200, 'смета для наблюдателя');
    const rows = res.data.items ?? res.data;
    expect(Array.isArray(rows), 'ожидали массив материалов');
    const row = rows.find((r) => r.id === material.id);
    expect(row, 'материал не найден в смете');
    expect(Number(row.unitPrice) === 0, `unitPrice наблюдателя: ${row.unitPrice}`);
    expect(Number(row.totalCost) === 0, `totalCost наблюдателя: ${row.totalCost}`);
  });

  await check('прораб видит цены в смете', async () => {
    const res = await api(`/materials/project/${project1.id}`, {}, foreman.token);
    expectStatus(res, 200, 'смета для прораба');
    const rows = res.data.items ?? res.data;
    const row = rows.find((r) => r.id === material.id);
    expect(Number(row?.unitPrice) === 100, `unitPrice прораба: ${row?.unitPrice}`);
  });

  await check('наблюдатель не видит деньги в дашборде', async () => {
    const res = await api('/dashboard/summary', {}, viewer.token);
    expectStatus(res, 200, 'дашборд наблюдателя');
    expect(Number(res.data.money.actual) === 0, `money.actual: ${res.data.money.actual}`);
  });

  await check('админ видит деньги в дашборде', async () => {
    const res = await api('/dashboard/summary', {}, admin.token);
    expectStatus(res, 200, 'дашборд админа');
    expect(Number(res.data.money.actual) > 0, `money.actual: ${res.data.money.actual}`);
  });

  // ── 1b. Справочник цен (№356) ─────────────────────────────
  const flatItems = (payload) =>
    (Array.isArray(payload) ? payload : []).flatMap((c) => c.items ?? []);

  await check('флаг «вижу цены»: наблюдатель — нет, админ — да', async () => {
    const viewerFlag = await api('/me/access/price-visibility', {}, viewer.token);
    expectStatus(viewerFlag, 200, 'флаг наблюдателя');
    expect(viewerFlag.data.canSeeMoney === false, `наблюдатель: ${JSON.stringify(viewerFlag.data)}`);
    const adminFlag = await api('/me/access/price-visibility', {}, admin.token);
    expect(adminFlag.data.canSeeMoney === true, `админ: ${JSON.stringify(adminFlag.data)}`);
  });

  let adminItem;
  await check('админ видит цены в справочнике', async () => {
    const res = await api('/price-list/categories/full', {}, admin.token);
    expectStatus(res, 200, 'справочник админа');
    adminItem = flatItems(res.data).find((i) => i.price != null);
    expect(adminItem, 'у админа нет позиций с ценой');
  });

  await check('наблюдатель не видит цены в справочнике', async () => {
    const res = await api('/price-list/categories/full', {}, viewer.token);
    expectStatus(res, 200, 'справочник наблюдателя');
    const items = flatItems(res.data);
    expect(items.length > 0, 'справочник пуст (ожидали позиции без цен)');
    const priced = items.filter((i) => i.price != null);
    expect(priced.length === 0, `позиций с ценой: ${priced.length}`);
  });

  await check('поиск по справочнику не отдаёт цены наблюдателю', async () => {
    const res = await api('/price-list/items/search?search=а', {}, viewer.token);
    expectStatus(res, 200, 'поиск наблюдателя');
    const items = Array.isArray(res.data) ? res.data : res.data.items ?? [];
    expect(items.length > 0, 'поиск ничего не вернул');
    const priced = items.filter((i) => i.price != null);
    expect(priced.length === 0, `позиций с ценой в поиске: ${priced.length}`);
  });

  await check('наблюдатель не может менять цены справочника', async () => {
    const res = await api(
      `/price-list/items/${adminItem.id}`,
      { method: 'PATCH', body: { price: 1 } },
      viewer.token,
    );
    expectStatus(res, 403, 'правка цены наблюдателем');
  });

  // ── 2. Проектный доступ ───────────────────────────────────
  console.log('\n2. Проектный доступ');

  await check('ссылка в проект выдаёт доступ только к проекту', async () => {
    const projectLink = await createLink({ role: 'VIEWER', projectId: project1.id });
    expectStatus(await accept(projectLink.token, projectOnly), [200, 201], 'принятие ссылки в проект');
    const grant = await findGrant(object.id, admin.token, projectOnly.userId);
    expect(grant?.projectId === project1.id, `projectId: ${grant?.projectId}`);
  });

  await check('участник проекта видит свою смету', async () => {
    expectStatus(await api(`/materials/project/${project1.id}`, {}, projectOnly.token), 200, 'своя смета');
  });

  await check('участник проекта не видит чужой проект', async () => {
    const res = await api(`/materials/project/${project2.id}`, {}, projectOnly.token);
    expectStatus(res, [403, 404], 'чужая смета');
  });

  await check('удаление участника закрывает доступ', async () => {
    const grant = await findGrant(object.id, admin.token, projectOnly.userId);
    const res = await api(`/objects/${object.id}/access/${grant.id}`, { method: 'DELETE' }, admin.token);
    expectStatus(res, 200, 'удаление участника');
    expectStatus(
      await api(`/materials/project/${project1.id}`, {}, projectOnly.token),
      [403, 404],
      'смета после удаления',
    );
    const objects = await api('/objects', {}, projectOnly.token);
    expect(
      !objects.data.some((o) => o.id === object.id),
      'объект остался в списке удалённого участника',
    );
  });

  // ── 3. Ссылки ─────────────────────────────────────────────
  console.log('\n3. Ссылки-приглашения');

  await check('повторное принятие ссылки не сжигает её', async () => {
    const before = (await inviteLinks()).find((l) => l.token === link.token);
    const again = await accept(link.token, foreman);
    expectStatus(again, [200, 201], 'повторное принятие');
    expect(again.data.alreadyHasAccess === true, 'ожидали alreadyHasAccess');
    const after = (await inviteLinks()).find((l) => l.token === link.token);
    expect(after.usesCount === before.usesCount, `счётчик вырос: ${before.usesCount} → ${after.usesCount}`);
  });

  await check('истёкшая ссылка не принимается', async () => {
    const expired = await createLink({ role: 'VIEWER' });
    await prisma.inviteToken.update({
      where: { token: expired.token },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const res = await accept(expired.token, projectOnly);
    expectStatus(res, 400, 'истёкшая ссылка');
  });

  await check('отозванная ссылка не принимается', async () => {
    const revoked = await createLink({ role: 'VIEWER' });
    const list = await inviteLinks();
    const row = list.find((l) => l.token === revoked.token);
    expectStatus(
      await api(`/objects/${object.id}/invite-links/${row.id}`, { method: 'DELETE' }, admin.token),
      200,
      'отзыв ссылки',
    );
    const res = await accept(revoked.token, projectOnly);
    expectStatus(res, [400, 404], 'отозванная ссылка');
  });

  await check('ссылка обновляет уже выданный доступ', async () => {
    const before = await findGrant(object.id, admin.token, foreman.userId);
    expect(before.role === 'FOREMAN', `исходная роль: ${before.role}`);
    const downgrade = await createLink({ role: 'VIEWER', hidePrices: true });
    const status = await api(`/invite/${downgrade.token}/status`, {}, foreman.token);
    expectStatus(status, 200, 'статус ссылки');
    expect(status.data.changes?.role?.to === 'VIEWER', 'статус не показал понижение');
    const res = await accept(downgrade.token, foreman);
    expectStatus(res, [200, 201], 'применение ссылки');
    expect(res.data.updated === true, 'ожидали updated');
    const after = await findGrant(object.id, admin.token, foreman.userId);
    expect(after.role === 'VIEWER' && after.hidePrices === true, `стало: ${after.role}/${after.hidePrices}`);
    const back = await api(
      `/objects/${object.id}/access/${after.id}`,
      { method: 'PATCH', body: { role: 'FOREMAN', hidePrices: false } },
      admin.token,
    );
    expectStatus(back, 200, 'возврат роли прораба');
  });

  await check('последний администратор не понижается по ссылке', async () => {
    const selfLink = await createLink({ role: 'VIEWER', hidePrices: true });
    const status = await api(`/invite/${selfLink.token}/status`, {}, admin.token);
    expectStatus(status, 200, 'статус ссылки админа');
    expect(status.data.blocked === true, 'статус не заблокирован');
    const res = await accept(selfLink.token, admin);
    expectStatus(res, 400, 'понижение последнего админа');
    const grant = await findGrant(object.id, admin.token, admin.userId);
    expect(grant.role === 'CUSTOMER', `роль админа: ${grant.role}`);
  });

  await check('со вторым администратором понижение проходит', async () => {
    const adminLink = await createLink({ role: 'CUSTOMER' });
    expectStatus(await accept(adminLink.token, secondAdmin), [200, 201], 'второй админ');
    const downLink = await createLink({ role: 'VIEWER' });
    const res = await accept(downLink.token, secondAdmin);
    expectStatus(res, [200, 201], 'понижение второго админа');
    expect(res.data.updated === true, 'ожидали updated');
    const grant = await findGrant(object.id, admin.token, secondAdmin.userId);
    await api(
      `/objects/${object.id}/access/${grant.id}`,
      { method: 'PATCH', body: { role: 'CUSTOMER' } },
      admin.token,
    );
  });

  // ── 4. Слияние доступов ───────────────────────────────────
  console.log('\n4. Слияние доступов');

  await check('проектные доступы сливаются в объектный', async () => {
    for (const p of [project1, project2]) {
      const l = await createLink({ role: 'VIEWER', projectId: p.id });
      expectStatus(await accept(l.token, mergeUser), [200, 201], `ссылка в проект ${p.id}`);
    }
    const objectLink = await createLink({ role: 'FOREMAN' });
    const res = await accept(objectLink.token, mergeUser);
    expectStatus(res, [200, 201], 'объектная ссылка');
    expect(res.data.mergedProjects === 2, `mergedProjects: ${res.data.mergedProjects}`);
    const rows = (await accessList(object.id, admin.token)).filter(
      (r) => r.userId === mergeUser.userId && !r.revokedAt,
    );
    expect(rows.length === 1 && rows[0].projectId == null, `записей: ${rows.length}`);
  });

  await check('ссылка в проект при объектном доступе ничего не меняет', async () => {
    const l = await createLink({ role: 'VIEWER', projectId: project1.id });
    const res = await accept(l.token, mergeUser);
    expectStatus(res, [200, 201], 'проектная ссылка при объектном доступе');
    expect(res.data.alreadyHasAccess === true, 'ожидали alreadyHasAccess');
  });

  // ── 5. Заявки на право создавать проекты ──────────────────
  console.log('\n5. Заявки');

  let requestId;
  await check('прораб без флага подаёт заявку', async () => {
    const l = await createLink({ role: 'FOREMAN', canCreateProjects: false });
    expectStatus(await accept(l.token, requester), [200, 201], 'доступ прорабу');
    const res = await api(`/objects/${object.id}/access-requests`, { method: 'POST', body: {} }, requester.token);
    expectStatus(res, 201, 'подача заявки');
  });

  await check('повторная заявка отклоняется', async () => {
    const res = await api(`/objects/${object.id}/access-requests`, { method: 'POST', body: {} }, requester.token);
    expectStatus(res, 400, 'повторная заявка');
  });

  await check('админ одобряет заявку', async () => {
    const list = await api(`/objects/${object.id}/access-requests`, {}, admin.token);
    expectStatus(list, 200, 'входящие заявки');
    const pending = list.data.find((r) => r.requesterId === requester.userId && r.status === 'PENDING');
    expect(pending, 'заявка не найдена');
    requestId = pending.id;
    expectStatus(await api(`/access-requests/${requestId}/approve`, { method: 'POST' }, admin.token), [200, 201], 'одобрение');
    const grant = await findGrant(object.id, admin.token, requester.userId);
    expect(grant.canCreateProjects === true, 'флаг не появился');
  });

  await check('после одобрения заявка снова не подаётся', async () => {
    const res = await api(`/objects/${object.id}/access-requests`, { method: 'POST', body: {} }, requester.token);
    expectStatus(res, 400, 'заявка после одобрения');
  });

  // ── 6. Запреты и кандидаты ────────────────────────────────
  console.log('\n6. Запреты и кандидаты');

  await check('нельзя удалить собственный доступ', async () => {
    const own = await findGrant(object.id, admin.token, admin.userId);
    expectStatus(await api(`/objects/${object.id}/access/${own.id}`, { method: 'DELETE' }, admin.token), 400, 'самоудаление');
  });

  await check('«Администратор» в проект не выдаётся', async () => {
    const res = await api(
      `/objects/${object.id}/access`,
      { method: 'POST', body: { userId: viewer.userId, role: 'CUSTOMER', projectId: project1.id } },
      admin.token,
    );
    expectStatus(res, 400, 'CUSTOMER в проект');
  });

  await check('нельзя добавить в проект при объектном доступе', async () => {
    const res = await api(
      `/objects/${object.id}/access`,
      { method: 'POST', body: { userId: viewer.userId, role: 'VIEWER', projectId: project1.id } },
      admin.token,
    );
    expectStatus(res, 409, 'проект при объектном доступе');
  });

  await check('кандидаты помечают объектный доступ', async () => {
    const res = await api(
      `/objects/${object.id}/access/candidates?projectId=${project1.id}`,
      {},
      admin.token,
    );
    expectStatus(res, 200, 'кандидаты');
    const foremanRow = res.data.find((c) => c.userId === foreman.userId);
    expect(foremanRow?.objectWide === true, 'objectWide не выставлен');
  });

  await check('админ со скрытыми ценами не открывает чужие', async () => {
    const l = await createLink({ role: 'CUSTOMER', hidePrices: true });
    expectStatus(await accept(l.token, hiddenAdmin), [200, 201], 'скрытый админ');
    // цель должна СЕЙЧАС иметь скрытые цены, иначе менять нечего
    const workerLink = await createLink({ role: 'FOREMAN', hidePrices: true });
    expectStatus(await accept(workerLink.token, pricesWorker), [200, 201], 'прораб со скрытыми ценами');
    const target = await findGrant(object.id, admin.token, pricesWorker.userId);
    expect(target?.hidePrices === true, 'у цели должны быть скрытые цены');
    const res = await api(
      `/objects/${object.id}/access/${target.id}`,
      { method: 'PATCH', body: { hidePrices: false } },
      hiddenAdmin.token,
    );
    expectStatus(res, 403, 'открытие цен скрытым админом');
  });

  // ── 7. Пересчёт цен ───────────────────────────────────────
  console.log('\n7. Пересчёт цен');

  await check('превью пересчёта с наценкой 10 %', async () => {
    const res = await api(
      `/projects/${project1.id}/price-recalc/preview?workMarkupPercent=10`,
      {},
      admin.token,
    );
    expectStatus(res, 200, 'превью');
    const rows = res.data.rows ?? res.data.items ?? [];
    const row = rows.find((r) => r.materialId === material.id || r.id === material.id);
    expect(row, 'строка не попала в превью');
  });

  await check('пересчёт применяется и меняет цену', async () => {
    const res = await api(
      `/projects/${project1.id}/price-recalc`,
      { method: 'POST', body: { workMarkupPercent: 10 } },
      admin.token,
    );
    expectStatus(res, [200, 201], 'применение пересчёта');
    const payload = (await api(`/materials/project/${project1.id}`, {}, admin.token)).data;
    const rows = payload.items ?? payload;
    const row = rows.find((r) => r.id === material.id);
    expect(row, 'материал не найден после пересчёта');
    expect(Number(row.unitPrice) === 110, `unitPrice после пересчёта: ${row?.unitPrice}`);
  });

  await check('история пересчёта доступна', async () => {
    const res = await api(`/projects/${project1.id}/price-recalc/history`, {}, admin.token);
    expectStatus(res, 200, 'история');
    expect(Array.isArray(res.data) && res.data.length >= 1, 'история пуста');
  });

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\nИтог: ${results.length - failed.length} ✅ / ${failed.length} ❌ из ${results.length}`,
  );
  if (failed.length > 0) {
    console.log('\nПровалы:');
    failed.forEach((f) => console.log(`  • ${f.name}\n    ${f.error}`));
  }
  return failures === 0;
}

let ok = false;
main()
  .then((result) => {
    ok = result;
  })
  .catch((error) => {
    console.error('\nРегрессия не запустилась:', error);
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log('тестовые данные удалены');
    } catch (error) {
      console.error('Ошибка очистки:', error);
    }
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  });
