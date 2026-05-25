# ADR 0002 — Redis para Sessões Ativas e Timers

**Data:** 2025-11-01
**Status:** Aceito

## Contexto

O jogo precisa rastrear dois tipos de estado de curta duração durante uma partida:

1. **Sessão ativa** — quantas tentativas já foram feitas, qual é o score máximo atual, quantos erros acumulados. Esse estado muda a cada tentativa e só é relevante enquanto a partida está em andamento (máximo 24h).

2. **Timer de penalidade** — quando o timer de espera expira. É uma informação de tempo absoluto (ISO timestamp) com TTL igual à duração do timer.

As alternativas para armazenar esse estado foram:

1. **Apenas o Supabase (PostgreSQL)** — gravar cada update na tabela `game_sessions`
2. **localStorage no browser** — estado no cliente, sem round-trip ao servidor
3. **Redis (Upstash)** — estado no servidor com TTL nativo

## Decisão

Usar **Upstash Redis** para o estado de sessão ativa e timers.

- `session:active:{userId}` — JSON com o estado da partida em andamento, TTL 24h
- `timer:{userId}` — ISO timestamp de expiração do timer, TTL igual à duração do timer

O Supabase continua sendo a fonte de verdade para o histórico persistente: quando a partida termina (acerto ou derrota), os dados são gravados em `game_sessions` e o Redis é limpo.

O Upstash foi escolhido especificamente por ser um Redis gerenciado com API HTTP REST, compatível com o ambiente serverless da Vercel (sem conexões TCP persistentes).

## Consequências

**Positivo:**
- Leituras e escritas de estado de partida são O(1) e muito rápidas
- TTL nativo do Redis garante limpeza automática de sessões abandonadas — sem garbage collection manual no SQL
- Timer com TTL nativo: se o Redis expira a chave, o timer naturalmente "expirou"
- Reduz carga de escrita no Postgres durante a partida (múltiplas tentativas = múltiplas escritas)
- Serverless-friendly via Upstash REST API

**Negativo:**
- Dois sistemas de persistência para gerenciar — Redis e Postgres precisam estar em sincronia
- Se o Redis reiniciar ou a chave expirar inesperadamente, a sessão ativa é perdida (o jogo trata isso como "sessão não encontrada", permitindo reiniciar)
- Upstash tem limite de requests no plano gratuito — monitorar em caso de crescimento de usuários
- Estado de sessão no Redis não é consultável via SQL — não é possível debugar partidas em andamento pelo Supabase dashboard
