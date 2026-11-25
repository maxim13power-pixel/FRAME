// backend/scripts/db-restore.js
// ⭐ №395: восстановление базы из дампа + сверка с источником (это и есть restore drill).
//
// Запуск:
//   node scripts/db-restore.js --file ../backups/frame_db-2026-11-26_09-00.dump
//   node scripts/db-restore.js --file <dump> --to frame_db_check --verify
//
// Что делает:
//   1) проверяет безопасность цели (по умолчанию только имена с суффиксом _check / _restore);
//   2) пересоздаёт целевую базу (drop + create) и разворачивает дамп в неё;
//   3) сверяет количество строк по ВСЕМ таблицам источника и копии (исключая служебную
//      _prisma_migrations), печатает расхождения и завершается с кодом 1, если они есть;
//   4) печатает тайминги — их пишем в docs/BACKUP.md после каждого drill.

const fs = require('fs');
const path = require('path');
const {
  readDatabaseUrl,
  parseDatabaseUrl,
  dockerContainerName,
  psql,
  runToolFromFile,
  humanSize,
  log,
  fail,
} = require('./db-cli');

const argValue = (name, fallback) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) fail(`после ${name} нужно значение`);
  return value;
};
const hasFlag = (name) => process.argv.includes(name);

const filePath = argValue('--file', null);
if (!filePath) fail('укажите дамп: --file <путь к .dump>');
if (!fs.existsSync(filePath)) fail(`файл не найден: ${filePath}`);

const conn = parseDatabaseUrl(argValue('--url', readDatabaseUrl()));
const sourceDb = conn.database;
const targetDb = argValue('--to', `${sourceDb}_check`);
const force = hasFlag('--force');
const verify = !hasFlag('--no-verify');

if (!/^[A-Za-z0-9_]+$/.test(targetDb)) fail('имя целевой базы может содержать только латиницу, цифры и _');
if (targetDb === sourceDb) fail('цель совпадает с источником — так нельзя (--to <другое имя>)');
if (!force && !/(_check|_restore)$/.test(targetDb)) {
  fail(`имя «${targetDb}» не похоже на тестовую базу: разрешены суффиксы _check/_restore или флаг --force`);
}

const container = dockerContainerName();
const dbCommand = (sql) => psql(conn, 'postgres', sql, container);
const tableListSql =
  "select table_name from information_schema.tables where table_schema='public' " +
  "and table_type='BASE TABLE' and table_name <> '_prisma_migrations' order by 1";

const collectCounts = (database) => {
  const tables = psql(conn, database, tableListSql, container).split(/\r?\n/).filter(Boolean);
  if (tables.length === 0) return {};
  const sql = tables
    .map((table) => `select '${table.replace(/'/g, "''")}' as t, count(*)::text as c from "${table}"`)
    .join(' union all ');
  const out = {};
  for (const line of psql(conn, database, sql, container).split(/\r?\n/)) {
    if (!line) continue;
    const [name, value] = line.split('|');
    out[name] = Number(value);
  }
  return out;
};

(async () => {
  const dumpSize = fs.statSync(filePath).size;
  log(`дамп: ${path.basename(filePath)} (${humanSize(dumpSize)})`);
  log(`источник: ${sourceDb}, цель проверки: ${targetDb} (${container ? `docker: ${container}` : 'локальные pg'})`);

  const exists = dbCommand(`select 1 from pg_database where datname = '${targetDb}'`) === '1';
  if (exists) {
    log(`база ${targetDb} уже есть — пересоздаём`);
    dbCommand(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${targetDb}' and pid <> pg_backend_pid()`,
    );
    dbCommand(`drop database "${targetDb}"`);
  }
  dbCommand(`create database "${targetDb}" owner "${conn.user}"`);

  const restoreStarted = Date.now();
  await runToolFromFile('pg_restore', ['-U', conn.user, '-d', targetDb, '--no-owner', '--no-privileges'], filePath, conn, container);
  const restoreMs = Date.now() - restoreStarted;
  log(`восстановлено за ${restoreMs} мс`);

  if (!verify) {
    log('сверка отключена (--no-verify)');
    return;
  }

  const verifyStarted = Date.now();
  const source = collectCounts(sourceDb);
  const restored = collectCounts(targetDb);
  const verifyMs = Date.now() - verifyStarted;

  const names = [...new Set([...Object.keys(source), ...Object.keys(restored)])].sort();
  const diffs = [];
  for (const name of names) {
    if (source[name] !== restored[name]) diffs.push({ name, source: source[name], restored: restored[name] });
  }

  const totalRows = Object.values(restored).reduce((acc, value) => acc + value, 0);
  log(`таблиц сверено: ${names.length}, строк в копии: ${totalRows}, время сверки ${verifyMs} мс`);
  if (diffs.length > 0) {
    for (const diff of diffs) {
      console.error(`❌ ${diff.name}: в источнике ${diff.source}, в копии ${diff.restored}`);
    }
    fail(`расхождений: ${diffs.length} — дамп неполный или база изменилась во время дампа`);
  }
  log('✅ все таблицы совпали — копия полноценная');
})().catch((error) => fail(error.message));
