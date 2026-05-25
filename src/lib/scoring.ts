import { SCORING } from '@/types'

/**
 * Calcula a pontuação máxima disponível para uma determinada tentativa.
 * Tentativa 1 → 1200, Tentativa 2 → 1000, ..., Tentativa 6 → 200
 */
export function getMaxScoreForAttempt(attemptNumber: number): number {
  const penalty = (attemptNumber - 1) * SCORING.PENALTY_PER_WRONG
  return Math.max(SCORING.MAX_SCORE - penalty, 0)
}

/**
 * Calcula a pontuação final após acertar, descontando penalidades de skips.
 */
export function calculateFinalScore(attemptNumber: number, skips: number): number {
  const base = getMaxScoreForAttempt(attemptNumber)
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
 * Usado para a barra de pontuação visual.
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
