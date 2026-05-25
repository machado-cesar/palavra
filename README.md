# char[5]

Clone do Wordle em português com mecânicas de retenção. Adivinhe a palavra de 5 letras do dia — mas cuidado: cada erro consecutivo aumenta o tempo de espera antes da próxima tentativa.

**[Jogar agora →](https://palavra-xck5.vercel.app)**

---

## Funcionalidades

- **Palavra do dia** — uma nova palavra de 5 letras todo dia às 00:00 (horário de Brasília)
- **Timer progressivo** — após o 2º erro, um timer de espera é ativado; ele cresce a cada erro seguinte (2min → 5min → 10min → 30min)
- **Streak diário** — sequência de dias consecutivos jogados, visível no header
- **Sistema de tokens** — ganhe tokens ao manter o streak por 3 dias; use-os para proteger seu streak se perder um dia
- **Ranking diário** — top 10 jogadores do dia com suas pontuações
- **Sem cadastro** — sessão anônima criada automaticamente, sem senha nem e-mail necessários
- **Apelido** — escolha um nome para aparecer no ranking
- **Compartilhar resultado** — copie o emoji grid para compartilhar
- **Open Graph dinâmico** — preview personalizado ao compartilhar o link

---

## Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilo | Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Anonymous Auth |
| Cache / Sessões | Upstash Redis |
| Deploy | Vercel (com Cron Jobs) |
| Analytics | Google Analytics 4 |

---

## Configuração local

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) com projeto criado
- Conta no [Upstash](https://upstash.com) com banco Redis criado

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/palavra.git
cd palavra

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com os valores do seu Supabase e Upstash

# 4. Configure o banco de dados
# No Supabase SQL Editor, execute em ordem:
#   supabase/schema.sql
#   supabase/seeds/words.sql
#   supabase/migrations/001_increment_streak.sql
#   supabase/migrations/002_username_confirmed.sql
#   supabase/migrations/003_tokens.sql

# 5. Inicie o servidor
npm run dev
# Acesse http://localhost:3000
```

---

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave de serviço do Supabase (usada nos API routes) |
| `UPSTASH_REDIS_REST_URL` | Sim | URL do banco Redis no Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Sim | Token de autenticação do Redis |
| `CRON_SECRET` | Sim | Segredo para proteger o endpoint do cron job |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Não | ID do Google Analytics 4 (ex: G-XXXXXXXXXX) |

---

## Estrutura de pastas

```
src/
  app/
    api/
      game/
        attempt/    — valida tentativa, calcula score, gerencia streak/tokens
        start/      — inicia sessão, verifica streak
        status/     — estado atual (timer, sessão, streak, tokens)
        skip/       — pula timer com penalidade de -100 pts
        restore-streak/ — gasta token para recuperar streak perdido
      leaderboard/  — top 10 do dia com usernames
      user/username/ — salva apelido
      cron/daily-word/ — escolhe palavra do dia (Vercel Cron, 03:00 UTC)
    game/           — página principal do jogo
    leaderboard/    — página do ranking
  components/game/
    WordGrid.tsx    — grid 6×5 de letras
    Keyboard.tsx    — teclado virtual
    TimerBar.tsx    — barra de progresso do timer
    SkipModal.tsx   — confirmação de skip
    ResultScreen.tsx — modal de resultado (score, streak, share)
    UsernameModal.tsx — escolha de apelido
    ScoreDisplay.tsx — placar atual
  lib/
    redis.ts        — helpers para Redis (sessão, timer, ranking)
    supabase.ts     — cliente Supabase com lazy init
    words.ts        — evaluateAttempt, normalizeWord, isValidGuess
    scoring.ts      — calculateFinalScore, getMaxScoreForAttempt
  types/index.ts    — tipos TypeScript e constantes de pontuação
supabase/
  schema.sql        — schema completo do banco
  seeds/words.sql   — 573 palavras em português
  migrations/       — migrações incrementais
```

---

## Como funciona o jogo

### Regras básicas

1. Você tem 6 tentativas para adivinhar a palavra de 5 letras do dia
2. Após cada tentativa, as letras são coloridas:
   - **Verde** — letra correta na posição correta
   - **Amarelo** — letra existe na palavra, mas está na posição errada
   - **Cinza** — letra não está na palavra
3. Uma nova palavra aparece todo dia à meia-noite

### Timer progressivo

A partir do **2º erro**, um timer é ativado antes de cada nova tentativa. O tempo aumenta conforme os erros acumulados:

| Erros | Timer de espera |
|---|---|
| 2 erros | 2 minutos |
| 3 erros | 5 minutos |
| 4 erros | 10 minutos |
| 5+ erros | 30 minutos |

Você pode pular o timer com uma penalidade de **-100 pontos**.

### Pontuação

```
Pontuação base: 1200 pontos
-200 por cada tentativa errada
-100 por cada skip de timer
Mínimo ao acertar: 10 pontos
```

### Streak e tokens

- Jogar todos os dias mantém seu **streak** (sequência de dias consecutivos)
- A cada **3 dias de streak** você ganha 1 token (máximo 5 tokens acumulados)
- Se você **perder uma partida** e tiver tokens, 1 token é gasto automaticamente para preservar seu streak
- Se você **pular um dia**, pode usar 1 token para restaurar o streak antes de jogar

---

## Deploy

### Vercel (recomendado)

1. Conecte o repositório na Vercel
2. Configure as variáveis de ambiente no painel da Vercel
3. Adicione o cron job no `vercel.json`:

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

O cron roda às **03:00 UTC** (meia-noite no horário de Brasília) e escolhe automaticamente a próxima palavra disponível.

---

## Licença

MIT
