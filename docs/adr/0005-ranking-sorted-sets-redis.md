# ADR 0005 — Ranking em Sorted Sets do Redis

**Data:** 2025-11-15
**Status:** Aceito

## Contexto

O jogo precisa exibir um ranking dos top 10 jogadores do dia com suas pontuações. O ranking precisa:

- Ser atualizado em tempo real quando uma partida termina
- Retornar os top 10 ordenados por score decrescente em menos de 100ms
- Mostrar a posição do usuário atual (mesmo que não esteja no top 10)
- Suportar múltiplas granularidades: diário, semanal, all-time

As alternativas foram:

1. **Tabela SQL (`leaderboard_daily`)** — `SELECT ... ORDER BY score DESC LIMIT 10`
2. **Sorted Set do Redis** — estrutura nativa para ranking ordenado por score
3. **Híbrido** — Redis como cache do resultado SQL, invalidado ao final de cada partida

## Decisão

Usar **sorted sets do Upstash Redis** como fonte primária do ranking em tempo real.

Chaves utilizadas:
- `ranking:daily:{YYYY-MM-DD}` — ranking do dia, TTL 7 dias
- `ranking:weekly:{YYYY-Www}` — ranking da semana
- `ranking:alltime` — ranking histórico permanente

Operações Redis usadas:
- `ZADD key score member` — adiciona ou atualiza o score de um jogador
- `ZRANGE key 0 9 REV WITHSCORES` — retorna top 10 em ordem decrescente
- `ZREVRANK key member` — retorna a posição do usuário atual

O endpoint `/api/leaderboard` busca os top 10 do Redis, extrai os `userId`s e faz uma única query no Supabase para resolver os usernames. Essa resolução é feita por query `IN` — uma única round-trip ao banco por requisição de leaderboard.

A tabela `leaderboard_daily` no Supabase existe como **backup persistente** para análise histórica, mas não é consultada pelo endpoint de ranking em produção.

## Consequências

**Positivo:**
- `ZADD` e `ZREVRANK` são O(log N) — extremamente rápidos mesmo com muitos jogadores
- TTL nativo no sorted set diário limpa automaticamente dados antigos
- Não precisa de índice ou query complexa para ordenação — o Redis já mantém os dados ordenados
- Posição do usuário atual (`ZREVRANK`) é uma operação atômica e eficiente
- Consistente com o uso do Redis para sessões (ADR 0002) — mesma infraestrutura

**Negativo:**
- O username não é armazenado no Redis — apenas o `userId`. A resolução de usernames exige uma query ao Supabase a cada requisição de leaderboard
- Se o Redis perder os dados (restart, expiração acidental), o ranking do dia é perdido — a tabela SQL pode ser usada para recompor, mas exige processo manual
- Sorted sets no Redis não suportam "desempate por tempo" nativamente — jogadores com o mesmo score aparecem em ordem arbitrária
- Monitorar uso do Upstash: sorted sets acumulam membros ao longo do tempo (especialmente `ranking:alltime`), o que pode aumentar custos no plano pago
