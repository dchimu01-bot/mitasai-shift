export type Mark = 'ok' | 'maybe';

export type Role = { id: string; name: string; need: number };

export type Slot = {
  id: string;
  start: string; // "09:30"。専用作業なら空でもよい
  end: string;
  name?: string; // 専用作業名。あるとこの枠は専用作業枠
  need?: number; // この枠の必要人数。なければ標準人数
};

export type Day = { id: string; date: string; label: string; slots: Slot[] };

export type Config = {
  title: string;
  members: string[];
  roles: Role[];
  days: Day[];
  updatedAt: string;
};

export type Entry = {
  id: string;
  name: string;
  avail: Record<string, Mark>; // 不可はキーを持たない
  updatedAt: string;
};

export type Assignment = {
  map: Record<string, Record<string, string[]>>; // slotKey -> roleId -> entryId[]
  updatedAt: string;
};

export type Data = { config: Config; entries: Entry[]; assignment: Assignment };
