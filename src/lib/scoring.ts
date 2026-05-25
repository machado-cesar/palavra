import { SCORING } from '@/types'

/**
 * Calcula a pontuação máxima disponível com base nos erros acumulados.
 * 0 erros → 1500, 1 erro → 1300, 2 erros → 1100, ..., 5 erros → 500
 */
export function getMaxScoreForAttempt(wrongAttempts: number): number {
  return Math.max(SCORING.MAX_SCORE - wrongAttempts * SCORING.PENALTY_PER_WRONG, 0)
}

/**
 * Calcula a pontuação final ao acertar, descontando erros e skips acumulados.
 */
export function calculateFinalScore(wrongAttempts: number, skips: number): number {
  const base = getMaxScoreForAttempt(wrongAttempts)
  const skipPenalty = skips * SCORING.PENALTY_PER_SKIP
  return Math.max(base - skipPenalty, SCORING.MIN_SCORE)
}

/**
 * Verifica se o timer deve ser ativado após uma tentativa errada.
 * O timer ativa a partir da 2ª tentativa errada.
 */
export function shouldActivateTimer(wrongAttempts: number): boolean {
  return wrongAttempts >= SCORING.ATTEMPTS_BEFORE_TIMER + 1
}

/**
 * Verifica se o jogo acabou (sem mais tentativas).
 */
export function isGameOver(totalAttempts: number): boolean {
  return totalAttempts >= SCORING.MAX_ATTEMPTS
}

/**
 * Retorna a porcentagem da pontuação atual em relação ao máximo.
 */
export function getScorePercentage(currentMaxScore: number): number {
  return Math.round((currentMaxScore / SCORING.MAX_SCORE) * 100)
}

/**
 * Retorna a cor da barra de pontuação com base na porcentagem.
 */
export function getScoreBarColor(percentage: number): string {
  if (percentage > 66) return '#22c55e'  // verde
  if (percentage > 33) return '#eab308'  // amarelo
  return '#ef4444'                        // vermelho
}
