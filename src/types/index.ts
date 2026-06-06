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

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

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
  correctWord?: string
  tokenEarned?: boolean
  streakCanBeSaved?: boolean
  prevStreak?: number
  tokens?: number
  recoveryStartedAt?: string  // timestamp para o cliente animar o recovery
}

export interface SkipResponse {
  success: boolean
  penaltyApplied: number
  newMaxScore: number
}

// ─── Pontuação ────────────────────────────────────────────────────────────────

export const SCORING = {
  MAX_SCORE: 1500,
  MAX_ATTEMPTS: 6,
  PENALTY_FIRST_WRONG: 100,   // -100 pts na 1ª tentativa errada
  PENALTY_PER_WRONG: 200,     // -200 pts nas tentativas erradas seguintes
  RECOVERY_DURATION: 100,     // segundos para recuperação máxima
  MAX_RECOVERY: 100,          // pts máximos recuperáveis por espera
} as const
