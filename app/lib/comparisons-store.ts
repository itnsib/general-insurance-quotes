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
  return readByPathname(pathFor(id));
}

export async function listComparisons(): Promise<SavedComparison[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    pathnames.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const loaded = await Promise.all(pathnames.map(readByPathname));

  return loaded
    .filter((c): c is SavedComparison => c !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function writeComparison(comparison: SavedComparison): Promise<SavedComparison> {
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
  await del(pathFor(id));
}
