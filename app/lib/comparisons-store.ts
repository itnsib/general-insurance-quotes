import fs from 'node:fs/promises';
import path from 'node:path';
import { put, list, del, get } from '@vercel/blob';
import type { SavedComparison } from './types';

// One blob per comparison, keyed by id. Storing every comparison in a single
// JSON blob would mean a read-modify-write on each save, so two advisors saving
// at the same time would silently lose one of the two records.
const PREFIX = 'comparisons/';
// The store is public, so each blob is readable by anyone who has its URL.
// The comparison id is the only unguessable part of that URL — see generateId().
const ACCESS = 'public' as const;

const pathFor = (id: string) => `${PREFIX}${id}.json`;

// Off Vercel with no Blob credentials — a developer running the app on their own
// machine — comparisons are kept in .data/comparisons/ instead. Vercel's Blob
// sign-in token isn't available locally without the Vercel CLI, and this also
// keeps test saves out of the history every advisor shares. On Vercel, where
// the credentials are always present, this never applies.
const useLocalStore =
  !process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), '.data', 'comparisons');

const localPathFor = (id: string) => {
  // Ids are UUIDs; anything else could step outside the folder.
  if (!/^[\w-]{1,64}$/.test(id)) throw new Error('Invalid comparison id');
  return path.join(LOCAL_DIR, `${id}.json`);
};

const local = {
  async read(id: string): Promise<SavedComparison | null> {
    try {
      return JSON.parse(await fs.readFile(localPathFor(id), 'utf8')) as SavedComparison;
    } catch {
      return null;
    }
  },
  async list(): Promise<SavedComparison[]> {
    const names = await fs.readdir(LOCAL_DIR).catch(() => [] as string[]);
    const loaded = await Promise.all(
      names.filter((n) => n.endsWith('.json')).map((n) => local.read(n.slice(0, -5)))
    );
    return loaded.filter((c): c is SavedComparison => c !== null);
  },
  async write(comparison: SavedComparison) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(localPathFor(comparison.id), JSON.stringify(comparison, null, 2));
  },
  async remove(id: string) {
    await fs.rm(localPathFor(id), { force: true });
  },
};

async function readByPathname(pathname: string): Promise<SavedComparison | null> {
  // useCache: false — blob reads are served from cache by default, which would
  // serve a stale record straight after an edit.
  const res = await get(pathname, { access: ACCESS, useCache: false });
  if (!res || res.statusCode !== 200) return null;

  try {
    return JSON.parse(await new Response(res.stream).text()) as SavedComparison;
  } catch {
    return null;
  }
}

export function readComparison(id: string): Promise<SavedComparison | null> {
  if (useLocalStore) return local.read(id);
  return readByPathname(pathFor(id));
}

export async function listComparisons(): Promise<SavedComparison[]> {
  if (useLocalStore) return sortNewestFirst(await local.list());
  const pathnames: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    pathnames.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const loaded = await Promise.all(pathnames.map(readByPathname));

  return sortNewestFirst(loaded.filter((c): c is SavedComparison => c !== null));
}

const sortNewestFirst = (comparisons: SavedComparison[]) =>
  comparisons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export async function writeComparison(comparison: SavedComparison): Promise<SavedComparison> {
  if (useLocalStore) {
    await local.write(comparison);
    return comparison;
  }
  await put(pathFor(comparison.id), JSON.stringify(comparison), {
    access: ACCESS,
    contentType: 'application/json',
    // Stable pathname so a record can be addressed and updated by id.
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });

  return comparison;
}

export async function deleteComparison(id: string): Promise<void> {
  if (useLocalStore) return local.remove(id);
  await del(pathFor(id));
}
