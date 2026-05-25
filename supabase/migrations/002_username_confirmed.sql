-- ─────────────────────────────────────────────────────────────────────────────
-- Adicionar coluna username_confirmed e corrigir trigger para usuários anônimos
-- Executar no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nova coluna: indica se o usuário escolheu o próprio apelido
alter table public.users
  add column if not exists username_confirmed boolean default false;

-- 2. Corrigir o trigger: usuários anônimos não têm email nem metadata,
--    então geramos um apelido temporário do tipo "Jogador1234"
create or replace function public.handle_new_user()
returns trigger as $$
declare
  gen_username text;
begin
  gen_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'Jogador' || floor(random() * 9000 + 1000)::text
  );

  insert into public.users (id, email, username)
  values (new.id, new.email, gen_username)
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
