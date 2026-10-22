-- 三田祭 将棋研シフト:Supabase の SQL Editor で一度だけ実行する
-- 認証なし。誰でも読み書きできる設定。

create table if not exists config (
  id int primary key default 1,
  data jsonb not null
);

create table if not exists entries (
  id text primary key,
  name text not null unique,
  avail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists assignment (
  id int primary key default 1,
  data jsonb not null
);

alter table config enable row level security;
alter table entries enable row level security;
alter table assignment enable row level security;

create policy "anyone" on config for all using (true) with check (true);
create policy "anyone" on entries for all using (true) with check (true);
create policy "anyone" on assignment for all using (true) with check (true);
