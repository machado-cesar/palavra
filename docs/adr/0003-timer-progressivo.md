# ADR 0003 — Timer Progressivo por Número de Erros

**Data:** 2025-11-01
**Status:** Aceito

## Contexto

O diferencial central de char[5] em relação ao Wordle original é a **mecânica de retenção por atrito controlado**: o jogo não termina rápido, o que aumenta o tempo de sessão e reforça o hábito de voltar no dia seguinte.

A pergunta de design foi: como punir erros sem tornar o jogo frustrante?

Alternativas consideradas:

1. **Sem timer** — idêntico ao Wordle; pouca diferenciação
2. **Timer fixo** — mesmo tempo de espera independente do número de erros (ex: sempre 5 minutos)
3. **Timer progressivo** — tempo de espera aumenta conforme erros acumulados
4. **Bloqueio total** — após N erros, o jogo só libera no dia seguinte

## Decisão

Implementar um **timer progressivo** que cresce com o número de erros acumulados na partida atual.

```
wrongAttempts = 2  →  2 minutos
wrongAttempts = 3  →  5 minutos
wrongAttempts = 4  → 10 minutos
wrongAttempts = 5+ → 30 minutos
```

O timer só ativa a partir da **2ª tentativa errada** (índice 1), não após o primeiro erro. Isso preserva a fluidez nas primeiras tentativas e concentra o atrito nos momentos de maior dificuldade.

A lógica está centralizada em `getTimerMinutes(wrongAttempts: number)` em `src/types/index.ts`, tornando fácil ajustar os valores sem alterar a lógica dos routes.

O jogador pode pular o timer a qualquer momento com uma penalidade de -100 pontos no score final.

## Consequências

**Positivo:**
- Cria tensão crescente: quanto mais você erra, mais o jogo "respira"
- O timer de 2 minutos é leve o suficiente para não frustrar nas primeiras penalizações
- O timer de 30 minutos em 5 erros é um sinal claro de que a partida está perdida, incentivando o skip
- A opção de skip com penalidade dá ao jogador agência: pode escolher entre esperar (preservar score) ou pagar para continuar
- Aumenta o tempo médio de sessão (engajamento)

**Negativo:**
- Usuários casuais podem abandonar o jogo ao encontrar um timer de 10+ minutos pela primeira vez
- O timer de 30 minutos é punitivo o suficiente para gerar feedback negativo se os valores forem percebidos como injustos
- Requer estado de `wrongAttempts` persistido no servidor (Redis) — não pode ser calculado apenas no cliente, senão seria burlável
- A UX de "aguardar" vai contra convenções de jogos mobile modernos — precisa ser comunicada claramente na interface
