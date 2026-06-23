import { Redis } from '@upstash/redis'

export const redis = Redis.fromEnv()

// ─── Chaves ───────────────────────────────────────────────────────────────────

export const keys = {
  session: (userId: string) => `session:active:${userId}`,
  freeSession: (userId: string) => `session:free:${userId}`,
  rankingDaily: (date: string) => `ranking:daily:${date}`,
  rankingIncansavel: (date: string) => `ranking:incansavel:${date}`,
  rankingWeekly: (week: string) => `ranking:weekly:${week}`,
  rankingAllTime: () => `ranking:alltime`,
  dailyFrase: (date: string) => `daily_frase:${date}`,
}

// ─── Sessão ativa ─────────────────────────────────────────────────────────────

export interface ActiveSession {
  sessionId: string
  wordId: string
  attemptsCount: number
  currentMaxScore: number
  wrongAttempts: number
  startedAt: string
  recoveryStartedAt?: string  // timestamp do início da recuperação após erro
}

export async function setActiveSession(userId: string, data: ActiveSession): Promise<void> {
  await redis.set(keys.session(userId), JSON.stringify(data), { ex: 86400 })
}

export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  const data = await redis.get<string>(keys.session(userId))
  if (!data) return null
  return typeof data === 'string' ? JSON.parse(data) : data
}

export async function clearActiveSession(userId: string): Promise<void> {
  await redis.del(keys.session(userId))
}

// ─── Sessão incansável ────────────────────────────────────────────────────────

// Mesma TTL do modo diário — wordsWon e recentWordIds persistem o dia todo
const FREE_SESSION_TTL = 86400

export interface FreeSession {
  // Estatísticas do dia (persistem entre partidas)
  wordsWon: number
  recentWordIds: string[]   // últimas 10 palavras jogadas — evita repetição

  // Estado da partida atual
  wordId: string
  word: string              // palavra normalizada — evita lookup no banco
  attemptsCount: number
  wrongAttempts: number
  gameActive: boolean       // false quando entre partidas (aguardando "jogar de novo")
  startedAt: string
}

export async function setFreeSession(userId: string, data: FreeSession): Promise<void> {
  await redis.set(keys.freeSession(userId), JSON.stringify(data), { ex: FREE_SESSION_TTL })
}

export async function getFreeSession(userId: string): Promise<FreeSession | null> {
  const data = await redis.get<string>(keys.freeSession(userId))
  if (!data) return null
  return typeof data === 'string' ? JSON.parse(data) : data
}

export async function clearFreeSession(userId: string): Promise<void> {
  await redis.del(keys.freeSession(userId))
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export function getTodayKey(): string {
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
  return new Date(Date.now() - BRT_OFFSET_MS).toISOString().split('T')[0]
}

export function getWeekKey(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export async function updateRanking(userId: string, score: number): Promise<void> {
  const today = getTodayKey()
  const week = getWeekKey()

  await Promise.all([
    redis.zadd(keys.rankingDaily(today), { score, member: userId }),
    redis.zadd(keys.rankingWeekly(week), { score, member: userId }),
    redis.zadd(keys.rankingAllTime(), { score, member: userId }),
  ])

  await redis.expire(keys.rankingDaily(today), 7 * 86400)
}

export async function getRanking(
  type: 'daily' | 'weekly' | 'alltime',
  limit = 10
): Promise<Array<{ userId: string; score: number }>> {
  let key: string
  if (type === 'daily') key = keys.rankingDaily(getTodayKey())
  else if (type === 'weekly') key = keys.rankingWeekly(getWeekKey())
  else key = keys.rankingAllTime()

  const results = await redis.zrange(key, 0, limit - 1, {
    rev: true,
    withScores: true,
  })

  const entries: Array<{ userId: string; score: number }> = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      userId: results[i] as string,
      score: Number(results[i + 1]),
    })
  }
  return entries
}

/**
 * Atualiza o ranking do modo incansável (palavras ganhas no dia).
 * Usa ZADD com o maior score — nunca reduz a contagem de um usuário.
 */
export async function updateIncansavelRanking(userId: string, wordsWon: number): Promise<void> {
  const today = getTodayKey()
  const key = keys.rankingIncansavel(today)
  await redis.zadd(key, { score: wordsWon, member: userId })
  await redis.expire(key, 7 * 86400)
}

export async function getIncansavelRanking(
  limit = 10
): Promise<Array<{ userId: string; wordsWon: number }>> {
  const key = keys.rankingIncansavel(getTodayKey())
  const results = await redis.zrange(key, 0, limit - 1, { rev: true, withScores: true })

  const entries: Array<{ userId: string; wordsWon: number }> = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({ userId: results[i] as string, wordsWon: Number(results[i + 1]) })
  }
  return entries
}

// ─── Frase do dia ─────────────────────────────────────────────────────────────

import type { DailyFrase } from './anthropic'

export async function setDailyFrase(date: string, frase: DailyFrase): Promise<void> {
  await redis.set(keys.dailyFrase(date), JSON.stringify(frase), { ex: 3 * 86400 })
}

export async function getDailyFrase(date: string): Promise<DailyFrase | null> {
  const data = await redis.get<string>(keys.dailyFrase(date))
  if (!data) return null
  return typeof data === 'string' ? JSON.parse(data) : data
}

export async function getUserRank(
  userId: string,
  type: 'daily' | 'weekly' | 'alltime'
): Promise<number | null> {
  let key: string
  if (type === 'daily') key = keys.rankingDaily(getTodayKey())
  else if (type === 'weekly') key = keys.rankingWeekly(getWeekKey())
  else key = keys.rankingAllTime()

  const rank = await redis.zrevrank(key, userId)
  return rank !== null ? rank + 1 : null
}
