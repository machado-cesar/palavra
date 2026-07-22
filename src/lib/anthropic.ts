import Anthropic from '@anthropic-ai/sdk'
import type { DailyFrase } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Tipo = 'ditado' | 'etimologia' | 'improvisado' | 'haiku'

const PROMPTS: Record<Tipo, (word: string) => string> = {
  ditado: (word) => `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".

Procure um ditado popular brasileiro real e conhecido que contenha a palavra "${word}" (ou variação próxima como plural, conjugação ou derivado). Ele deve ser genuinamente usado no Brasil.

Se existir um ditado adequado, retorne:
{ "tipo": "ditado", "texto": "..." }

Se NÃO existir nenhum ditado popular real e natural com essa palavra, retorne exatamente:
{ "tipo": "nenhum" }

Responda APENAS com JSON válido, sem markdown, sem explicação extra.`,

  improvisado: (word) => `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".

Invente um ditado nonsense no estilo dos ditados populares brasileiros usando a palavra "${word}". Deve soar como um ditado real em estrutura e ritmo, mas não fazer sentido algum. Seja criativo e engraçado.

Responda APENAS com JSON válido, sem markdown, sem explicação extra:
{ "tipo": "improvisado", "texto": "..." }`,

  etimologia: (word) => `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".

Compartilhe uma curiosidade etimológica genuína e interessante sobre a palavra "${word}" em português. Máximo de 30 palavras. Seja preciso — não invente origens.

Responda APENAS com JSON válido, sem markdown, sem explicação extra:
{ "tipo": "etimologia", "texto": "..." }`,

  haiku: (word) => `A palavra do dia em um jogo de palavras brasileiro é "${word.toUpperCase()}".

Escreva um haiku poético em português usando a palavra "${word}". Siga a estrutura tradicional: 5 sílabas / 7 sílabas / 5 sílabas. Seja evocativo e belo.

Responda APENAS com JSON válido, sem markdown, sem explicação extra. Use "\\n" para separar os versos:
{ "tipo": "haiku", "texto": "verso 1\\nverso 2\\nverso 3" }`,
}

const TIPOS: Tipo[] = ['ditado', 'improvisado', 'etimologia', 'haiku']

function sortear<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function chamarClaude(prompt: string): Promise<DailyFrase | null> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  try {
    const parsed = JSON.parse(raw) as DailyFrase & { tipo: string }
    if (parsed.tipo === 'nenhum') return null
    if (!parsed.tipo || !parsed.texto) throw new Error('Campos obrigatórios ausentes')
    return parsed as DailyFrase
  } catch {
    console.error('[anthropic] Resposta inesperada:', raw)
    return null
  }
}

export async function generateDailyFrase(word: string): Promise<DailyFrase> {
  const tipoSorteado = sortear(TIPOS)

  // Tenta o tipo sorteado
  const resultado = await chamarClaude(PROMPTS[tipoSorteado](word))

  // Se retornou null (ditado não encontrado ou falha de parse), sorteia entre as outras 3 opções
  if (!resultado) {
    const alternativas = TIPOS.filter(t => t !== tipoSorteado)
    const tipoAlternativo = sortear(alternativas)
    const resultadoAlternativo = await chamarClaude(PROMPTS[tipoAlternativo](word))

    if (resultadoAlternativo) return resultadoAlternativo
  }

  // Fallback seguro
  return resultado ?? {
    tipo: 'improvisado',
    texto: `Quem conhece ${word} não precisa de mapa, mas também não chega a lugar nenhum.`,
  }
}
