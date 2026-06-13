-- Migration 004: notificações push opt-in
-- Adiciona coluna para armazenar a subscription Web Push do usuário.
-- NULL = usuário não optou por notificações (ou desativou).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_subscription jsonb DEFAULT NULL;

-- Índice parcial para facilitar o SELECT de todos os assinantes
-- (usado pela rota /api/notifications/send)
CREATE INDEX IF NOT EXISTS users_push_subscription_idx
  ON public.users (id)
  WHERE push_subscription IS NOT NULL;
