import { SCORING } from '@/types'

/**
 * Penalidade por uma tentativa errada.
 * 1º erro: -100 pts. Erros seguintes: -200 pts.
 */
export function getPenalty(wrongAttemptsBefore: number): number {
  return wrongAttemptsBefore === 0 ? SCORING.PENALTY_FIRST_WRONG : SCORING.PENALTY_PER_WRONG
}

/**
 * Calcula os pontos recuperados com base no tempo decorrido desde recoveryStartedAt.
 * Máximo de RECOVERY_DURATION segundos → MAX_RECOVERY pontos.
 */
export function getRecoveredPoints(recoveryStartedAt: string): number {
  const elapsedMs = Date.now() - new Date(recoveryStartedAt).getTime()
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  return Math.min(elapsedSeconds, SCORING.RECOVERY_DURATION)
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
