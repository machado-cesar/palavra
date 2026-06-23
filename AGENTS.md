# char[5] — Guia para Agentes e Desenvolvedores

## O que é este projeto

**char[5]** é um clone do Wordle em português (PT-BR) com mecânicas de retenção. O jogador tenta adivinhar uma palavra de 5 letras por dia. Os diferenciais são o sistema de recuperação de pontos por espera (errar não é definitivo — esperar antes da próxima tentativa recupera pontos), o sistema de escudos (recompensam consistência e protegem o streak), o modo incansável (palavras ilimitadas por dia com ranking e troféus próprios), e o tema visual Copa do Mundo (ativado por padrão, desativável nas configurações).

O projeto é avaliado por acessos diários únicos — toda decisão de design serve ao objetivo de fazer o usuário voltar todo dia.

**URL de produção:** https://www.char5.com.br (char5.com.br redireciona 307 — sempre use www ao fazer curl)

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
| `CRON_SECRET` | Secret para autenticar o cron job e a rota /api/notifications/send |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ID do Google Analytics 4 (opcional) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave VAPID pública (Web Push) |
| `VAPID_PRIVATE_KEY` | Chave VAPID privada (Web Push) — nunca expor ao cliente |
| `VAPID_SUBJECT` | Email ou URL para identificar o remetente VAPID (ex: `mailto:seu@email.com`) |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (ex: `https://www.char5.com.br`) — usado pelo cron |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic — usada pelo cron para gerar a frase do dia via Claude |

---

## Arquitetura de alto nível

```
Browser (Next.js App Router, client components)
    │
    ├── /game               → página principal do jogo (modo diário)
    ├── /incansavel         → modo incansável / ilimitado
    ├── /incansavel/ranking → ranking do modo incansável (com troféus)
    ├── /incansavel/regras  → regras do modo incansável
    ├── /leaderboard        → ranking do modo diário
    ├── /como-jogar         → regras do modo diário
    │
    ▼
API Routes (Next.js, force-dynamic, executam no servidor)
    │
    ├── /api/game/start              → inicia sessão, verifica streak
    ├── /api/game/status             → estado atual (sessão, streak, tokens, username, frase se concluído)
    ├── /api/game/attempt            → valida tentativa, calcula score; retorna frase quando gameOver
    ├── /api/game/restore-streak     → gasta escudo para recuperar streak de dia perdido
    ├── /api/game/recover-streak     → gasta escudo para recuperar streak após derrota
    ├── /api/free/start              → inicia sessão no modo incansável
    ├── /api/free/attempt            → valida tentativa incansável; upsert em incansavel_completions
    ├── /api/notifications/subscribe → salva/remove push subscription do usuário
    ├── /api/notifications/send      → envia push para todos os assinantes (auth: CRON_SECRET)
    ├── /api/leaderboard             → top 10 do ranking diário com usernames
    ├── /api/incansavel/leaderboard  → ranking do modo incansável do dia com troféus
    ├── /api/user/username           → salva apelido escolhido
    └── /api/cron/daily-word         → Vercel Cron, 03:00 UTC (= meia-noite BRT)
                                       1. Sorteia palavra do dia
                                       2. Gera frase do dia via Claude (idempotente)
                                       3. Premia campeões do incansável de ontem
                                       4. Envia push notifications
```

---

## Convenções de código obrigatórias

### 1. `export const dynamic = 'force-dynamic'`
Todo API route DEVE ter esta linha no topo. Sem ela, o Next.js pode cachear a rota e o jogo quebra.

### 2. `normalizeWord()` — SEMPRE em ambos os lados
Palavras no banco são armazenadas **sem diacríticos** (BRAÇO → BRACO, AÇÃO → ACAO). Normalize sempre os dois lados ao comparar:

```typescript
import { normalizeWord } from '@/lib/words'
const match = normalizeWord(guess) === normalizeWord(wordOfDay)
```

### 3. Supabase usa Proxy pattern para lazy init
Nunca instancie `createClient()` diretamente fora do pattern definido em `src/lib/supabase.ts`.

### 4. `getTodayBRT()` para datas
Sempre use `getTodayBRT()` de `@/lib/date`. O servidor roda em UTC — às 21h BRT já é outro dia em UTC.

### 5. Redis keys — use sempre o objeto `keys`
```typescript
import { keys } from '@/lib/redis'
await redis.get(keys.session(userId))
```

---

## Banco de dados — tabelas principais

| Tabela | Propósito |
|---|---|
| `public.users` | `username`, `current_streak`, `max_streak`, `tokens` (escudos), `last_played_at`, `total_score`, `push_subscription` (jsonb), `incansavel_trophies` (int) |
| `public.words` | Palavras de 5 letras, maiúsculas, sem acentos. `used_at` marca quando foi usada |
| `public.game_sessions` | Histórico de partidas do modo diário. `attempts` é JSONB |
| `public.leaderboard_daily` | Placar diário por data. Unique constraint em `(user_id, date)` |
| `public.incansavel_completions` | Rastreia palavras acertadas por usuário por dia no modo incansável. Unique `(user_id, date)`. Upsertado a cada vitória |
| `public.incansavel_trophy_log` | Idempotência para o sistema de troféus — evita premiar duas vezes o mesmo dia |

**Trigger:** `on_auth_user_created` cria linha em `public.users` automaticamente.

**RPC:** `increment_incansavel_trophies(user_id)` — incrementa atomicamente `users.incansavel_trophies`.

---

## Redis — chaves e propósitos

| Chave | Tipo | TTL | Propósito |
|---|---|---|---|
| `session:active:{userId}` | String (JSON) | 24h | Sessão diária: `sessionId`, `wordId`, `attemptsCount`, `wrongAttempts`, `currentMaxScore`, `recoveryStartedAt?` |
| `session:free:{userId}` | String (JSON) | 24h | Sessão incansável: estado da partida + stats do dia (`wordsWon`, `recentWordIds`) |
| `ranking:daily:{YYYY-MM-DD}` | Sorted Set | 7 dias | Score diário. Member = userId, Score = pontuação |
| `ranking:incansavel:{YYYY-MM-DD}` | Sorted Set | 7 dias | Palavras acertadas no incansável. Member = userId, Score = wordsWon |
| `ranking:weekly:{YYYY-Www}` | Sorted Set | — | Score semanal |
| `ranking:alltime` | Sorted Set | permanente | Score histórico |
| `daily_frase:{YYYY-MM-DD}` | String (JSON) | 3 dias | Frase do dia gerada por Claude. `{ tipo, texto, explicacao? }` |

---

## Frase do dia

O cron chama `generateDailyFrase(word)` de `src/lib/anthropic.ts` após sortear a palavra. A geração é **idempotente** — só chama a API Anthropic se `daily_frase:{date}` não existir no Redis.

**Tipos possíveis (`DailyFrase.tipo`):**
- `ditado` — ditado popular real contendo a palavra; acompanha `explicacao`
- `etimologia` — curiosidade sobre a origem da palavra
- `improvisado` — ditado inventado no estilo popular mas nonsense; exibido com label "ditado improvisado"

**Modelo:** `claude-sonnet-4-6`

A frase é incluída na resposta de `/api/game/attempt` (quando `won || gameOver`) e de `/api/game/status` (quando `completedSession` existe). Exibida no `ResultScreen` entre o streak e o countdown.

**Para forçar regeneração:** delete `daily_frase:{YYYY-MM-DD}` no Upstash e chame o cron manualmente.

---

## Tema Copa do Mundo

Gerenciado via `ThemeContext` (`src/contexts/ThemeContext.tsx`), que envolve toda a aplicação em `src/app/layout.tsx`.

- **Padrão:** ativo para todos os usuários (opt-out salvo em `localStorage` como `char5_copa_theme`)
- **CSS global:** classe `body.copa` com overrides em `src/app/globals.css`
- **Componentes:** `WordGrid` e `Keyboard` recebem prop `copaTheme: boolean` para cores dos tiles
- **Toggle:** menu ⚙️ em `/game` e `/incansavel`

**Paleta Copa:** verde `#009c3b`, amarelo `#f5c400`, azul `#0d2240`, fundo `#020c1a`

---

## Menu de configurações

Disponível em `/game` e `/incansavel` via ícone ⚙️ no header (só aparece após autenticação). Contém:
- **Apelido** — exibe nick atual e abre `UsernameModal` para troca
- **Notificações** — toggle de push (só aparece se suportado pelo dispositivo/browser)
- **Tema ⚽ Copa do Mundo** — toggle via `ThemeContext`

Click-outside fecha o dropdown (`settingsRef` + `mousedown` listener).

---

## Sistema de troféus (modo incansável)

O cron premia diariamente o(s) campeão(ões) do modo incansável:
- Verifica `incansavel_completions` do dia anterior para encontrar `max(words_completed)`
- Todos empatados no máximo levam um troféu
- Incrementa `users.incansavel_trophies` via RPC `increment_incansavel_trophies`
- Idempotência via `incansavel_trophy_log`

**Exibição:** `TrophyBadge` com `🏆` + superscript Unicode (ex: `🏆⁵`). Visível no ranking do incansável.

---

## Fluxo do jogo passo a passo

```
1. Usuário acessa /game
   └── GET /api/game/status
         ├── Retorna username (para o menu de configurações)
         ├── Se já completou hoje → retorna completedSession + frase do dia
         ├── Se há sessão ativa → retorna currentSession + recoveryStartedAt
         └── Verifica streakAtRisk (faltou dia e tem escudos)

2. Início do jogo
   └── POST /api/game/start
         ├── gap ≥ 2 dias sem escudo → reseta streak
         ├── Busca palavra do dia (words.used_at = today BRT)
         └── Redis: setActiveSession(userId, { sessionId, wordId, attemptsCount: 0,
                                               currentMaxScore: 1500, wrongAttempts: 0 })

3. Tentativa
   └── POST /api/game/attempt { guess: "CARRO" }
         ├── Calcula pontos recuperados desde recoveryStartedAt (1pt/seg, máx 100)
         ├── Se errou: penalidade, novo recoveryStartedAt. Se 6 tentativas → gameOver
         ├── Se acertou ou gameOver → busca frase no Redis e inclui na resposta
         └── Se acertou: streak++, escudo a cada 3 dias, updateRanking

4. Fim de jogo
   └── ResultScreen: score, streak, frase do dia, countdown, share
         └── Se perdeu e tem escudos → StreakRecoveryModal
```

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

Score final ao vencer = currentMaxScore + recoveredPoints
Perder (6 tentativas) = 0 pts, não entra no ranking
```

---

## Gotchas e armadilhas conhecidas

1. **char5.com.br → redirect 307 para www** — curl perde o header `Authorization`. Use sempre `https://www.char5.com.br` diretamente.

2. **Palavra do dia pode ser NULL** — se o cron falhar, `/api/game/start` retorna 503.

3. **Frase pode estar ausente** — se a API Anthropic retornar erro (ex: 529 overloaded), o `ResultScreen` simplesmente não exibe o bloco. Para regenerar: delete `daily_frase:{YYYY-MM-DD}` no Upstash e chame o cron.

4. **Sessão anônima** — `signInAnonymously()` dispara trigger. Se falhar, operações subsequentes quebram com violação de FK.

5. **`normalizeWord` remove diacríticos E converte para maiúsculas.** Nunca compare strings brutas.

6. **`recoveryStartedAt` é calculado server-side** — o cliente só exibe, nunca calcula.

7. **ThemeContext hidrata do localStorage após montagem** — haverá um flash inicial com o tema padrão (copa=true). Esperado e aceitável.

---

## Como fazer deploy

1. Conecte o repositório na Vercel
2. Configure todas as variáveis (ver `.env.example`)
3. `vercel.json` já tem o cron em `0 3 * * *` (03:00 UTC = meia-noite BRT)
4. Execute as migrations do Supabase em ordem numérica

Após o deploy, valide:
- `/api/game/status` — retorna JSON sem erro 500
- `/leaderboard` — carrega sem erros
- Partida completa no modo diário e incansável
- Cron manual: `curl -X GET "https://www.char5.com.br/api/cron/daily-word" -H "Authorization: Bearer {CRON_SECRET}"`
