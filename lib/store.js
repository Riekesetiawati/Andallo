import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function seedDbPath() {
  const candidates = [
    path.join(ROOT, 'data', 'db.json'),
    path.join(process.cwd(), 'data', 'db.json'),
    path.join(ROOT, '..', 'data', 'db.json'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('data/db.json tidak ditemukan di paket deployment.');
  return found;
}

export function defaultDbFile(env = process.env) {
  if (env.DB_FILE) return path.resolve(env.DB_FILE);
  if (env.VERCEL) {
    const tmp = env.VERCEL_DB_FILE || path.join('/tmp', 'andallo-db.json');
    if (!fs.existsSync(tmp)) fs.copyFileSync(seedDbPath(), tmp);
    return tmp;
  }
  return path.join(ROOT, 'data', 'db.json');
}

export function createStore(file) {
  let data;
  let writeChain = Promise.resolve();

  function load() {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function save() {
    const snapshot = JSON.stringify(data, null, 2) + '\n';
    const tmp = `${file}.${process.pid}.tmp`;
    writeChain = writeChain
      .then(async () => {
        await fsp.writeFile(tmp, snapshot);
        await fsp.rename(tmp, file);
      })
      .catch((err) => console.error('[db] write failed:', err));
    return writeChain;
  }

  load();

  return {
    get data() {
      return data;
    },
    save,
    flush: () => writeChain,
  };
}
