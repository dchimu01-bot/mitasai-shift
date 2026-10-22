// データの読み書き。Supabase の設定があれば Supabase、なければブラウザ内(試用モード)に保存する。
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CONFIG, EMPTY_ASSIGNMENT } from './defaults';
import type { Assignment, Config, Data, Entry } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export const isLocal = !sb;

type EntryRow = { id: string; name: string; avail: Entry['avail']; updated_at: string };
const toEntry = (r: EntryRow): Entry => ({ id: r.id, name: r.name, avail: r.avail ?? {}, updatedAt: r.updated_at });
const toRow = (e: Entry): EntryRow => ({ id: e.id, name: e.name, avail: e.avail, updated_at: e.updatedAt });

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const err = new Error(res.error.message) as Error & { code?: string };
    err.code = res.error.code;
    throw err;
  }
  return res.data;
}

// ---- 試用モード(localStorage) ----
const LOCAL_KEY = 'mitasai-shift:db';
function localRead(): Data {
  let d: Partial<Data> = {};
  try { d = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { /* 空として扱う */ }
  return {
    config: d.config ?? structuredClone(DEFAULT_CONFIG),
    entries: d.entries ?? [],
    assignment: d.assignment ?? structuredClone(EMPTY_ASSIGNMENT),
  };
}
function localWrite(fn: (d: Data) => void) {
  const d = localRead();
  fn(d);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* 保存できない環境 */ }
}

// ---- API ----
export async function loadAll(): Promise<Data> {
  if (!sb) return localRead();
  const [c, e, a] = await Promise.all([
    sb.from('config').select('data').eq('id', 1).maybeSingle(),
    sb.from('entries').select('*').order('updated_at'),
    sb.from('assignment').select('data').eq('id', 1).maybeSingle(),
  ]);
  let config = check(c)?.data as Config | undefined;
  if (!config) {
    config = structuredClone(DEFAULT_CONFIG);
    await saveConfig(config);
  }
  return {
    config,
    entries: (check(e) as EntryRow[]).map(toEntry),
    assignment: (check(a)?.data as Assignment | undefined) ?? structuredClone(EMPTY_ASSIGNMENT),
  };
}

export async function saveConfig(config: Config) {
  if (!sb) return localWrite((d) => { d.config = config; });
  check(await sb.from('config').upsert({ id: 1, data: config }));
}

export async function saveAssignment(assignment: Assignment) {
  if (!sb) return localWrite((d) => { d.assignment = assignment; });
  check(await sb.from('assignment').upsert({ id: 1, data: assignment }));
}

export async function saveEntries(entries: Entry[]) {
  if (!entries.length) return;
  if (!sb) {
    return localWrite((d) => {
      for (const e of entries) {
        const i = d.entries.findIndex((x) => x.id === e.id);
        if (i >= 0) d.entries[i] = e; else d.entries.push(e);
      }
    });
  }
  check(await sb.from('entries').upsert(entries.map(toRow)));
}

export async function findEntryByName(name: string): Promise<Entry | null> {
  if (!sb) return localRead().entries.find((e) => e.name === name) ?? null;
  const row = check(await sb.from('entries').select('*').eq('name', name).maybeSingle()) as EntryRow | null;
  return row ? toEntry(row) : null;
}
