# ADR 0007 — Medição de Efetividade: Grupos de Ranking Personalizado

**Data:** 2026-06-27
**Status:** Aceito

## Contexto

A ação de ranking por grupos (sprint Aula 7–8) introduz competição social como mecanismo de retenção. A hipótese central é:

> Usuários que pertencem a um grupo privado têm maior taxa de retorno diária (`session_return`) do que usuários sem grupo, porque a comparação com conhecidos cria um incentivo extrínseco para voltar todo dia.

Este ADR define os eventos GA4, a user property e os critérios de sucesso que permitem validar ou refutar essa hipótese com dados.

## Funil de adoção (eventos GA4)

Cada evento representa uma etapa de engajamento com a feature.

| Evento | Quando dispara | O que mede |
|---|---|---|
| `group_page_opened` | Usuário abre `/grupos` | Descoberta — quantos chegam à feature |
| `group_created` | Usuário cria um grupo | Ativação — intenção de liderar |
| `group_link_copied` | Usuário copia o link de convite | Intenção de compartilhar |
| `group_joined` | Usuário entra num grupo via código | Ativação via convite — crescimento viral |
| `group_ranking_opened` | Usuário abre `/grupos/[code]` | Engajamento recorrente com o ranking |

## User property: `in_group`

Quando um usuário cria ou entra em qualquer grupo, definimos a user property no GA4:

```js
window.gtag?.('set', 'user_properties', { in_group: 'true' })
```

Isso é persistente na sessão GA4 do usuário e permite **segmentar qualquer métrica existente** (incluindo `session_return`, `game_complete`, `attempt_made`) por pertencimento a grupo — sem criar novos eventos de retenção.

## Métricas de sucesso

### 1. Adoção da feature
- **Taxa de ativação** = (`group_created` + `group_joined`) / `group_page_opened`
- Meta mínima: > 30% (quem chega na página cria ou entra em algum grupo)

### 2. Coeficiente viral
- **K = `group_joined` / `group_created`**
- K < 1: grupos criados não estão sendo compartilhados — problema de UX ou timing do compartilhamento
- K ≥ 2: cada grupo criado traz em média 2+ novos membros — crescimento saudável

### 3. Engajamento com o ranking
- Frequência de `group_ranking_opened` por usuário por semana
- Meta: usuários em grupo abrem o ranking do grupo pelo menos 3x por semana

### 4. Impacto na retenção (métrica principal)
- No GA4 Explorar → Segmentos: criar segmento `in_group = true` vs. sem propriedade
- Comparar `session_return` (eventos únicos por usuário) entre os dois segmentos ao longo de 2 semanas
- Meta: usuários em grupo com taxa de `session_return` ≥ 20 p.p. maior que usuários sem grupo

## Decisões de implementação decorrentes

- `group_link_copied` deve disparar **no momento da cópia**, não do carregamento da página — mede intenção real, não apenas visualização
- A user property `in_group` deve ser definida uma única vez (na criação/entrada) e não precisa ser redefinida a cada sessão — o GA4 persiste a última propriedade associada ao `client_id`
- `group_ranking_opened` deve disparar a cada visita à página (não apenas na primeira) — o engajamento recorrente é o sinal mais valioso

## Alternativas consideradas e descartadas

**Criar evento `group_retention_session`** (disparar `session_return` com parâmetro `source=group`): descartado porque modificaria a série histórica do `session_return` e dificultaria comparações com períodos anteriores.

**Medir via Supabase diretamente** (query cruzando `group_members` com `game_sessions` por data): válido para análises pontuais, mas não substitui o GA4 para monitoramento contínuo no contexto do curso.
