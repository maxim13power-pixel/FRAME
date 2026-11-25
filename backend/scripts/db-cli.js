// backend/scripts/db-cli.js
// ⭐ №395: общие помощники для бэкапа/восстановления базы.
//
// Работает в двух режимах:
//   • docker — PostgreSQL в контейнере (dev: `frame_postgres`), утилиты вызываются через
//     `docker exec`, пароль не нужен (локальный сокет + POSTGRES_USER);
//   • local  — утилиты pg_dump/pg_restore/psql из PATH (прод/сервер), пароль через PGPASSWORD.
//
// Режим выбирается сам: если контейнер из DB_DOCKER_CONTAINER (по умолчанию frame_postgres)
// запущен — docker, иначе local. Принудительно: DB_PG_MODE=docker|local.

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const BACKEND_DIR = path.join(__dirname, '..');
const DEFAULT_CONTAINER = process.env.DB_DOCKER_CONTAINER || 'frame_postgres';

/** DATABASE_URL из backend/.env (переменная окружения имеет приоритет). */
const readDatabaseUrl = () => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return process.env.DATABASE_URL.trim();
  }
  const envPath = path.join(BACKEND_DIR, '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/DATABASE_URL\s*=\s*"?([^"\r\n]+)/);
  if (!match) throw new Error('в backend/.env нет DATABASE_URL');
  return match[1].trim();
};

/** postgresql://user:pass@host:port/db?schema=public → части строки подключения. */
const parseDatabaseUrl = (url) => {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: decodeURIComponent(parsed.password || ''),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
  };
};

const dockerContainerName = () => {
  if (process.env.DB_PG_MODE === 'local') return null;
  const res = spawnSync('docker', ['ps', '--filter', `name=${DEFAULT_CONTAINER}`, '--format', '{{.Names}}'], {
    encoding: 'utf8',
  });
  if (res.status !== 0) return null; // docker не установлен / не запущен
  const names = (res.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return names.includes(DEFAULT_CONTAINER) ? DEFAULT_CONTAINER : null;
};

/** Собирает команду запуска утилиты PostgreSQL (docker exec … | прямой вызов). */
const pgCommand = (tool, args, container) => {
  if (container) return { cmd: 'docker', args: ['exec', '-i', container, tool, ...args] };
  return { cmd: tool, args };
};

const pgEnv = (conn) => ({ ...process.env, PGPASSWORD: conn.password });

/** Выполняет SQL и возвращает stdout (для psql -t -A). */
const psql = (conn, database, sql, container) => {
  const { cmd, args } = pgCommand('psql', ['-U', conn.user, '-d', database, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], container);
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    env: pgEnv(conn),
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
};

/** Копирование stdout утилиты в файл (pg_dump). */
const runToolToFile = (tool, args, filePath, conn, container) =>
  new Promise((resolve, reject) => {
    const { cmd, args: finalArgs } = pgCommand(tool, args, container);
    const child = spawn(cmd, finalArgs, { env: pgEnv(conn), stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(filePath);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.stdout.pipe(out);
    child.on('error', reject);
    child.on('close', (code) => {
      out.end(() => {
        if (code !== 0) reject(new Error(`${tool} завершился с кодом ${code}: ${stderr.slice(0, 800)}`));
        else resolve({ stderr });
      });
    });
  });

/** Чтение файла в stdin утилиты (pg_restore / pg_restore -l). */
const runToolFromFile = (tool, args, filePath, conn, container) =>
  new Promise((resolve, reject) => {
    const { cmd, args: finalArgs } = pgCommand(tool, args, container);
    const child = spawn(cmd, finalArgs, { env: pgEnv(conn), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`${tool} завершился с кодом ${code}: ${stderr.slice(0, 2000)}`));
      else resolve({ stdout, stderr });
    });
    fs.createReadStream(filePath).pipe(child.stdin);
  });

/** sha256 файла — чтобы сравнивать копии и замечать битые. */
const sha256 = (filePath) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
};

/** Ошибка 5 байт формата custom-дампа (PGDMP) — быстрая проверка «это вообще дамп?». */
const looksLikeDump = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  return buf.toString('latin1') === 'PGDMP';
};

const humanSize = (bytes) => {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
};

const log = (...args) => console.log('⭐', ...args);
const fail = (message) => {
  console.error('❌', message);
  process.exit(1);
};

module.exports = {
  BACKEND_DIR,
  readDatabaseUrl,
  parseDatabaseUrl,
  dockerContainerName,
  psql,
  runToolToFile,
  runToolFromFile,
  sha256,
  looksLikeDump,
  humanSize,
  log,
  fail,
};
