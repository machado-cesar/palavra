import { LetterResult, LetterStatus } from '@/types'

/**
 * Compara a tentativa do jogador com a palavra correta.
 * Retorna um array com o status de cada letra.
 *
 * Regras (igual ao Wordle):
 * - 'correct': letra na posição certa (verde)
 * - 'present': letra existe na palavra mas na posição errada (amarelo)
 * - 'absent': letra não existe na palavra (cinza)
 */
export function evaluateAttempt(guess: string, answer: string): LetterResult[] {
  const result: LetterResult[] = Array(5).fill(null).map((_, i) => ({
    letter: guess[i],
    status: 'absent' as LetterStatus,
  }))

  const answerLetters = answer.split('')
  const guessLetters = guess.split('')

  // Primeira passagem: marcar corretas
  const remainingAnswer: (string | null)[] = [...answerLetters]
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i].status = 'correct'
      remainingAnswer[i] = null
    }
  }

  // Segunda passagem: marcar presentes
  for (let i = 0; i < 5; i++) {
    if (result[i].status === 'correct') continue
    const idx = remainingAnswer.indexOf(guessLetters[i])
    if (idx !== -1) {
      result[i].status = 'present'
      remainingAnswer[idx] = null
    }
  }

  return result
}

/**
 * Normaliza uma palavra: remove acentos, converte para maiúsculas.
 */
export function normalizeWord(word: string): string {
  return word
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Valida se uma string pode ser uma tentativa válida.
 */
export function isValidGuess(word: string): boolean {
  return word.length === 5 && /^[A-Za-zÀ-ÿ]+$/.test(word)
}
