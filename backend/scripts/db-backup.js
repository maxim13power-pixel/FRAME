// backend/scripts/db-backup.js
// ⭐ №395: резервная копия данных FRAME — база (pg_dump -Fc) + фотофиксации (tar.gz).
//
// Запуск:  npm --prefix backend run db:backup
//          node scripts/db-backup.js --out D:\backups --keep 14 [--no-files]
//
// Что делает:
//   1) pg_dump -Fc (сжатый, восстанавливается pg_restore, можно выборочно);
//   2) проверяет формат (магия PGDMP), читаемость архива (pg_restore -l) и считает sha256;
//   3) фото: фотофиксации лежат НЕ в базе, а на диске (PHOTO_STORAGE_DIR или
//      backend/uploads/photos) — пакует их в tar.gz и тоже считает sha256;
//   4) пишет строки в backups/backup.log;
//   5) ротация: оставляет N последних копий (--keep, по умолчанию 14).
//
// Куда класть копии: по умолчанию <repo>/backups (в git не попадает). Для прода путь задаётся
// через --out или BACKUP_DIR; offsite-копия (объектное хранилище) — отдельный шаг, см.
// docs/BACKUP.md. ВАЖНО: на сервере PHOTO_STORAGE_DIR должен смотреть в постоянный том,
// иначе фото исчезнут при передеплое (в бэкап попадут только те, что есть сейчас).


const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  readDatabaseUrl,
  parseDatabaseUrl,
  dockerContainerName,
  runToolToFile,
  runToolFromFile,
  sha256,
  looksLikeDump,
  humanSize,
  log,
  fail,
} = require('./db-cli');

const repoRoot = path.join(__dirname, '..', '..');

const argValue = (name, fallback) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) fail(`после ${name} нужно значение`);
  return value;
};

const outDir = path.resolve(argValue('--out', process.env.BACKUP_DIR || path.join(repoRoot, 'backups')));
const keep = Number(argValue('--keep', process.env.BACKUP_KEEP || '14'));
const withFiles = !process.argv.includes('--no-files');

// ⭐ №395: фотофиксации лежат на диске, а не в базе — их тоже надо сохранять.
const backendDir = path.join(__dirname, '..');
const photosDir = path.resolve(
  process.env.PHOTO_STORAGE_DIR || path.join(backendDir, 'uploads', 'photos'),
);

/** Проверка архива фото: `tar -tzf` читает оглавление (битый архив сразу видно). */
const verifyPhotosArchive = (file) =>
  new Promise((resolve, reject) => {
    const child = spawn('tar', ['-tzf', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`проверка архива фото: ${stderr.slice(0, 500)}`));
      else resolve(stdout.split(/\r?\n/).filter(Boolean).length);
    });
  });
const archivePhotos = (targetFile) =>
  new Promise((resolve, reject) => {
    const child = spawn('tar', ['-czf', targetFile, '-C', backendDir, 'uploads'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => reject(new Error(`tar не запустился: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`tar завершился с кодом ${code}: ${stderr.slice(0, 500)}`));
      else resolve();
    });
  });


const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
};

const rotate = () => {
  const families = [
    (name) => name.endsWith('.dump'),
    (name) => /^photos-.*\.tar\.gz$/.test(name),
  ];
  let total = 0;
  let removed = 0;
  for (const isFamily of families) {
    const files = fs
      .readdirSync(outDir)
      .filter(isFamily)
      .map((name) => ({ name, time: fs.statSync(path.join(outDir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    total += files.length;
    for (const file of files.slice(keep)) {
      fs.unlinkSync(path.join(outDir, file.name));
      const sidecar = path.join(outDir, `${file.name}.sha256`);
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
      log('ротация: удалён старый файл', file.name);
      removed += 1;
    }
  }
  return { total, removed };
};

(async () => {
  const url = readDatabaseUrl();
  const conn = parseDatabaseUrl(url);
  const container = dockerContainerName();
  fs.mkdirSync(outDir, { recursive: true });

  const filePath = path.join(outDir, `${conn.database}-${stamp()}.dump`);
  log(`база: ${conn.database} (${container ? `docker: ${container}` : 'локальные утилиты pg'})`);
  log(`файл: ${filePath}`);

  const started = Date.now();
  await runToolToFile('pg_dump', ['-U', conn.user, '-d', conn.database, '-Fc'], filePath, conn, container);
  const dumpMs = Date.now() - started;

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) {
    fail('дамп не создан или подозрительно мал — проверьте доступ к базе');
  }
  if (!looksLikeDump(filePath)) fail('файл не похож на custom-дамп PostgreSQL (нет сигнатуры PGDMP)');

  // Полная проверка читаемости архива: pg_restore -l разбирает оглавление дампа.
  const listStarted = Date.now();
  const { stdout: toc } = await runToolFromFile('pg_restore', ['-l'], filePath, conn, container);
  const entries = toc.split(/\r?\n/).filter((line) => line && !line.startsWith(';')).length;
  const listMs = Date.now() - listStarted;
  if (entries < 10) fail(`в архиве всего ${entries} записей — дамп подозрительный`);

  const hash = sha256(filePath);
  fs.writeFileSync(`${filePath}.sha256`, `${hash}  ${path.basename(filePath)}\n`, 'utf8');
  const size = fs.statSync(filePath).size;

  // ⭐ №395: фотофиксации — отдельный архив (в базе только метаданные/ключи).
  let photosInfo = null;
  if (withFiles) {
    if (!fs.existsSync(photosDir)) {
      log(`фото: каталог ${photosDir} не найден — пропускаем (--no-files отключает шаг)`);
    } else {
      const photosFile = path.join(outDir, `photos-${stamp()}.tar.gz`);
      const photosStarted = Date.now();
      await archivePhotos(photosFile);
      const photosMs = Date.now() - photosStarted;
      const fileEntries = await verifyPhotosArchive(photosFile);
      if (fileEntries === 0) fail('архив фото пустой — проверьте PHOTO_STORAGE_DIR');
      const photosHash = sha256(photosFile);
      fs.writeFileSync(`${photosFile}.sha256`, `${photosHash}  ${path.basename(photosFile)}\n`, 'utf8');
      const photosSize = fs.statSync(photosFile).size;
      photosInfo = { file: path.basename(photosFile), size: photosSize, ms: photosMs, sha256: photosHash, entries: fileEntries };
      log(`фото: ${humanSize(photosSize)} за ${photosMs} мс, файлов в архиве ${fileEntries}`);
    }
  }

  const { total, removed } = rotate();

  const summary = {
    file: path.basename(filePath),
    size,
    entries,
    dumpMs,
    listMs,
    sha256: hash,
    photos: photosInfo,
    kept: total - removed,
    removed,
  };
  log(`готово: ${humanSize(size)}, записей в архиве ${entries}`);
  log(`время: дамп ${dumpMs} мс, проверка архива ${listMs} мс`);
  log(`sha256: ${hash}`);
  log(`копий в папке: ${summary.kept} (удалено старых: ${removed})`);

  fs.appendFileSync(
    path.join(outDir, 'backup.log'),
    `${new Date().toISOString()}\t${summary.file}\t${size}\t${entries}\t${dumpMs}ms\t${hash}` +
      `\t${photosInfo ? photosInfo.file : '-'}\t${photosInfo ? photosInfo.size : 0}\n`,
    'utf8',
  );
})().catch((error) => fail(error.message));
