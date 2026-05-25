import { Redis } from '@upstash/redis'
import { SCORING } from '@/types'

export const redis = Redis.fromEnv()

// ─── Chaves ───────────────────────────────────────────────────────────────────

export const keys = {
  timer: (userId: string) => `timer:${userId}`,
  session: (userId: string) => `session:active:${userId}`,
  rankingDaily: (date: string) => `ranking:daily:${date}`,
  rankingWeekly: (week: string) => `ranking:weekly:${week}`,
  rankingAllTime: () => `ranking:alltime`,
}

// ─── Timer ────────────────────────────────────────────────────────────────────

export async function setTimer(userId: string): Promise<string> {
  const seconds = SCORING.TIMER_MINUTES * 60
  const endsAt = new Date(Date.now() + seconds * 1000).toISOString()
  await redis.set(keys.timer(userId), endsAt, { ex: seconds })
  return endsAt
}

export async function getTimer(userId: string): Promise<string | null> {
  return redis.get<string>(keys.timer(userId))
}

export async function clearTimer(userId: string): Promise<void> {
  await redis.del(keys.timer(userId))
}

// ─── Sessão ativa ─────────────────────────────────────────────────────────────

export interface ActiveSession {
  sessionId: string
  wordId: string
  attemptsCount: number
  currentMaxScore: number
  wrongAttempts: number
  startedAt: string
}

export async function setActiveSession(userId: string, data: ActiveSession): Promise<void> {
  // Expira em 24h — sessão dura no máximo um dia
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

// ─── Ranking ──────────────────────────────────────────────────────────────────

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]  // YYYY-MM-DD
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

  // Expira rankings diários após 7 dias
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
