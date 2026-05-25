# ADR 0001 — Autenticação Anônima

**Data:** 2025-11-01
**Status:** Aceito

## Contexto

char[5] é um jogo casual avaliado por acessos diários. O objetivo de design é reduzir ao máximo a fricção de entrada: qualquer pessoa que abre o link deve poder jogar imediatamente, sem criar conta, sem escolher senha, sem confirmar e-mail.

Ao mesmo tempo, o jogo precisa de identidade persistente para:
- Salvar streak e histórico entre sessões
- Associar pontuações ao ranking
- Exibir apelido no leaderboard

As alternativas consideradas foram:

1. **Sem autenticação** — estado apenas no localStorage do navegador
2. **Login tradicional** — e-mail + senha ou OAuth (Google, GitHub)
3. **Autenticação anônima** (Supabase) — sessão criada automaticamente, sem credenciais

## Decisão

Usar **`supabase.auth.signInAnonymously()`** para criar uma sessão anônima automaticamente na primeira visita do usuário.

O Supabase cria um usuário real em `auth.users` com UUID próprio, e um trigger `on_auth_user_created` cria a linha correspondente em `public.users`. A partir daí, toda a lógica de jogo usa esse UUID como identificador persistente.

O apelido (username) é opcional e coletado após a primeira partida via `UsernameModal`. Um username padrão é gerado automaticamente no trigger (`jogador_XXXX`) para não bloquear o ranking.

## Consequências

**Positivo:**
- Zero fricção de entrada — o jogo funciona imediatamente ao abrir a URL
- Identidade persistente real no banco (UUID, não apenas localStorage)
- Row Level Security do Supabase funciona normalmente — cada usuário vê e edita apenas seus dados
- Permite upgrade futuro para conta com e-mail sem perder histórico (Supabase suporta `linkIdentity`)

**Negativo:**
- Usuário perde o acesso ao histórico se trocar de dispositivo ou limpar o browser (sem forma de "entrar na conta")
- Sessão anônima pode expirar se o Supabase estiver configurado com JWT curto — verificar configuração de `JWT expiry`
- Se o trigger `on_auth_user_created` falhar (bug ou instabilidade), o usuário tem auth mas não tem perfil, quebrando todo o fluxo do jogo
- Não é possível enviar e-mails de reengajamento para usuários anônimos
