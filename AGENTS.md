# char[5] — Guia para Agentes e Desenvolvedores

## O que é este projeto

**char[5]** é um clone do Wordle em português (PT-BR) com mecânicas de retenção. O jogador tenta adivinhar uma palavra de 5 letras por dia. O diferencial está no sistema de recuperação de pontos por espera (errar não é definitivo — esperar antes da próxima tentativa recupera pontos) e no sistema de escudos (recompensam consistência e protegem o streak).

O projeto é avaliado por acessos diários únicos — toda decisão de design serve ao objetivo de fazer o usuário voltar todo dia.

**URL de produção:** https://char5.com.br (redirect de https://palavra-xck5.vercel.app)

---

## Rodando localmente

```bash
npm install
cp .env.example .env.local
# Edite .env.local com os valores reais
npm run dev
# Acesse http://localhost:3000
```

### Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (usada nos API routes) |
| `UPSTASH_REDIS_REST_URL` | URL do Redis Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Redis Upstash |
| `CRON_SECRET` | Secret para autenticar o cron job de palavra diária |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ID do Google Analytics 4 (opcional) |

---

## Arquitetura de alto nível

```
Browser (Next.js App Router, client components)
    │
    ├── /game          → página principal do jogo
    ├── /leaderboard   → ranking do dia
    ├── /como-jogar    → regras
    │
    ▼
API Routes (Next.js, force-dynamic, executam no servidor)
    │
    ├── /api/game/start          → inicia sessão, verifica streak
    ├── /api/game/status         → estado atual (sessão ativa, streak, tokens)
    ├── /api/game/attempt        → valida tentativa, calcula score com recovery
    ├── /api/game/restore-streak → gasta escudo para recuperar streak de dia perdido
    ├── /api/game/recover-streak → gasta escudo para recuperar streak após derrota
    ├── /api/leaderboard         → top 10 do dia com usernames
    ├── /api/user/username       → salva apelido escolhido
    └── /api/cron/daily-word     → escolhe palavra do dia (Vercel Cron, 03:00 UTC)
         │
         ├── Supabase (PostgreSQL)
         │     ├── users               → perfil, streak, tokens
         │     ├── words               → banco de palavras
         │     ├── game_sessions       → histórico de partidas
         │     └── leaderboard_daily   → placar persistente por data
         │
         └── Upstash Redis
               ├── session:active:{userId}    → estado da sessão em andamento (TTL 24h)
               ├── ranking:daily:{YYYY-MM-DD} → sorted set (score → userId), TTL 7 dias
               ├── ranking:weekly:{YYYY-Www}  → sorted set semanal
               └── ranking:alltime            → sorted set histórico
```

---

## Convenções de código obrigatórias

### 1. `export const dynamic = 'force-dynamic'`
Todo API route DEVE ter esta linha no topo do arquivo. Sem ela, o Next.js pode cachear a rota e o jogo quebra.

### 2. `normalizeWord()` — SEMPRE em ambos os lados
Palavras no banco são armazenadas **sem diacríticos** (BRAÇO → BRACO, AÇÃO → ACAO). Normalize sempre os dois lados ao comparar:

```typescript
import { normalizeWord } from '@/lib/words'
const match = normalizeWord(guess) === normalizeWord(wordOfDay)
```

### 3. Supabase usa Proxy pattern para lazy init
Nunca instancie `createClient()` diretamente fora do pattern definido em `src/lib/supabase.ts`.

### 4. `last_played_at` é tipo `date` (YYYY-MM-DD)
Comparações de streak usam diferença em dias de calendário, não em milissegundos.

### 5. Redis keys — use sempre as funções do `keys` object
```typescript
import { keys } from '@/lib/redis'
await redis.get(keys.session(userId))
```

### 6. `getTodayBRT()` para datas
Sempre use `getTodayBRT()` de `@/lib/date` para obter a data de hoje em horário de Brasília. Nunca use `new Date()` direto — o servidor roda em UTC e às 21h BRT já é outro dia em UTC.

---

## Fluxo do jogo passo a passo

```
1. Usuário acessa /game
   └── GET /api/game/status
         ├── Auth: cria sessão anônima se não existir
         ├── Verifica se já completou hoje → retorna completedSession
         ├── Verifica sessão ativa em Redis → retorna currentSession + recoveryStartedAt
         └── Verifica streakAtRisk (faltou dia e tem escudos)

2. Início do jogo
   └── POST /api/game/start
         ├── Verifica last_played_at: gap ≥ 2 dias sem escudo → reseta streak
         ├── Busca palavra do dia (words.used_at = today BRT)
         └── Redis: setActiveSession(userId, { sessionId, wordId, attemptsCount: 0,
                                               currentMaxScore: 1500, wrongAttempts: 0 })

3. Usuário submete tentativa
   └── POST /api/game/attempt { guess: "CARRO" }
         ├── Lê recoveryStartedAt da sessão → calcula pontos recuperados (1pt/seg, máx 100)
         ├── scoreAfterRecovery = currentMaxScore + recoveredPoints
         ├── Se errou:
         │     ├── penalty = 100 (1º erro) ou 200 (demais erros)
         │     ├── newMaxScore = scoreAfterRecovery - penalty
         │     ├── Salva recoveryStartedAt = now() na sessão Redis
         │     └── Se 6 tentativas → gameOver, score 0, reset streak (oferta de escudo)
         └── Se acertou:
               ├── finalScore = scoreAfterRecovery (sem nova penalidade)
               ├── Incrementa streak (qualquer vitória conta)
               ├── Se streak % 3 === 0 → +1 escudo (máx 3)
               └── updateRanking(userId, finalScore)

4. Recovery visual (não bloqueante)
   └── Frontend recebe recoveryStartedAt e exibe RecoveryBar
         ├── Barra de pontuação cresce em tempo real (+1pt/seg)
         ├── Texto "+[n] recuperados" ao lado da barra
         └── Jogador pode tentar a qualquer momento (sem bloqueio)

5. Fim de jogo
   └── ResultScreen: score, streak, share com posição no ranking e desafio
         └── Se perdeu e tem escudos → StreakRecoveryModal (escolha do jogador)
```

---

## Banco de dados — tabelas principais

| Tabela | Propósito |
|---|---|
| `public.users` | `username`, `current_streak`, `max_streak`, `tokens` (escudos), `last_played_at`, `total_score` |
| `public.words` | Palavras de 5 letras, maiúsculas, sem acentos. `used_at` marca quando foi usada. `active` filtra disponíveis |
| `public.game_sessions` | Histórico de partidas. `attempts` é JSONB. `max_possible_score` reflete score após penalidades |
| `public.leaderboard_daily` | Placar diário por data. Unique constraint em `(user_id, date)` |

**Trigger:** `on_auth_user_created` cria linha em `public.users` automaticamente.

---

## Redis — chaves e propósitos

| Chave | Tipo | TTL | Propósito |
|---|---|---|---|
| `session:active:{userId}` | String (JSON) | 24h | Sessão em andamento: `sessionId`, `wordId`, `attemptsCount`, `wrongAttempts`, `currentMaxScore`, `recoveryStartedAt?` |
| `ranking:daily:{YYYY-MM-DD}` | Sorted Set | 7 dias | Score diário. Member = userId, Score = pontuação |
| `ranking:weekly:{YYYY-Www}` | Sorted Set | — | Score semanal |
| `ranking:alltime` | Sorted Set | permanente | Score histórico |

---

## Pontuação

```
MAX_SCORE = 1500

Penalidade por erro:
  1º erro:     −100 pts
  2º+ erros:   −200 pts cada

Recuperação (não bloqueante):
  Após cada erro, 100 segundos de recovery disponíveis
  +1 pt/segundo → máximo de +100 pts recuperados

Score final ao vencer = currentMaxScore + recoveredPoints (último erro)
Perder (6 tentativas) = 0 pts, não entra no ranking
```

### Pontuação máxima por tentativa (esperando os 100s completos)

| Acerta na | Máximo |
|---|---|
| 1ª tentativa | 1.500 pts |
| 2ª tentativa | 1.500 pts (1º erro: −100 + 100 recuperados = líquido 0) |
| 3ª tentativa | 1.400 pts |
| 4ª tentativa | 1.300 pts |
| 5ª tentativa | 1.200 pts |
| 6ª tentativa | 1.100 pts |

---

## Sistema de escudos

- **Ganhar escudo:** a cada 3 dias consecutivos de streak (qualquer vitória conta). Máximo de 3 escudos acumulados.
- **Após derrota:** streak é resetado imediatamente. Se o jogador tinha escudos, aparece `StreakRecoveryModal` perguntando se quer gastar 1 escudo para recuperar o streak. Rota: `POST /api/game/recover-streak` com `{ prevStreak }`.
- **Dia perdido:** se `last_played_at` tem gap ≥ 2 dias e o jogador tem escudos, aparece prompt ao abrir o jogo. Rota: `POST /api/game/restore-streak`.
- **Campo no banco:** `users.tokens int default 0` — gerenciado pelo servidor, nunca pelo cliente.

---

## Gotchas e armadilhas conhecidas

1. **Palavra do dia pode ser NULL:** se o cron de 03:00 UTC falhar, não haverá palavra com `used_at = today`. O `/api/game/start` retorna erro 503.

2. **Sessão anônima no Supabase:** `supabase.auth.signInAnonymously()` dispara `on_auth_user_created`. Se o trigger falhar, operações subsequentes falham com violação de FK.

3. **Redis pode ter sessão de dia anterior:** sessão expira em 24h. Se o usuário não terminar, o Redis não tem a sessão mas o Supabase pode ter `last_played_at` de hoje.

4. **`normalizeWord` remove diacríticos E converte para maiúsculas.** Nunca compare strings de palavras diretamente.

5. **`recoveryStartedAt` deve ser limpo ao iniciar nova tentativa.** O cliente limpa o estado local; o servidor calcula o recovery real pelo timestamp salvo na sessão Redis.

6. **Sorted sets no Redis não usam ZADD NX.** Se a sessão for completada duas vezes (bug), o score é sobrescrito. O `/api/game/attempt` verifica se a sessão já foi completada antes de aceitar tentativas.

7. **CRON_SECRET:** `/api/cron/daily-word` rejeita requests sem `Authorization: Bearer {CRON_SECRET}`.

---

## Como fazer deploy

1. Conecte o repositório na Vercel
2. Configure todas as variáveis de ambiente
3. O `vercel.json` já tem o cron configurado para `0 3 * * *` (03:00 UTC = meia-noite BRT)
4. Execute as migrations do Supabase em ordem: `supabase/migrations/001_`, `002_`, `003_`

Após o deploy, valide:
- `/api/game/status` — retorna JSON sem erro 500
- `/leaderboard` — carrega sem erros
- Partida completa (incluindo derrota para testar StreakRecoveryModal)
