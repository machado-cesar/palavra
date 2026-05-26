/**
 * Retorna a data atual no fuso de Brasília (UTC-3) no formato YYYY-MM-DD.
 * Usado em todos os lugares que consultam a palavra do dia, evitando o
 * descompasso entre a data UTC e o cron que roda às 03:00 UTC (meia-noite BRT).
 */
export function getTodayBRT(): string {
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
  return new Date(Date.now() - BRT_OFFSET_MS).toISOString().split('T')[0]
}
