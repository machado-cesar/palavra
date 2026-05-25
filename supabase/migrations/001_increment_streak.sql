-- Função chamada pelo attempt/route.ts quando o jogador vence sem usar skip
-- Incrementa current_streak, atualiza max_streak se necessário, e registra last_played_at

create or replace function public.increment_streak(user_id uuid)
returns void as $$
begin
  update public.users
  set
    current_streak = current_streak + 1,
    max_streak     = greatest(max_streak, current_streak + 1),
    last_played_at = current_date
  where id = user_id;
end;
$$ language plpgsql security definer;
