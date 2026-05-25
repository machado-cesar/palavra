# ADR 0004 — Normalização Sem Diacríticos

**Data:** 2025-11-01
**Status:** Aceito

## Contexto

O português brasileiro usa extensivamente diacríticos: acentos agudos, circunflexos, graves, til e cedilha (á, â, ã, é, ê, í, ó, ô, õ, ú, ç). Uma palavra de 5 letras em português pode ter múltiplas formas: BRAÇO, AÇÃO, FÊNIX, CÔNJUGE (cortada).

O Wordle original foi projetado para o inglês, onde não há diacríticos. Adaptar para o português exige uma decisão sobre como lidar com acentuação no banco de palavras, na entrada do usuário e nas comparações.

As alternativas foram:

1. **Manter diacríticos** — palavras como BRAÇO no banco; teclado com letras acentuadas
2. **Normalizar tudo** — banco sem diacríticos (BRACO), comparações normalizadas; teclado padrão QWERTY

## Decisão

Armazenar **todas as palavras sem diacríticos** no banco de dados e normalizar a entrada do usuário antes de qualquer comparação.

A normalização usa decomposição Unicode NFD para separar letra base do diacrítico, seguida de remoção dos caracteres de combinação (categoria Mn):

```typescript
// src/lib/words.ts
export function normalizeWord(word: string): string {
  return word
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove diacríticos
}

// Exemplos:
// normalizeWord('braço') → 'BRACO'
// normalizeWord('AÇÃO')  → 'ACAO'
// normalizeWord('fênix') → 'FENIX'
```

**Regra obrigatória:** `normalizeWord()` deve ser aplicado **tanto no guess do usuário quanto na palavra do banco** antes de comparar. Nunca comparar strings diretamente.

O banco de palavras (`supabase/seeds/words.sql`) contém apenas formas normalizadas. A coluna `words.word` é `char(5)` — sempre 5 letras, maiúsculas, sem acentos.

## Consequências

**Positivo:**
- Teclado virtual mais simples: 26 letras do alfabeto padrão, sem teclas especiais para acentos
- Banco de dados mais simples: sem variações de uma mesma palavra
- Comparações de string são diretas após normalização
- Evita ambiguidade: BRAÇO e BRACO são tratados como a mesma palavra
- Seed de palavras mais fácil de manter e revisar

**Negativo:**
- Perde a riqueza do português: palavras com acento são "simplificadas" visualmente
- Um jogador que digita "CARRO" e a palavra é "CARRO" funciona, mas a palavra exibida no resultado sempre aparece sem acento — pode parecer erro na interface se não for comunicado
- Palavras que diferem apenas pelo acento (ex: "PARA" vs "PARÁ") são tratadas como iguais — não é possível usar as duas no banco sem ambiguidade
- Decisão difícil de reverter: mudar para banco com diacríticos exigiria migrar todo o seed e repensar o teclado
