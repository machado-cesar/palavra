import Anthropic from '@anthropic-ai/sdk'
import type { DailyFrase } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateDailyFrase(word: string): Promise<DailyFrase> {
  // Prompt completo (temporariamente desabilitado — usando apenas improvisado):
  // const promptCompleto = `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".
  //
  // Gere uma frase curta para exibir ao jogador após ele descobrir a palavra. Siga esta ordem de prioridade:
  //
  // 1. Se existir um ditado popular brasileiro real que contenha a palavra "${word}" (ou variação próxima como plural ou conjugação), use-o. Retorne o ditado completo e uma explicação de até 15 palavras do seu significado.
  //
  // 2. Se não houver ditado popular adequado, retorne uma curiosidade etimológica genuína e interessante sobre a palavra, em até 30 palavras.
  //
  // 3. Se nenhuma das opções acima for satisfatória ou natural, invente um ditado nonsense no estilo dos ditados populares brasileiros — deve soar como um ditado real em estrutura e ritmo, mas não fazer sentido algum. Seja criativo e engraçado.
  //
  // Responda APENAS com JSON válido, sem markdown, sem explicação extra:
  // { "tipo": "ditado" | "etimologia" | "improvisado", "texto": "...", "explicacao": "..." }
  // O campo "explicacao" só deve aparecer quando tipo for "ditado". Para "etimologia" e "improvisado", omita o campo.`

  const prompt = `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".

Invente um ditado nonsense no estilo dos ditados populares brasileiros usando a palavra "${word}". Deve soar como um ditado real em estrutura e ritmo, mas não fazer sentido algum. Seja criativo e engraçado.

Responda APENAS com JSON válido, sem markdown, sem explicação extra:
{
  "tipo": "improvisado",
  "texto": "..."
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  try {
    const parsed = JSON.parse(raw) as DailyFrase
    if (!parsed.tipo || !parsed.texto) throw new Error('Campos obrigatórios ausentes')
    return parsed
  } catch {
    console.error('[anthropic] Resposta inesperada:', raw)
    // Fallback seguro
    return {
      tipo: 'improvisado',
      texto: `Quem conhece ${word} não precisa de mapa, mas também não chega a lugar nenhum.`,
    }
  }
}
