-- ─────────────────────────────────────────────────────────────────────────────
-- Palavra — Schema do Banco de Dados
-- Executar no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar extensão para UUID
create extension if not exists "uuid-ossp";

-- ─── Usuários ─────────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  total_score bigint default 0,
  current_streak int default 0,
  max_streak int default 0,
  tokens int default 0,
  last_played_at date
);

-- RLS: usuário só vê e edita o próprio perfil
alter table public.users enable row level security;

create policy "Usuário vê próprio perfil"
  on public.users for select
  using (auth.uid() = id);

create policy "Usuário edita próprio perfil"
  on public.users for update
  using (auth.uid() = id);

create policy "Perfis públicos para ranking"
  on public.users for select
  using (true);

-- ─── Banco de palavras (5 letras — MVP) ──────────────────────────────────────

create table public.words (
  id uuid primary key default uuid_generate_v4(),
  word char(5) not null unique,     -- sempre 5 letras, maiúsculas, sem acento
  difficulty smallint default 1,    -- 1=fácil, 2=médio, 3=difícil
  active boolean default true,
  used_at date                      -- quando foi a palavra do dia
);

-- Apenas admins editam palavras
alter table public.words enable row level security;

create policy "Palavras são leitura pública"
  on public.words for select
  using (true);

-- ─── Sessões de jogo ──────────────────────────────────────────────────────────

create table public.game_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  word_id uuid references public.words(id),
  started_at timestamptz default now(),
  completed_at timestamptz,
  score int default 0,
  max_possible_score int default 1200,
  timer_skips int default 0,
  token_used boolean default false,
  won boolean,
  attempts jsonb default '[]'::jsonb
);

alter table public.game_sessions enable row level security;

create policy "Usuário vê próprias sessões"
  on public.game_sessions for select
  using (auth.uid() = user_id);

create policy "Usuário cria próprias sessões"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza próprias sessões"
  on public.game_sessions for update
  using (auth.uid() = user_id);

-- ─── Placar diário ────────────────────────────────────────────────────────────

create table public.leaderboard_daily (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  date date not null,
  score int not null,
  rank int,
  unique(user_id, date)
);

alter table public.leaderboard_daily enable row level security;

create policy "Leaderboard é público"
  on public.leaderboard_daily for select
  using (true);

create policy "Usuário insere próprio score"
  on public.leaderboard_daily for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza próprio score"
  on public.leaderboard_daily for update
  using (auth.uid() = user_id);

-- ─── Índices ──────────────────────────────────────────────────────────────────

create index on public.game_sessions(user_id, started_at);
create index on public.leaderboard_daily(date, score desc);
create index on public.words(used_at);
create index on public.words(active);

-- ─── Função: criar perfil automaticamente após signup ────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Palavras iniciais para teste ─────────────────────────────────────────────

insert into public.words (word, difficulty, active, used_at) values
  ('CARRO', 1, true, current_date),
  ('BARCA', 1, true, null),
  ('PEDRA', 1, true, null),
  ('FORCA', 2, true, null),
  ('TROÇO', 2, true, null),
  ('GLOBO', 1, true, null),
  ('PRATO', 1, true, null),
  ('VELHO', 2, true, null),
  ('COBRA', 1, true, null),
  ('FESTA', 1, true, null);
