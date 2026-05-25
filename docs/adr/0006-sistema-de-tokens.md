# ADR 0006 — Sistema de Tokens para Proteção de Streak

**Data:** 2025-12-01
**Status:** Aceito

## Contexto

O streak (sequência de dias consecutivos jogados) é o principal mecanismo de retenção do jogo. Jogadores que mantêm um streak longo têm forte incentivo para voltar todo dia.

O problema: um único dia esquecido ou uma única derrota destroça o streak completamente. Isso é frustrante o suficiente para fazer jogadores desistirem do jogo inteiramente — especialmente depois de streaks longos.

O Duolingo resolveu esse problema com "streak freeze" (comprado com moeda virtual). Precisávamos de um mecanismo similar que:

1. Recompensasse consistência ao longo do tempo
2. Protegesse o streak de perda acidental (esqueceu um dia, teve um dia difícil)
3. Não fosse tão fácil de acumular que perdesse o valor
4. Não criasse uma economia complexa que precisasse de balanceamento constante

As alternativas consideradas foram:

1. **Sem proteção** — streak se perde ao errar ou pular dia (comportamento atual do Wordle)
2. **Streak freeze automático** — os últimos N dias de streak servem como buffer automático
3. **Sistema de tokens** — tokens ganhos por consistência, gastos para proteger o streak
4. **Vidas/corações** — estilo Duolingo, com moeda virtual e possibilidade de compra

## Decisão

Implementar um **sistema de tokens** simples baseado em consistência:

**Ganhar tokens:**
- 1 token a cada 3 dias de streak perfeito (`current_streak % 3 === 0`)
- Máximo acumulado: 5 tokens
- Armazenado em `users.tokens` (inteiro no Supabase)

**Gastar tokens — automático (perder uma partida):**
- Se o jogador perde (6 tentativas sem acertar) E tem tokens disponíveis, 1 token é descontado automaticamente e o streak é preservado
- O campo `streakSaved: true` é retornado na resposta de `/api/game/attempt`
- O jogador é notificado na tela de resultado

**Gastar tokens — manual (dia pulado):**
- Se `last_played_at` for D-2 ou mais antigo (gap de 1+ dia sem jogar), o streak seria zerado
- Ao abrir o jogo nesse cenário, se o jogador tiver tokens, aparece um prompt perguntando se quer gastar 1 token para restaurar o streak antes de jogar
- Rota: `POST /api/game/restore-streak`

**Não gasta token:**
- Usar skip de timer durante a partida não gasta token (apenas reduz o score)

## Consequências

**Positivo:**
- Recompensa diretamente o comportamento desejado (consistência) com proteção para o momento de risco (perda de streak)
- Máximo de 5 tokens é simples de entender e balanceia proteção sem torná-la trivial
- Gasto automático ao perder é uma UX boa: o jogador não precisa se lembrar de ativar a proteção
- Não exige economia virtual complexa — sem preços, sem inflação, sem compras
- Fácil de explicar em uma frase: "Jogue 3 dias seguidos para ganhar um token que protege sua sequência"

**Negativo:**
- Jogadores novos (streak < 3) não têm tokens para se proteger — as primeiras perdas ainda são duras
- O gasto automático pode surpreender negativamente: o jogador perde, mas não vê o streak cair, e só depois percebe que gastou um token
- Máximo de 5 tokens significa que jogadores com streaks muito longos acumulam tokens mais rápido do que gastam — a proteção torna-se essencialmente ilimitada após certo ponto
- Requer campo adicional na tabela `users` e lógica distribuída entre múltiplos API routes (`attempt`, `start`, `restore-streak`)
- Não há forma de "comprar" tokens — se o jogador ficar sem tokens após múltiplas perdas seguidas, não há escape além de reconstruir o streak do zero
