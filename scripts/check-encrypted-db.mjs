import { readFile } from 'node:fs/promises';
import path from 'node:path';

const database = await readFile(path.resolve(process.cwd(), 'data', 'nightingale.db'));
const knownPlaintext = [
  'Known penicillin allergy',
  'night cough increased',
  'Revision test version',
  'Confirm spirometry slot',
];
const leaked = knownPlaintext.filter((value) => database.includes(Buffer.from(value, 'utf8')));
if (leaked.length) {
  console.error(`Plaintext leak detected in SQLite: ${leaked.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Encrypted database check passed: ${knownPlaintext.length} known free-text values were absent from the SQLite bytes.`);
}
