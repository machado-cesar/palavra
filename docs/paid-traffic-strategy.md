# Estratégia de Tráfego Pago — char[5]

## Contexto

- **Produto:** char[5] (char5.com.br) — Wordle em português, gratuito, sem app
- **Objetivo da campanha:** crescer base de jogadores ativos, com budget pequeno (~R$ 100–200)
- **Objetivo de aprendizado:** medir CPC, taxa de conversão e impacto em DAU
- **Plataformas:** Meta Ads (principal) + Google Ads (secundário)

---

## Funil de conversão

```
Impressão → Clique → /game carrega → Jogo iniciado (ViewContent) → Jogo concluído (game_complete) → Username salvo (Lead)
```

Eventos rastreados automaticamente após o deploy:

| Evento            | Plataforma  | Quando dispara                              |
|-------------------|-------------|----------------------------------------------|
| `PageView`        | Meta Pixel  | Toda pageview (automático pelo Pixel)        |
| `ViewContent`     | Meta Pixel  | Usuário inicia o jogo com sucesso            |
| `game_complete`   | Meta Pixel  | **Jogo concluído (vitória ou derrota)** ← conversão principal |
| `Lead`            | Meta Pixel  | Usuário salva um apelido (1ª identidade)     |
| `game_started`    | GA4         | Mesmo momento que ViewContent                |
| `attempt_made`    | GA4         | Cada tentativa                               |
| `game_complete`   | GA4         | Jogo concluído — importar como conversão no Google Ads |

---

## Meta Ads

### Setup técnico

1. Criar Pixel em **Meta Business Suite → Events Manager → Conectar fontes de dados → Web**
2. Copiar o Pixel ID gerado
3. Adicionar no Vercel: `NEXT_PUBLIC_META_PIXEL_ID=<seu_pixel_id>`
4. Verificar o domínio char5.com.br em **Business Settings → Brand Safety → Domains**
5. Instalar a extensão **Meta Pixel Helper** no Chrome e acessar char5.com.br para confirmar que `PageView`, `ViewContent` e `Lead` disparam corretamente

### Estrutura de campanha

```
Campanha: char5 — Awareness PT-BR
  Objetivo: Tráfego (otimizar para cliques no link)
  Budget diário: R$ 10–15

  Conjunto de anúncios A — Interesses diretos
    País: Brasil
    Idade: 22–45
    Interesses: Wordle, Palavras Cruzadas, Termo (jogo), Jogos de palavras
    Placement: Feed Instagram, Stories Instagram, Feed Facebook

  Conjunto de anúncios B — Lookalike (ativar após 50+ eventos Lead)
    Público semelhante 1% baseado em quem disparou Lead
    (criar depois de acumular dados do Pixel)
```

### Criativos

#### Anúncio 1 — Imagem estática (grid colorido)

**Visual:** screenshot do grid com tiles coloridos resolvendo uma palavra.  
Capture uma partida real com uma palavra bonita. O grid já é o criativo.

**Headline:** Você consegue adivinhar a palavra do dia?  
**Texto principal:**  
```
Uma palavra de 5 letras. 6 tentativas. Um novo desafio todo dia. 🟩🟨⬛

Jogue grátis, sem app, direto no navegador.
```
**CTA:** Saiba mais → char5.com.br/game?utm_source=meta&utm_medium=cpc&utm_campaign=awareness_jul26&utm_content=grid_img

---

#### Anúncio 2 — Curiosidade / hook emocional

**Visual:** imagem simples, fundo escuro, texto em destaque (cria no Canva).

**Headline:** Você sabe mais português do que pensa  
**Texto principal:**  
```
Teste seu vocabulário com o desafio de palavras do dia. 
Cada tentativa revela uma pista. Quantas você precisa?

Jogue uma vez e vai entender o vício. 🇧🇷
```
**CTA:** Jogar agora → char5.com.br/game?utm_source=meta&utm_medium=cpc&utm_campaign=awareness_jul26&utm_content=curiosidade

---

#### Anúncio 3 — Competição / ranking (ativar depois que grupos estiver rodando)

**Headline:** Seu grupo já está jogando. Você ainda não.  
**Texto principal:**  
```
char[5] tem ranking de grupos privados. Forme o seu, jogue todo dia e veja quem é o melhor.

Uma palavra nova por dia. Gratuito, sem app.
```
**CTA:** Criar meu grupo → char5.com.br/grupos?utm_source=meta&utm_medium=cpc&utm_campaign=grupos_jul26

---

## Google Ads

### Setup técnico

1. Criar conta em ads.google.com
2. **Importar conversões do GA4** em vez de criar tags separadas:  
   Google Ads → Ferramentas → Medição → Conversões → Importar → Google Analytics 4
3. Importar o evento `game_started` como conversão principal
4. Vincular a propriedade GA4 ao Google Ads (GA4 → Admin → Vinculações de produtos → Google Ads)

### Estrutura de campanha

```
Campanha: char5 — Search BR
  Tipo: Pesquisa (Search)
  Budget diário: R$ 5–10
  Lance: CPC manual (R$ 0,80–1,50) ou Maximizar cliques

  Grupo de anúncios 1 — Concorrentes / categoria
    Palavras-chave (correspondência de frase):
      "wordle português"
      "termo jogo de palavras"
      "jogo palavras 5 letras"
      "adivinhar palavra do dia"
    
  Grupo de anúncios 2 — Genérico
    "jogo de palavras online"
    "palavras cruzadas online"
    "jogo vocabulário português"
```

### Anúncio de pesquisa responsivo (RSA)

**Headlines (adicionar todos — o Google combina automaticamente):**
```
Adivinhe a Palavra do Dia
Jogo de Palavras em Português
6 Tentativas para Descobrir
O Wordle Brasileiro
Gratuito, Sem App
Desafio Novo Todo Dia
Teste Seu Vocabulário
```

**Descriptions:**
```
Uma palavra de 5 letras por dia. Jogue no navegador, sem cadastro. Tente agora!
Cada tentativa revela uma pista. Quanto mais cedo acertar, maior sua pontuação. Jogue grátis.
```

**URL final:** `https://char5.com.br/game?utm_source=google&utm_medium=cpc&utm_campaign=search_br_jul26`

---

## UTMs — padrão completo

| Parâmetro      | Meta Ads                      | Google Ads                    |
|----------------|-------------------------------|-------------------------------|
| `utm_source`   | `meta`                        | `google`                      |
| `utm_medium`   | `cpc`                         | `cpc`                         |
| `utm_campaign` | `awareness_jul26`             | `search_br_jul26`             |
| `utm_content`  | nome do criativo (`grid_img`) | grupo de anúncio              |

Ver resultados em GA4 → Aquisição → Aquisição de tráfego → filtrar por `Session source/medium`.

---

## Métricas e metas (para o curso)

| Métrica                           | Meta (budget ~R$ 150 total) |
|-----------------------------------|-----------------------------|
| CPM (Meta)                        | < R$ 15                     |
| CPC (Meta)                        | < R$ 1,50                   |
| Taxa ViewContent / Clique         | > 40%                       |
| Taxa Lead / ViewContent           | > 15%                       |
| Novos usuários (GA4, 7 dias)      | +50                         |
| DAU semana pós-campanha vs. antes | +20%                        |

---

## Checklist de ativação

- [ ] Criar Pixel no Meta Business Suite e copiar o ID
- [ ] Adicionar `NEXT_PUBLIC_META_PIXEL_ID` no Vercel e fazer redeploy
- [ ] Verificar domínio char5.com.br no Meta
- [ ] Confirmar eventos no Meta Pixel Helper (PageView, ViewContent, Lead)
- [ ] Criar campanha Meta com os 2 criativos (começar com Anúncio 1)
- [ ] Criar conta Google Ads e vincular GA4
- [ ] Criar campanha Search com RSA
- [ ] Aguardar 3–5 dias e analisar CPC, ViewContent rate e Lead rate
