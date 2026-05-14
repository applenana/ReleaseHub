import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { hashPassword } from '../src/auth/password.js';
import { db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

runMigrations();

const rl = createInterface({ input, output });

const username = (await rl.question('管理员用户名: ')).trim();
if (!username) {
  console.error('用户名不能为空');
  process.exit(1);
}
const password = (await rl.question('密码（至少 8 位）: ')).trim();
if (password.length < 8) {
  console.error('密码至少 8 位');
  process.exit(1);
}
rl.close();

const hash = await hashPassword(password);
try {
  db.prepare(`INSERT INTO admins (username, password_hash) VALUES (?, ?)`).run(username, hash);
  console.log(`✓ 已创建管理员 ${username}`);
} catch (e: any) {
  if (String(e.message).includes('UNIQUE')) {
    db.prepare(`UPDATE admins SET password_hash = ? WHERE username = ?`).run(hash, username);
    console.log(`✓ 已更新管理员 ${username} 的密码`);
  } else {
    throw e;
  }
}
