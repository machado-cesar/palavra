// ─── Letras e tentativas ──────────────────────────────────────────────────────

export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty'

export interface LetterResult {
  letter: string
  status: LetterStatus
}

export interface Attempt {
  word: string
  result: LetterResult[]
  timestamp: string
}

// ─── Sessão de jogo ───────────────────────────────────────────────────────────

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'waiting_timer'

export interface GameSession {
  id: string
  userId: string
  wordId: string
  startedAt: string
  completedAt?: string
  score: number
  maxPossibleScore: number
  timerSkips: number
  tokenUsed: boolean
  won?: boolean
  attempts: Attempt[]
}

export interface GameState {
  status: GameStatus
  session: GameSession | null
  currentAttempt: string
  timerEndsAt: string | null  // ISO string — quando o timer expira
  attempts: Attempt[]
  keyboardState: Record<string, LetterStatus>
}

// ─── Usuário ──────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email?: string
  username: string
  avatarUrl?: string
  createdAt: string
  totalScore: number
  currentStreak: number
  maxStreak: number
  tokens: number
  lastPlayedAt?: string
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string
  username: string
  score: number
  rank: number
}

export interface LeaderboardData {
  entries: LeaderboardEntry[]
  myPosition?: LeaderboardEntry
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface GameStatusResponse {
  canPlay: boolean
  timerEndsAt: string | null   // null = sem timer ativo
  currentSession: GameSession | null
}

export interface AttemptResponse {
  result: LetterResult[]
  score: number
  won: boolean
  gameOver: boolean
  timerEndsAt: string | null
  correctWord?: string   // revelada apenas quando gameOver && !won
  streakSaved?: boolean  // token foi gasto automaticamente para preservar o streak
  tokenEarned?: boolean  // ganhou um token novo nesse jogo (streak múltiplo de 3)
}

export interface SkipResponse {
  success: boolean
  penaltyApplied: number
  newMaxScore: number
}

// ─── Pontuação ────────────────────────────────────────────────────────────────

export const SCORING = {
  MAX_SCORE: 1500,
  ATTEMPTS_BEFORE_TIMER: 1,   // timer ativa após a 2ª tentativa errada (índice 1)
  MAX_ATTEMPTS: 6,
  PENALTY_PER_WRONG: 200,     // -200 pts por tentativa errada
  PENALTY_PER_SKIP: 100,      // -100 pts por pular o timer
  MIN_SCORE: 100,             // pontuação mínima ao acertar
} as const

// Timer progressivo por número de skips já realizados
// 0 skips → 2min, 1 skip → 5min, 2 skips → 10min, 3+ skips → 30min
export function getTimerMinutes(skips: number): number {
  if (skips === 0) return 2
  if (skips === 1) return 5
  if (skips === 2) return 10
  return 30
}
