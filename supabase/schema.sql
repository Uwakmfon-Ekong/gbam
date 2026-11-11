-- Gbam: run this once in Supabase → SQL Editor.
-- One generic table of JSON documents. All access goes through the Next.js API routes
-- using the service-role key, so RLS is enabled with NO policies (anon key can't read anything).

create table if not exists public.records (
  kind        text        not null,          -- 'gift' | 'split' | 'share' | 'profile'
  id          text        not null,
  data        jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (kind, id)
);

create index if not exists records_split_idx  on public.records ((data->>'splitId')) where kind = 'share';
create index if not exists records_sender_idx on public.records ((data->>'sender'))  where kind = 'gift';

alter table public.records enable row level security;
