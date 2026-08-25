import 'dotenv/config';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getDatabasePath } from '../src/server/database-url';

const databasePath = getDatabasePath();
mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma('foreign_keys = ON');
database.pragma('journal_mode = WAL');
database.pragma('busy_timeout = 5000');
database.exec(`
  CREATE TABLE IF NOT EXISTS _nightingale_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const migrationRoot = resolve(process.cwd(), 'prisma/migrations');
const migrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();

for (const name of migrations) {
  const sql = readFileSync(join(migrationRoot, name, 'migration.sql'), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const applied = database
    .prepare('SELECT checksum FROM _nightingale_migrations WHERE name = ?')
    .get(name) as { checksum: string } | undefined;

  if (applied) {
    if (applied.checksum !== checksum) {
      throw new Error(`Migration ${name} changed after it was applied.`);
    }
    continue;
  }

  database.transaction(() => {
    database.exec(sql);
    database
      .prepare('INSERT INTO _nightingale_migrations (name, checksum) VALUES (?, ?)')
      .run(name, checksum);
  })();
  console.log(`Applied migration ${name}.`);
}

database.pragma('optimize');
database.close();
