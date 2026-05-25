# char[5] — Guia para Agentes e Desenvolvedores

## O que é este projeto

**char[5]** é um clone do Wordle em português (PT-BR) com mecânicas de retenção. O jogador tenta adivinhar uma palavra de 5 letras por dia. O diferencial está no sistema de timer progressivo (erros acumulados aumentam o tempo de espera entre tentativas) e no sistema de tokens (recompensam consistência e protegem o streak).

O projeto é avaliado por acessos diários únicos — toda decisão de design serve ao objetivo de fazer o usuário voltar todo dia.

**URL de produção:** https://palavra-xck5.vercel.app

---

## Rodando localmente

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e preencher variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com os valores reais (ver seção de variáveis abaixo)

# 3. Iniciar servidor de desenvolvimento
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
    │
    ▼
API Routes (Next.js, force-dynamic, executam no servidor)
    │
    ├── /api/game/start         → inicia sessão, verifica streak
    ├── /api/game/status        → estado atual (timer, sessão, streak)
    ├── /api/game/attempt       → valida tentativa, calcula score
    ├── /api/game/skip          → pula timer com penalidade
    ├── /api/game/restore-streak → gasta token para recuperar streak perdido
    ├── /api/leaderboard        → top 10 do dia com usernames
    ├── /api/user/username      → salva apelido escolhido
    └── /api/cron/daily-word    → escolhe palavra do dia (chamado pelo Vercel Cron)
         │
         ├── Supabase (PostgreSQL)
         │     ├── users               → perfil, streak, tokens
         │     ├── words               → banco de palavras (573 palavras)
         │     ├── game_sessions       → histórico de partidas
         │     └── leaderboard_daily   → placar persistente por data
         │
         └── Upstash Redis
               ├── session:active:{userId}  → estado da sessão em andamento (TTL 24h)
               ├── timer:{userId}           → timestamp de expiração do timer
               ├── ranking:daily:{YYYY-MM-DD} → sorted set (score → userId), TTL 7 dias
               ├── ranking:weekly:{YYYY-Www}  → sorted set semanal
               └── ranking:alltime          → sorted set histórico
```

---

## Convenções de código obrigatórias

### 1. `export const dynamic = 'force-dynamic'`
Todo API route DEVE ter esta linha no topo do arquivo. Sem ela, o Next.js pode cachear a rota e o jogo quebra.

```typescript
export const dynamic = 'force-dynamic'

export async function GET(req: Request) { ... }
```

### 2. `normalizeWord()` — SEMPRE em ambos os lados
Palavras no banco são armazenadas **sem diacríticos** (BRAÇO → BRACO, AÇÃO → ACAO). Ao comparar a tentativa do usuário com a palavra do dia, normalize **os dois lados**:

```typescript
import { normalizeWord } from '@/lib/words'

// Correto:
const match = normalizeWord(guess) === normalizeWord(wordOfDay)

// Errado — vai quebrar para palavras com acento:
const match = guess === wordOfDay
```

### 3. Supabase usa Proxy pattern para lazy init
O cliente Supabase é instanciado via Proxy para evitar erro em build time. Nunca instancie `createClient()` diretamente fora do pattern definido em `src/lib/supabase.ts`.

### 4. `last_played_at` é tipo `date` (YYYY-MM-DD)
No Postgres, a coluna é `date`, não `timestamptz`. Comparações de streak usam diferença em dias de calendário, não em milissegundos.

### 5. Redis keys — use sempre as funções do `keys` object
```typescript
import { keys } from '@/lib/redis'

// Correto:
await redis.get(keys.timer(userId))

// Errado — typo vai gerar chave errada sem erro visível:
await redis.get(`timr:${userId}`)
```

---

## Fluxo do jogo passo a passo

```
1. Usuário acessa /game
   └── GET /api/game/status
         ├── Supabase: auth.getUser() → cria sessão anônima se não existir
         ├── Redis: getActiveSession(userId)
         │     ├── Se existe → retorna estado atual (pode estar em waiting_timer)
         │     └── Se não existe → canPlay: true, aguarda start
         └── Verifica timer ativo (Redis key timer:{userId})

2. Usuário clica "Jogar"
   └── POST /api/game/start
         ├── Supabase: busca usuário, verifica last_played_at
         │     ├── Se gap > 1 dia → reseta streak (salvo por token se disponível)
         │     └── Se já jogou hoje → retorna sessão existente
         ├── Supabase: busca palavra do dia (words.used_at = today)
         └── Redis: setActiveSession(userId, { sessionId, wordId, attemptsCount: 0, ... })

3. Usuário submete tentativa
   └── POST /api/game/attempt { guess: "CARRO" }
         ├── normalizeWord(guess) e normalizeWord(wordOfDay)
         ├── evaluateAttempt() → array de LetterResult
         ├── Se acertou:
         │     ├── Calcula score final (MAX_SCORE - penalidades acumuladas)
         │     ├── Atualiza streak, total_score, last_played_at no Supabase
         │     ├── Redis: updateRanking(userId, score)
         │     ├── Redis: clearActiveSession, clearTimer
         │     └── Se streak % 3 === 0 → incrementa tokens (máx 5)
         ├── Se errou:
         │     ├── wrongAttempts >= ATTEMPTS_BEFORE_TIMER (2ª tentativa errada):
         │     │     └── Redis: setTimer(userId, getTimerMinutes(wrongAttempts))
         │     ├── Redis: atualiza sessão ativa
         │     └── Se 6 tentativas esgotadas → gameOver, revela palavra

4. Timer ativo (status = waiting_timer)
   └── Frontend exibe TimerBar com countdown
         ├── Usuário espera → timer expira, jogo continua automaticamente
         └── Usuário clica "Pular" → POST /api/game/skip
               ├── currentMaxScore -= PENALTY_PER_SKIP (100 pts)
               ├── Redis: clearTimer, atualiza sessão
               └── Retorna novo maxScore

5. Fim de jogo
   └── ResultScreen exibe score, streak, share button
         └── Countdown para meia-noite (próxima palavra)
```

---

## Banco de dados — tabelas principais

| Tabela | Propósito |
|---|---|
| `public.users` | Perfil do jogador: `username`, `current_streak`, `max_streak`, `tokens`, `last_played_at`, `total_score` |
| `public.words` | Banco de palavras (5 letras, maiúsculas, sem acentos). `used_at` marca quando foi palavra do dia. `active` filtra palavras disponíveis |
| `public.game_sessions` | Histórico completo de partidas. `attempts` é JSONB com array de tentativas e resultados |
| `public.leaderboard_daily` | Placar diário persistente. Índice composto `(user_id, date)` com unique constraint |

**Trigger importante:** `on_auth_user_created` cria linha em `public.users` automaticamente quando um novo auth user é inserido (inclusive anônimos).

---

## Redis — chaves e propósitos

| Chave | Tipo | TTL | Propósito |
|---|---|---|---|
| `session:active:{userId}` | String (JSON) | 24h | Estado da sessão em andamento: `sessionId`, `wordId`, `attemptsCount`, `wrongAttempts`, `currentMaxScore` |
| `timer:{userId}` | String (ISO timestamp) | duração do timer | Quando o timer de penalidade expira |
| `ranking:daily:{YYYY-MM-DD}` | Sorted Set | 7 dias | Score de cada jogador no dia. Member = userId, Score = pontuação |
| `ranking:weekly:{YYYY-Www}` | Sorted Set | sem expiração explícita | Score acumulado semanal |
| `ranking:alltime` | Sorted Set | permanente | Score acumulado de todos os tempos |

---

## Pontuação

```
MAX_SCORE = 1200

Score final = MAX_SCORE
            - (wrongAttempts × 200)   ← PENALTY_PER_WRONG
            - (timerSkips × 100)      ← PENALTY_PER_SKIP

Score mínimo ao vencer = 10 (mesmo com muitos erros/skips)
Perder (6 tentativas sem acertar) = score 0, não entra no ranking
```

### Timer progressivo

O timer só ativa a partir da **2ª tentativa errada** e cresce conforme erros acumulados:

| wrongAttempts | Timer |
|---|---|
| ≤ 2 | 2 minutos |
| 3 | 5 minutos |
| 4 | 10 minutos |
| 5+ | 30 minutos |

Implementado em `getTimerMinutes(wrongAttempts)` em `src/types/index.ts`.

---

## Sistema de tokens

- **Ganhar token:** a cada 3 dias de streak consecutivos perfeitos (sem skips sem tokens gastos). Máximo de 5 tokens acumulados.
- **Gasto automático ao perder:** se o jogador perde e tem tokens, 1 token é gasto automaticamente para preservar o streak. O campo `streakSaved: true` é retornado na `AttemptResponse`.
- **Gasto manual (restore-streak):** se o jogador perdeu um dia (gap = 1 dia sem jogar), ao abrir o jogo aparece prompt oferecendo gastar 1 token para restaurar o streak. Rota: `POST /api/game/restore-streak`.
- **Campo no banco:** `users.tokens int default 0` — gerenciado pelo servidor, nunca pelo cliente.

---

## Gotchas e armadilhas conhecidas

1. **Palavra do dia pode ser NULL:** se o cron de `03:00 UTC` falhar, não haverá palavra com `used_at = today`. O `/api/game/start` retorna erro. Verifique os logs do Vercel Cron.

2. **Sessão anônima no Supabase:** `supabase.auth.signInAnonymously()` cria um usuário real em `auth.users` e dispara o trigger `on_auth_user_created`. Se o trigger falhar, a linha em `public.users` não é criada e todas as operações subsequentes falham com violação de FK.

3. **Redis pode ter sessão de dia anterior:** se o usuário não terminar o jogo e a sessão expirar (TTL 24h), o Redis não tem mais a sessão mas o Supabase pode ter `last_played_at` de hoje. O `/api/game/status` precisa checar os dois.

4. **`normalizeWord` é case-insensitive na prática:** a função converte para maiúsculas E remove diacríticos. Sempre use para comparações, nunca compare strings diretamente.

5. **Sorted sets no Redis não são `ZADD NX`:** se o jogador jogar duas vezes (bug), o score é sobrescrito. O `/api/game/attempt` deve verificar se a sessão já foi completada antes de aceitar tentativas.

6. **`last_played_at` é `date` (sem hora):** comparar com `new Date()` vai dar erro de tipo. Use `new Date().toISOString().split('T')[0]` para obter a data no formato correto.

7. **CRON_SECRET:** a rota `/api/cron/daily-word` deve rejeitar requests sem o header `Authorization: Bearer {CRON_SECRET}`. Sem isso, qualquer pessoa pode trocar a palavra do dia.

---

## Como fazer deploy

### Deploy na Vercel (recomendado)

1. Conecte o repositório na Vercel
2. Configure todas as variáveis de ambiente no painel da Vercel
3. Configure o Cron Job em `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-word",
      "schedule": "0 3 * * *"
    }
  ]
}
```

4. O cron roda às 03:00 UTC todos os dias e escolhe a próxima palavra disponível (palavras onde `active = true` e `used_at IS NULL`)

### Banco de dados

- Execute `supabase/schema.sql` no SQL Editor do Supabase para criar as tabelas
- Execute `supabase/seeds/words.sql` para importar as 573 palavras
- As migrations em `supabase/migrations/` devem ser executadas em ordem (`001_`, `002_`, `003_`)

### Verificar funcionamento

Após o deploy, acesse:
- `/api/game/status` — deve retornar JSON (não erro 500)
- `/leaderboard` — deve carregar sem erros
- Jogue uma partida completa para validar o fluxo
