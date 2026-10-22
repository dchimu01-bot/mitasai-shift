import type { Assignment, Config, Day, Entry, Role, Slot } from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => new Date().toISOString();

export const slotKey = (dayId: string, slotId: string) => `${dayId}__${slotId}`;

// ---- ブラウザに覚えておく値 ----
export const ME_KEY = 'mitasai-shift:me';
export function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function lsSet(k: string, v: string) {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* 使えなくても動く */ }
}

// ---- 表記 ----
const WD = '日月火水木金土';
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}/${d}(${WD[new Date(y, m - 1, d).getDay()]})`;
}
export const fmtTime = (t: string) => t.replace(/^0(\d)/, '$1');
export function slotTime(s: Slot) {
  if (s.start && s.end) return `${fmtTime(s.start)}–${fmtTime(s.end)}`;
  if (s.start) return `${fmtTime(s.start)}–`;
  if (s.end) return `–${fmtTime(s.end)}`;
  return '時間指定なし';
}
export function fmtStamp(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function dayTitle(d: Day) {
  return d.label ? `${fmtDate(d.date)} ${d.label}` : fmtDate(d.date);
}

/** 部員名簿テキストを読み取る。改行・「、」・「,」区切り。重複は除く */
export function parseMembers(text: string) {
  const out: string[] = [];
  for (const raw of text.split(/[\n、,，]/)) {
    const n = raw.trim();
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// ---- 枠と必要人数 ----
export const stdNeed = (c: Config) => c.roles[0]?.need ?? 0;
export const isWork = (s: Slot) => !!s.name;

export function slotRoles(c: Config, s: Slot): Role[] {
  if (s.name) return [{ id: 'work', name: s.name, need: s.need ?? 0 }];
  if (s.need != null && c.roles.length === 1) return [{ ...c.roles[0], need: s.need }];
  return c.roles;
}

export type SlotRef = { day: Day; slot: Slot; key: string };
export function allSlots(c: Config): SlotRef[] {
  return c.days.flatMap((day) => day.slots.map((slot) => ({ day, slot, key: slotKey(day.id, slot.id) })));
}

/** 存在するメンバーのidだけを返す */
export function roleIds(a: Assignment, key: string, roleId: string, valid: Set<string>) {
  return (a.map[key]?.[roleId] ?? []).filter((id) => valid.has(id));
}
export function slotIds(a: Assignment, key: string, valid: Set<string>) {
  return Object.values(a.map[key] ?? {}).flat().filter((id) => valid.has(id));
}

/** メンバーごとの担当コマ数 */
export function countAssigned(c: Config, a: Assignment, entries: Entry[]) {
  const valid = new Set(entries.map((e) => e.id));
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.id] = 0;
  for (const { key } of allSlots(c)) {
    for (const id of new Set(slotIds(a, key, valid))) counts[id]++;
  }
  return counts;
}

export type RoleStatus = { role: Role; ids: string[]; short: number };
export function slotStatus(c: Config, a: Assignment, ref: SlotRef, valid: Set<string>): RoleStatus[] {
  return slotRoles(c, ref.slot).map((role) => {
    const ids = roleIds(a, ref.key, role.id, valid);
    return { role, ids, short: Math.max(0, role.need - ids.length) };
  });
}

/** 候補の並び順:ok が先 → 担当コマ数が少ない順 → id 順 */
export function candidateOrder(key: string, counts: Record<string, number>) {
  return (x: Entry, y: Entry) => {
    const ox = x.avail[key] === 'ok' ? 0 : 1;
    const oy = y.avail[key] === 'ok' ? 0 : 1;
    return ox - oy || (counts[x.id] ?? 0) - (counts[y.id] ?? 0) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  };
}

// ---- 自動割当 ----
export function autoAssign(c: Config, entries: Entry[], a: Assignment) {
  const valid = new Set(entries.map((e) => e.id));
  const counts = countAssigned(c, a, entries);
  const map: Assignment['map'] = JSON.parse(JSON.stringify(a.map));
  let added = 0;

  const refs = allSlots(c)
    .map((ref) => ({ ref, cands: entries.filter((e) => e.avail[ref.key]) }))
    .sort((x, y) => x.cands.length - y.cands.length);

  for (const { ref, cands } of refs) {
    for (const role of slotRoles(c, ref.slot)) {
      const slotMap = (map[ref.key] ??= {});
      const list = (slotMap[role.id] = (slotMap[role.id] ?? []).filter((id) => valid.has(id)));
      while (list.length < role.need) {
        const inSlot = new Set(Object.values(slotMap).flat());
        const pool = cands.filter((e) => !inSlot.has(e.id)).sort(candidateOrder(ref.key, counts));
        if (!pool.length) break;
        list.push(pool[0].id);
        counts[pool[0].id]++;
        added++;
      }
    }
  }
  return { map, added };
}
