-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema de tokens: proteção de streak
-- Executar no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Coluna tokens — acumula até 5, padrão 0
alter table public.users
  add column if not exists tokens integer not null default 0;
