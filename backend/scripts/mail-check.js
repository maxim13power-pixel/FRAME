// backend/scripts/mail-check.js
// ⭐ №399: проверка исходящей почты одной командой — `npm run mail:check`.
// Делает verify() и отправляет письмо на ALERT_EMAIL_TO (или SMTP_USER).
// Полезно запускать с домашней сети/с прода, если из сети разработки SMTP недоступен.

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => (env.match(new RegExp(`^${name}=(.+)$`, 'm')) || [])[1]?.trim();

const host = pick('SMTP_HOST');
const port = Number(pick('SMTP_PORT') || 587);
const user = pick('SMTP_USER');
const pass = pick('SMTP_PASS');
const from = pick('SMTP_FROM') || user;
const to = process.env.MAIL_CHECK_TO || pick('ALERT_EMAIL_TO') || user;

if (!host || !user || !pass) {
  console.error('❌ в backend/.env нет SMTP_HOST/SMTP_USER/SMTP_PASS');
  process.exit(1);
}

(async () => {
  console.log(`SMTP ${host}:${port}, отправитель ${from}, получатель ${to}`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: Number(pick('SMTP_CONNECTION_TIMEOUT') || 8000),
    greetingTimeout: Number(pick('SMTP_GREETING_TIMEOUT') || 8000),
    socketTimeout: Number(pick('SMTP_SOCKET_TIMEOUT') || 15000),
  });

  const started = Date.now();
  try {
    await transporter.verify();
    console.log(`✅ verify() ok за ${Date.now() - started} мс — логин и TLS приняты`);
  } catch (error) {
    console.error(`❌ verify() упал за ${Date.now() - started} мс: ${error.message}`);
    console.error('   Если ошибка про таймаут/сеть — сеть блокирует SMTP (попробуйте с другой сети).');
    process.exit(1);
  }

  const sendStarted = Date.now();
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: '[FRAME] Проверка почты',
      text: [
        'Проверка исходящей почты FRAME.',
        '',
        `Хост: ${host}:${port}`,
        `Отправитель: ${from}`,
        `Время: ${new Date().toISOString()}`,
        '',
        'Если вы это видите — письма авторизации и резервные алерты будут доходить.',
      ].join('\n'),
    });
    console.log(`✅ письмо принято сервером за ${Date.now() - sendStarted} мс`);
    console.log(`   messageId: ${info.messageId}`);
    console.log(`   ответ: ${info.response}`);
  } catch (error) {
    console.error(`❌ отправка упала за ${Date.now() - sendStarted} мс: ${error.message}`);
    process.exit(1);
  }
})();
