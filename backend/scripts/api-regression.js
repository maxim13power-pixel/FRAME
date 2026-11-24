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
const ExcelJS = require('exceljs');
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

// ⭐ №364: запоминаем id — если проверка «удаление аккаунта» вдруг пройдёт,
// пользователь обезличивается (email = null) и его уже не найти по почте.
const createdUserIds = [];
const createdObjectIds = [];

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
  createdUserIds.push(verifyRes.data.user.id);
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
    where: {
      OR: [
        { email: { endsWith: '@local.test' } },
        { id: { in: createdUserIds } },
      ],
    },
    select: { id: true, email: true },
  });
  const objectIds = new Set(createdObjectIds);
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
    await prisma.brigade.deleteMany({ where: { createdBy: { in: ids } } });
  }
  for (const u of users) {
    if (u.email) {
      await prisma.verificationToken.deleteMany({ where: { email: u.email } });
    }
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
  // ⭐ №367: прораб только на одном проекте (проверка среза выходов и прав)
  const projForeman = await register('projforeman');
  // ⭐ №357: пользователь с «смешанными» ролями — наблюдатель здесь, админ своего объекта
  const mixed = await register('mixed');
  const participants = [
    foreman,
    viewer,
    projectOnly,
    mergeUser,
    requester,
    secondAdmin,
    hiddenAdmin,
    pricesWorker,
    projForeman,
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
  createdObjectIds.push(object.id);

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

  // ── 1b. Справочник цен (№358) ─────────────────────────────
  const flatItems = (payload) =>
    (Array.isArray(payload) ? payload : []).flatMap((c) => c.items ?? []);

  let adminCatalog;
  await check('админ видит свой справочник в списке', async () => {
    const res = await api('/price-list/catalogs', {}, admin.token);
    expectStatus(res, 200, 'справочники админа');
    adminCatalog = res.data.find((c) => c.ownerId === admin.userId);
    expect(adminCatalog, 'у админа нет своего справочника');
  });

  let adminItem;
  await check('админ видит цены в справочнике', async () => {
    const res = await api('/price-list/categories/full', {}, admin.token);
    expectStatus(res, 200, 'справочник админа');
    adminItem = flatItems(res.data).find((i) => i.price != null);
    expect(adminItem, 'у админа нет позиций с ценой');
  });

  let viewerCatalog;
  let viewerItem;
  await check('наблюдатель видит свой справочник с ценами', async () => {
    const list = await api('/price-list/catalogs', {}, viewer.token);
    expectStatus(list, 200, 'справочники наблюдателя');
    viewerCatalog = list.data.find((c) => c.ownerId === viewer.userId);
    expect(viewerCatalog, 'свой справочник наблюдателя пропал из списка');
    const full = await api(
      `/price-list/categories/full?catalogId=${viewerCatalog.id}`,
      {},
      viewer.token,
    );
    const priced = flatItems(full.data).filter((i) => i.price != null);
    expect(priced.length > 0, 'в своём справочнике наблюдателя цены спрятаны');
    viewerItem = priced[0];
  });

  await check('объектный справочник скрыт от наблюдателя', async () => {
    const res = await api('/price-list/catalogs', {}, viewer.token);
    expectStatus(res, 200, 'справочники наблюдателя');
    const foreign = res.data.filter((c) => c.ownerId !== viewer.userId);
    expect(foreign.length === 0, `видны чужие справочники: ${foreign.map((c) => c.name).join(', ')}`);
    const leaked = res.data.find((c) => c.id === adminCatalog.id);
    expect(!leaked, 'справочник админа виден наблюдателю');
  });

  await check('в чужом объектном справочнике наблюдатель видит «—»', async () => {
    const res = await api(
      `/price-list/categories/full?catalogId=${adminCatalog.id}`,
      {},
      viewer.token,
    );
    expectStatus(res, 200, 'чужой справочник по прямой ссылке');
    const priced = flatItems(res.data).filter((i) => i.price != null);
    expect(priced.length === 0, `позиций с ценой в чужом справочнике: ${priced.length}`);
  });

  await check('наблюдатель может менять цены в своём справочнике', async () => {
    const res = await api(
      `/price-list/items/${viewerItem.id}`,
      { method: 'PATCH', body: { price: 99 } },
      viewer.token,
    );
    expectStatus(res, 200, 'правка своей позиции');
    const back = await api(
      `/price-list/items/${viewerItem.id}`,
      { method: 'PATCH', body: { price: viewerItem.price } },
      viewer.token,
    );
    expectStatus(back, 200, 'возврат цены своей позиции');
  });

  await check('наблюдатель не может менять чужой объектный справочник', async () => {
    const res = await api(
      `/price-list/items/${adminItem.id}`,
      { method: 'PATCH', body: { price: 1 } },
      viewer.token,
    );
    expectStatus(res, 403, 'правка чужой позиции');
  });

  // ⭐ №357: наблюдатель в одном объекте и админ в своём — свой справочник видит
  await check('смешанные роли: свой справочник с ценами, чужой — скрыт', async () => {
    const link = await createLink({ role: 'VIEWER', hidePrices: true });
    expectStatus(await accept(link.token, mixed), [200, 201], 'наблюдатель в объекте');
    const list = await api('/price-list/catalogs', {}, mixed.token);
    expectStatus(list, 200, 'справочники смешанного');
    expect(!list.data.some((c) => c.id === adminCatalog.id), 'чужой объектный справочник виден');
    const own = list.data.find((c) => c.ownerId === mixed.userId);
    expect(own, 'свой справочник пропал');
    const full = await api(`/price-list/categories/full?catalogId=${own.id}`, {}, mixed.token);
    const priced = flatItems(full.data).filter((i) => i.price != null);
    expect(priced.length > 0, 'в своём справочнике цены спрятаны');
  });

  // ⭐ №361: жёсткое удаление справочника
  await check('свободный справочник удаляется навсегда', async () => {
    const created = await api(
      '/price-list/catalogs',
      { method: 'POST', body: { name: `Мусор ${Date.now()}` } },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание справочника');
    const del = await api(
      `/price-list/catalogs/${created.data.id}/permanent`,
      { method: 'DELETE' },
      admin.token,
    );
    expectStatus(del, 200, 'жёсткое удаление');
    const list = await api('/price-list/catalogs?includeArchived=1', {}, admin.token);
    expect(
      !list.data.some((c) => c.id === created.data.id),
      'удалённый справочник остался в списке',
    );
  });

  await check('привязанный или рабочий справочник удалить нельзя', async () => {
    const res = await api(
      `/price-list/catalogs/${adminCatalog.id}/permanent`,
      { method: 'DELETE' },
      admin.token,
    );
    expectStatus(res, 400, 'удаление привязанного справочника');
  });

  await check('чужой справочник удалить нельзя', async () => {
    const res = await api(
      `/price-list/catalogs/${adminCatalog.id}/permanent`,
      { method: 'DELETE' },
      viewer.token,
    );
    expectStatus(res, [403, 404], 'удаление чужого справочника');
  });

  // ⭐ №362: копия справочника с наценкой/скидкой
  await check('копия справочника с наценкой и скидкой', async () => {
    const copied = await api(
      `/price-list/catalogs/${adminCatalog.id}/copy`,
      {
        method: 'POST',
        body: {
          name: `Копия с наценкой ${Date.now()}`,
          workMarkupPercent: 10,
          materialMarkupPercent: -10,
        },
      },
      admin.token,
    );
    expectStatus(copied, [200, 201], 'копия справочника');
    const src = await api(
      `/price-list/categories/full?catalogId=${adminCatalog.id}`,
      {},
      admin.token,
    );
    const dst = await api(
      `/price-list/categories/full?catalogId=${copied.data.id}`,
      {},
      admin.token,
    );
    const key = (i) => `${i.kind}|${i.name}|${i.unit}`;
    const srcMap = new Map(flatItems(src.data).map((i) => [key(i), i]));
    const dstMap = new Map(flatItems(dst.data).map((i) => [key(i), i]));
    let checked = 0;
    for (const [k, s] of srcMap) {
      const d = dstMap.get(k);
      if (!d || s.price == null) continue;
      const pct = s.kind === 'WORK' ? 10 : -10;
      const expected = Math.round(Number(s.price) * (1 + pct / 100) * 100) / 100;
      expect(
        Math.abs(Number(d.price) - expected) < 0.011,
        `${k}: ${d.price} вместо ${expected}`,
      );
      checked += 1;
      if (checked >= 200) break;
    }
    expect(checked > 0, 'нечего сравнивать — копия пустая');
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

  await check('скрытому прорабу история пересчёта недоступна', async () => {
    const link = await createLink({ role: 'FOREMAN', hidePrices: true });
    expectStatus(await accept(link.token, pricesWorker), [200, 201], 'скрытый прораб');
    const res = await api(
      `/projects/${project1.id}/price-recalc/history`,
      {},
      pricesWorker.token,
    );
    expectStatus(res, 403, 'история для скрытого');
  });

  // ── 8. Бригады: выработка и права на деньги ───────────────
  console.log('\n8. Бригады');

  let brigadeId;
  const today = new Date().toISOString().slice(0, 10);
  await check('бригада: скрытый видит только свою выработку', async () => {
    const created = await api(
      '/brigades',
      { method: 'POST', body: { name: `Бригада ${stamp}`, objectId: object.id } },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание бригады');
    brigadeId = created.data.id;

    const adminShift = await api(
      `/brigades/${brigadeId}/shifts`,
      { method: 'POST', body: { date: today, hoursWorked: 8, outputValue: 1000 } },
      admin.token,
    );
    expectStatus(adminShift, [200, 201], 'выход админа');
    expect(Number(adminShift.data.outputValue) === 1000, 'админ не видит свою выработку');

    const viewerShifts = await api(`/brigades/${brigadeId}/shifts`, {}, viewer.token);
    expectStatus(viewerShifts, 200, 'выходы для наблюдателя');
    const viewerRow = viewerShifts.data.find((s) => s.id === adminShift.data.id);
    expect(viewerRow && viewerRow.outputValue == null, 'наблюдатель видит чужую выработку');
    const viewerStats = await api(`/brigades/${brigadeId}/stats`, {}, viewer.token);
    expect(viewerStats.data.totalOutputValue == null, 'наблюдатель видит итог выработки');

    const workerShift = await api(
      `/brigades/${brigadeId}/shifts`,
      { method: 'POST', body: { date: today, hoursWorked: 6, outputValue: 500 } },
      pricesWorker.token,
    );
    expectStatus(workerShift, [200, 201], 'выход скрытого прораба');

    const workerShifts = await api(`/brigades/${brigadeId}/shifts`, {}, pricesWorker.token);
    const own = workerShifts.data.find((s) => s.id === workerShift.data.id);
    const foreign = workerShifts.data.find((s) => s.id === adminShift.data.id);
    expect(Number(own?.outputValue) === 500, 'скрытый прораб не видит СВОЮ выработку');
    expect(foreign?.outputValue == null, 'скрытый прораб видит чужую выработку');

    const adminStats = await api(`/brigades/${brigadeId}/stats`, {}, admin.token);
    expect(Number(adminStats.data.totalOutputValue) === 1500, 'админ не видит итог выработки');
  });

  await check('битая дата фильтра выходов → 400', async () => {
    expectStatus(
      await api(`/brigades/${brigadeId}/shifts?from=abc`, {}, admin.token),
      400,
      'from=abc',
    );
  });

  // ⭐ №367: доступ на проект — свои выходы, без управления бригадой
  await check('проектный прораб: срез выходов и запрет управления бригадой', async () => {
    const link = await createLink({ role: 'FOREMAN', projectId: project1.id });
    expectStatus(await accept(link.token, projForeman), [200, 201], 'прораб на проект');

    const foreignShift = await api(
      `/brigades/${brigadeId}/shifts`,
      { method: 'POST', body: { date: today, hoursWorked: 4, projectId: project2.id } },
      admin.token,
    );
    expectStatus(foreignShift, [200, 201], 'выход по чужому проекту');

    const ownShift = await api(
      `/brigades/${brigadeId}/shifts`,
      { method: 'POST', body: { date: today, hoursWorked: 5, projectId: project1.id } },
      projForeman.token,
    );
    expectStatus(ownShift, [200, 201], 'свой выход');

    const list = await api(`/brigades/${brigadeId}/shifts`, {}, projForeman.token);
    expectStatus(list, 200, 'выходы проектного прораба');
    expect(
      !list.data.some((s) => s.id === foreignShift.data.id),
      'видит выход чужого проекта',
    );
    expect(
      list.data.some((s) => s.id === ownShift.data.id),
      'не видит свой выход',
    );

    expectStatus(
      await api(
        `/brigades/${brigadeId}/shifts/${foreignShift.data.id}`,
        { method: 'PATCH', body: { date: today, hoursWorked: 4, projectId: project2.id } },
        projForeman.token,
      ),
      403,
      'правка чужого выхода',
    );
    expectStatus(
      await api(
        `/brigades/${brigadeId}/shifts/${ownShift.data.id}`,
        { method: 'PATCH', body: { date: today, hoursWorked: 6, projectId: project1.id } },
        projForeman.token,
      ),
      200,
      'правка своего выхода',
    );

    expectStatus(
      await api(
        `/brigades/${brigadeId}`,
        { method: 'PATCH', body: { name: 'Взлом' } },
        projForeman.token,
      ),
      403,
      'правка карточки бригады',
    );
    expectStatus(
      await api(
        `/brigades/${brigadeId}/members`,
        { method: 'POST', body: { fullName: 'Новый рабочий' } },
        projForeman.token,
      ),
      403,
      'добавление рабочего',
    );
    expectStatus(
      await api(
        `/brigades/${brigadeId}/members`,
        { method: 'POST', body: { fullName: 'Новый рабочий' } },
        admin.token,
      ),
      [200, 201],
      'добавление рабочего админом',
    );
  });

  // ⭐ №364: удаление аккаунта не должно оставлять объект без администратора
  await check('нельзя удалить аккаунт единственного админа объекта', async () => {
    // понижаем ВСЕХ остальных админов, чтобы admin остался единственным CUSTOMER
    const rows = await accessList(object.id, admin.token);
    for (const row of rows) {
      if (row.userId === admin.userId || row.revokedAt) continue;
      if (row.role !== 'CUSTOMER') continue;
      expectStatus(
        await api(
          `/objects/${object.id}/access/${row.id}`,
          { method: 'PATCH', body: { role: 'VIEWER' } },
          admin.token,
        ),
        200,
        'понижение другого админа',
      );
    }
    const res = await api('/users/me', { method: 'DELETE' }, admin.token);
    expectStatus(res, 409, 'удаление аккаунта админа');
    expect(
      /Передайте админку/.test(String(res.data?.message ?? '')),
      `текст ошибки: ${res.data?.message}`,
    );
    expectStatus(await api('/objects', {}, admin.token), 200, 'админ жив после отказа');
  });

  await check('аккаунт без чужих объектов удаляется вместе с демо-объектом', async () => {
    const self = await register('selfdelete');
    expectStatus(
      await api('/users/me', { method: 'DELETE' }, self.token),
      200,
      'самоудаление аккаунта',
    );
    expectStatus(
      await api('/objects', {}, self.token),
      401,
      'старый токен после удаления',
    );
  });

  // ── 9. Аренда: статус, правка цены, лимиты ────────────────
  console.log('\n9. Аренда');

  await check('аренда: завершение, фильтр и правка цены', async () => {
    const created = await api(
      '/rentals',
      {
        method: 'POST',
        body: {
          name: `Аренда ${stamp}`,
          startDate: '2026-11-01',
          endDate: '2026-11-10',
          price: 1000,
        },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание аренды');
    const rentalId = created.data.id;

    const active = await api('/rentals?status=active', {}, admin.token);
    expectStatus(active, 200, 'активные');
    expect(active.data.some((r) => r.id === rentalId), 'новая аренда не в активных');

    expectStatus(
      await api(`/rentals/${rentalId}/close`, { method: 'POST' }, admin.token),
      201,
      'завершение аренды',
    );
    const activeAfter = await api('/rentals?status=active', {}, admin.token);
    expect(!activeAfter.data.some((r) => r.id === rentalId), 'завершённая осталась в активных');
    const closed = await api('/rentals?status=closed', {}, admin.token);
    expect(closed.data.some((r) => r.id === rentalId), 'завершённой нет в «Завершённых»');

    // продлить завершённую нельзя
    expectStatus(
      await api(
        `/rentals/${rentalId}/extend`,
        { method: 'PATCH', body: { newEndDate: '2026-11-20', price: 100 } },
        admin.token,
      ),
      400,
      'продление завершённой',
    );

    // вернули в работу и исправили цену
    expectStatus(
      await api(`/rentals/${rentalId}/reopen`, { method: 'POST' }, admin.token),
      201,
      'возврат в работу',
    );
    const updated = await api(
      `/rentals/${rentalId}`,
      { method: 'PATCH', body: { price: 1500 } },
      admin.token,
    );
    expectStatus(updated, 200, 'правка цены');
    expect(Number(updated.data.price) === 1500, 'цена не изменилась');
    expect(Number(updated.data.totalSpent) === 1500, 'totalSpent не пересчитан');

    expectStatus(
      await api(
        `/rentals/${rentalId}/extend`,
        { method: 'PATCH', body: { newEndDate: '2026-11-20', price: 1e12 } },
        admin.token,
      ),
      400,
      'слишком большая сумма',
    );
  });

  // ── 10. Аналитика: историческая цена фиксации ─────────────
  console.log('\n10. Аналитика');

  await check('динамика считает по цене на момент фиксации', async () => {    const materialId = material.id;
    const materialRow = await prisma.material.findUnique({
      where: { id: materialId },
      select: { unitPrice: true, materialUnitPrice: true },
    });
    expect(materialRow, 'материал не найден');

    const fix = await api(
      `/materials/${materialId}/fix`,
      { method: 'POST', body: { amount: 2 } },
      admin.token,
    );
    expectStatus(fix, [200, 201], 'фиксация объёма');

    const trend = await api('/analytics/monthly-trend', {}, admin.token);
    expectStatus(trend, 200, 'динамика');
    const spent = Number(trend.data[trend.data.length - 1].spent);
    const perUnit = Number(materialRow.unitPrice) + Number(materialRow.materialUnitPrice);
    expect(
      spent >= perUnit * 2 - 0.01,
      `динамика не учла фиксацию: ${spent} < ${perUnit * 2}`,
    );

    // меняем текущую цену строки напрямую — динамика НЕ должна пересчитаться
    await prisma.material.update({
      where: { id: materialId },
      data: { unitPrice: 9999 },
    });
    const trendAfter = await api('/analytics/monthly-trend', {}, admin.token);
    const spentAfter = Number(trendAfter.data[trendAfter.data.length - 1].spent);
    expect(
      Math.abs(spentAfter - spent) < 0.01,
      `динамика пересчиталась по новой цене: ${spent} → ${spentAfter}`,
    );
    await prisma.material.update({
      where: { id: materialId },
      data: { unitPrice: materialRow.unitPrice },
    });

    const budget = await api('/analytics/budget-vs-actual', {}, admin.token);
    expectStatus(budget, 200, 'бюджет vs факт');
    expect(
      budget.data.every((r) => typeof r.projectId === 'number'),
      'в ответе нет projectId',
    );
  });

  // ── 11. P0-фиксы аудита (№372) ────────────────────────────
  console.log('\n11. P0-фиксы');

  await check('скрытый прораб не выпускает ссылку с открытыми ценами', async () => {
    const link = await api(
      `/objects/${object.id}/invite-link`,
      { method: 'POST', body: { role: 'VIEWER', hidePrices: false, maxUses: 1 } },
      pricesWorker.token,
    );
    expectStatus(link, [200, 201], 'создание ссылки скрытым прорабом');
    expect(link.data.hidePrices === true, 'скрытый прораб выпустил ссылку с ценами');
  });

  await check('история фиксаций скрывает ценовые снимки', async () => {
    const fixes = await api(`/materials/${material.id}/fixes`, {}, pricesWorker.token);
    expectStatus(fixes, 200, 'история фиксаций');
    expect(fixes.data.length > 0, 'у материала нет фиксаций');
    expect(
      fixes.data.every((f) => f.unitPrice == null && f.materialUnitPrice == null),
      'скрытому прорабу отдали цены из истории',
    );
  });

  await check('ответ PATCH склада не раскрывает цену', async () => {
    const created = await api(
      '/warehouse/items',
      {
        method: 'POST',
        body: { name: `Склад ${stamp}`, unit: 'шт', quantity: 1, price: 777, objectId: object.id },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание позиции склада');
    const updated = await api(
      `/warehouse/items/${created.data.id}`,
      { method: 'PATCH', body: { comment: 'проверка маскировки' } },
      pricesWorker.token,
    );
    expectStatus(updated, 200, 'правка склада скрытым прорабом');
    expect(updated.data.price == null, 'скрытый прораб увидел цену в ответе PATCH');
  });

  await check('факт проекта включает материалы', async () => {
    const rows = await prisma.material.findMany({
      where: { projectId: project1.id },
      select: { totalCost: true, materialTotalCost: true },
    });
    const expected = rows.reduce(
      (sum, m) => sum + Number(m.totalCost) + Number(m.materialTotalCost),
      0,
    );
    const project = await api(`/projects/${project1.id}`, {}, admin.token);
    expectStatus(project, 200, 'карточка проекта');
    expect(
      Math.abs(Number(project.data.totalCost) - expected) < 0.01,
      `факт проекта ${project.data.totalCost} ≠ ${expected}`,
    );
  });

  // ── 12. Категории справочника (B2) ────────────────────────
  console.log('\n12. Категории справочника');

  await check('категория создаётся в своём справочнике и не дублируется', async () => {
    const created = await api(
      '/price-list/categories',
      {
        method: 'POST',
        body: { name: `Категория ${stamp}`, kind: 'WORK', catalogId: adminCatalog.id },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание категории');
    expect(
      created.data.catalogId === adminCatalog.id,
      'категория создана не в справочнике',
    );

    const renamed = await api(
      `/price-list/categories/${created.data.id}`,
      { method: 'PATCH', body: { name: `Категория ${stamp} (изм.)` } },
      admin.token,
    );
    expectStatus(renamed, 200, 'переименование своей категории');

    const full = await api(
      `/price-list/categories/full?kind=WORK&catalogId=${adminCatalog.id}`,
      {},
      admin.token,
    );
    expectStatus(full, 200, 'категории справочника');
    const names = full.data.map((c) => c.name);
    expect(new Set(names).size === names.length, 'в списке есть дубли категорий');

    const system = await prisma.priceCategory.findFirst({
      where: { catalogId: null, kind: 'WORK' },
      select: { id: true },
    });
    if (system) {
      expectStatus(
        await api(
          `/price-list/categories/${system.id}`,
          { method: 'PATCH', body: { name: 'Взлом' } },
          pricesWorker.token,
        ),
        403,
        'переименование системной категории скрытым прорабом',
      );
    }
  });

  // ── 13. Параллельные сценарии ─────────────────────────────
  console.log('\n13. Параллельные сценарии');

  await check('два accept одной ссылки с maxUses=1 — проходит только один', async () => {
    const u1 = await register('racea');
    const u2 = await register('raceb');
    const link = await api(
      `/objects/${object.id}/invite-link`,
      { method: 'POST', body: { role: 'VIEWER', maxUses: 1 } },
      admin.token,
    );
    expectStatus(link, [200, 201], 'ссылка maxUses=1');
    const token = link.data.token;

    const [a, b] = await Promise.all([
      accept(token, u1),
      accept(token, u2),
    ]);
    const ok = [a, b].filter((r) => r.status === 200 || r.status === 201).length;
    expect(
      ok === 1,
      `приняли ссылку ${ok} раза вместо одного (${a.status}/${b.status}: ${a.data?.message ?? ''} | ${b.data?.message ?? ''})`,
    );
    const usedLink = await prisma.inviteToken.findUnique({
      where: { token },
      select: { usesCount: true },
    });
    expect(usedLink.usesCount === 1, `usesCount=${usedLink.usesCount} вместо 1`);
  });

  await check('два copy-estimate в пустой проект — смета не дублируется', async () => {
    const created = await api(
      '/projects',
      {
        method: 'POST',
        body: {
          name: `Пустой ${stamp}`,
          objectId: object.id,
          startDate: '2026-11-01',
          endDate: '2026-12-01',
        },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание пустого проекта');
    const targetId = created.data.id;

    const sourceRows = await prisma.material.count({
      where: { projectId: project1.id },
    });
    const [first, second] = await Promise.all([
      api(
        `/projects/${targetId}/copy-estimate`,
        { method: 'POST', body: { sourceProjectId: project1.id } },
        admin.token,
      ),
      api(
        `/projects/${targetId}/copy-estimate`,
        { method: 'POST', body: { sourceProjectId: project1.id } },
        admin.token,
      ),
    ]);
    const ok = [first, second].filter((r) => r.status === 200 || r.status === 201).length;
    expect(ok === 1, `copy-estimate прошёл ${ok} раза вместо одного`);
    const rows = await prisma.material.count({ where: { projectId: targetId } });
    expect(rows === sourceRows, `в смете ${rows} строк вместо ${sourceRows}`);
  });

  await check('два продления аренды не теряют начисление', async () => {
    const created = await api(
      '/rentals',
      {
        method: 'POST',
        body: {
          name: `Гонка ${stamp}`,
          startDate: '2026-11-01',
          endDate: '2026-11-10',
          price: 1000,
        },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание аренды');
    const id = created.data.id;
    const [a, b] = await Promise.all([
      api(
        `/rentals/${id}/extend`,
        { method: 'PATCH', body: { newEndDate: '2026-11-20', price: 100 } },
        admin.token,
      ),
      api(
        `/rentals/${id}/extend`,
        { method: 'PATCH', body: { newEndDate: '2026-11-20', price: 100 } },
        admin.token,
      ),
    ]);
    const ok = [a, b].filter((r) => r.status === 200 || r.status === 201).length;
    expect(ok === 1, `прошло ${ok} продлений вместо одного`);
    const row = await prisma.rental.findUnique({ where: { id } });
    expect(
      Math.abs(Number(row.totalSpent) - 1100) < 0.01,
      `totalSpent ${row.totalSpent} вместо 1100`,
    );
  });

  await check('продление параллельно с правкой цены не теряет сумму', async () => {
    const created = await api(
      '/rentals',
      {
        method: 'POST',
        body: {
          name: `Цена+продление ${stamp}`,
          startDate: '2026-11-01',
          endDate: '2026-11-10',
          price: 1000,
        },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание аренды');
    const id = created.data.id;
    const [extend, price] = await Promise.all([
      api(
        `/rentals/${id}/extend`,
        { method: 'PATCH', body: { newEndDate: '2026-11-20', price: 100 } },
        admin.token,
      ),
      api(`/rentals/${id}`, { method: 'PATCH', body: { price: 1500 } }, admin.token),
    ]);
    expect(
      [extend, price].every((r) => r.status === 200 || r.status === 201),
      `запросы не прошли: ${extend.status}/${price.status}`,
    );
    const row = await prisma.rental.findUnique({ where: { id } });
    // 1000 + продление 100 + разница цены (1500−1000)
    expect(
      Math.abs(Number(row.totalSpent) - 1600) < 0.01,
      `totalSpent ${row.totalSpent} вместо 1600`,
    );
  });

  await check('два администратора не могут понизить друг друга одновременно', async () => {
    const created = await api(
      '/objects',
      {
        method: 'POST',
        body: {
          name: `Гонка админов ${stamp}`,
          address: 'Тест',
          startDate: '2026-11-01',
          endDate: '2026-12-01',
        },
      },
      admin.token,
    );
    expectStatus(created, [200, 201], 'создание объекта');
    const objectId = created.data.id;
    createdObjectIds.push(objectId);

    const added = await api(
      `/objects/${objectId}/access`,
      { method: 'POST', body: { userId: secondAdmin.userId, role: 'CUSTOMER' } },
      admin.token,
    );
    expectStatus(added, [200, 201], 'второй администратор');

    const grants = await accessList(objectId, admin.token);
    const adminGrant = grants.find(
      (g) => g.userId === admin.userId && g.projectId == null,
    );
    const secondGrant = grants.find(
      (g) => g.userId === secondAdmin.userId && g.projectId == null,
    );
    expect(adminGrant && secondGrant, 'не нашли гранты администраторов');

    const [a, b] = await Promise.all([
      api(
        `/objects/${objectId}/access/${secondGrant.id}`,
        { method: 'PATCH', body: { role: 'FOREMAN' } },
        admin.token,
      ),
      api(
        `/objects/${objectId}/access/${adminGrant.id}`,
        { method: 'PATCH', body: { role: 'FOREMAN' } },
        secondAdmin.token,
      ),
    ]);
    const ok = [a, b].filter((r) => r.status === 200).length;
    expect(ok === 1, `понижений прошло ${ok} вместо одного (${a.status}/${b.status})`);
    const otherAdmins = await prisma.objectAccess.count({
      where: {
        objectId,
        projectId: null,
        role: 'CUSTOMER',
        revokedAt: null,
      },
    });
    expect(otherAdmins === 1, `администраторов осталось ${otherAdmins}`);
  });

  await check('снимок проектного участника не содержит чужих данных (JSON)', async () => {
    const snapUser = await register('snapuser');
    const link = await api(
      `/objects/${object.id}/invite-link`,
      { method: 'POST', body: { role: 'FOREMAN', projectId: project1.id, hidePrices: true } },
      admin.token,
    );
    expectStatus(link, [200, 201], 'ссылка в проект для снимка');
    expectStatus(
      await accept(link.data.token, snapUser),
      [200, 201],
      'принятие ссылки в проект',
    );

    // склад: позиция только для project2 и позиция, использованная в project1
    const onlyOther = await api(
      '/warehouse/items',
      {
        method: 'POST',
        body: { name: `СкладB ${stamp}`, unit: 'шт', quantity: 5, price: 500, objectId: object.id },
      },
      admin.token,
    );
    expectStatus(onlyOther, [200, 201], 'позиция склада B');
    expectStatus(
      await api(
        '/warehouse/transactions',
        {
          method: 'POST',
          body: {
            warehouseItemId: onlyOther.data.id,
            type: 'write-off',
            quantity: 1,
            projectId: project2.id,
          },
        },
        admin.token,
      ),
      [200, 201],
      'списание в project2',
    );

    const grants = await accessList(object.id, admin.token);
    const grant = grants.find(
      (g) => g.userId === snapUser.userId && g.projectId === project1.id,
    );
    expect(grant, 'грант проектного участника не найден');
    expectStatus(
      await api(`/objects/${object.id}/access/${grant.id}`, { method: 'DELETE' }, admin.token),
      200,
      'удаление проектного участника',
    );

    const list = await api('/me/snapshots', {}, snapUser.token);
    expectStatus(list, 200, 'список снимков');
    const snap = list.data.find((s) => s.objectId === object.id);
    expect(snap, 'снимок не создан');
    const detail = await api(`/me/snapshots/${snap.id}`, {}, snapUser.token);
    expectStatus(detail, 200, 'снимок');
    const payload = detail.data.payload;

    expect(
      payload.projects.every((p) => p.id === project1.id),
      'в снимке есть чужой проект',
    );
    const names = payload.warehouse.items.map((i) => i.name);
    expect(
      !names.includes(`СкладB ${stamp}`),
      'в снимке есть складская позиция чужого проекта',
    );
    expect(
      payload.brigades.every((b) =>
        b.shifts.every((s) => s.projectName === project1.name),
      ),
      'в снимке есть выходы чужого проекта',
    );
    // цены скрыты — денежные поля пустые
    const moneyFields = [
      ...payload.projects.flatMap((p) => p.materials.flatMap((m) => [m.unitPrice, m.materialUnitPrice])),
      ...payload.warehouse.items.map((i) => i.price),
      ...payload.warehouse.transactions.map((t) => t.price),
    ];
    expect(
      moneyFields.every((v) => v == null),
      'в снимке скрытого участника остались цены',
    );
  });


  // -- 14. ������� ��� ������� ���������� --------------------
  console.log('\n14. ������� ��� �������');

  await check('����� � XLSX/PDF �� �������� ��� ��� �������� FOREMAN', async () => {
    const report = await api(
      '/reports',
      {
        method: 'POST',
        body: { projectId: project1.id, objectId: object.id, type: 'estimate', title: `������� ${stamp}` },
      },
      admin.token,
    );
    expectStatus(report, [200, 201], '�������� ������');
    const item = await api(
      `/reports/${report.data.id}/items`,
      {
        method: 'POST',
        body: { name: `������� ${stamp}`, unit: '��', quantity: 2, price: 12345 },
      },
      admin.token,
    );
    expectStatus(item, [200, 201], '������� ������');

    const xlsx = await fetch(
      `${BASE}/reports/${report.data.id}/export/xlsx`,
      { headers: { Authorization: `Bearer ${pricesWorker.token}` } },
    );
    expect(xlsx.status === 200, `XLSX: ������ ${xlsx.status}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
    const values = [];
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          values.push(String(cell.value ?? ''));
        });
      });
    });
    expect(
      !values.some((v) => v.includes('12345')),
      '� XLSX �������� ��������� �������� ���� 12345',
    );

    const pdf = await fetch(
      `${BASE}/reports/${report.data.id}/export/pdf`,
      { headers: { Authorization: `Bearer ${pricesWorker.token}` } },
    );
    expect(pdf.status === 200, `PDF: ������ ${pdf.status}`);
    expect(
      (pdf.headers.get('content-type') ?? '').includes('application/pdf'),
      'PDF: �������� content-type',
    );
  });

  await check('фиксации проекта отдаются одним запросом и маскируются', async () => {
    const all = await api(
      `/materials/project/${project1.id}/fixes`,
      {},
      admin.token,
    );
    expectStatus(all, 200, 'bulk-фиксации');
    expect(Array.isArray(all.data) && all.data.length > 0, 'фиксаций нет');
    expect(
      all.data.every((f) => typeof f.materialId === 'number'),
      'в bulk-фиксациях нет materialId',
    );
    const hidden = await api(
      `/materials/project/${project1.id}/fixes`,
      {},
      pricesWorker.token,
    );
    expectStatus(hidden, 200, 'bulk-фиксации скрытым');
    expect(
      hidden.data.every((f) => f.unitPrice == null && f.materialUnitPrice == null),
      'скрытому участнику отдали цены в bulk-фиксациях',
    );
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
