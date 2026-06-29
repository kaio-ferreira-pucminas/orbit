# 5. Implementação

<span style="color:red">Pré-requisitos: <a href="4-Planejamento-Projeto.md"> Planejamento do Projeto</a></span>

Esta seção apresenta a solução de fato implementada do projeto **Orbit**. Diferentemente da fase inicial (em que a aplicação era apenas um protótipo de front-end), a versão atual é uma **aplicação web full-stack**, com back-end próprio, autenticação, persistência de dados e diversas funcionalidades integradas.

---

## Tecnologias Utilizadas

A solução evoluiu de um protótipo estático para uma aplicação completa cliente-servidor, mantendo o front-end em tecnologias web puras e adicionando um back-end em Node.js.

### Front-end

| Tecnologia | Função |
|------------|--------|
| **HTML5** | Estruturação semântica das páginas |
| **CSS3** | Estilização, layout responsivo (Grid/Flexbox) e temas |
| **JavaScript (puro / Vanilla JS)** | Interatividade, consumo da API (fetch) e manipulação do DOM — sem frameworks |

### Back-end

| Tecnologia | Função |
|------------|--------|
| **Node.js** | Ambiente de execução do servidor |
| **Express** | Framework web — rotas, middlewares e arquivos estáticos |
| **json-server** | Camada de dados REST automática sobre o arquivo `db.json` |
| **jsonwebtoken (JWT)** | Autenticação stateless via token Bearer |
| **bcryptjs** | Hash seguro das senhas (não são armazenadas em texto puro) |
| **cors** | Controle de origens permitidas (CORS) |
| **resend** | Envio de e-mails transacionais (boas-vindas, recuperação de senha, etc.) |
| **dotenv** | Carregamento de variáveis de ambiente |

### Serviços e ferramentas externas

| Ferramenta | Função |
|------------|--------|
| **GitHub REST API + GraphQL** | Importação de repositórios e gráfico de contribuições do desenvolvedor |
| **Render** | Hospedagem da aplicação (deploy) |
| **Figma** | Wireframes e protótipo de interface |
| **Visual Studio Code** | Ambiente de desenvolvimento |
| **GitHub** | Versionamento de código e documentação |

---

## Arquitetura da Solução

A aplicação segue uma arquitetura **cliente-servidor em três camadas**:

```
┌──────────────┐    HTTP/HTTPS     ┌──────────────────────────┐     ┌───────────────────┐
│  Navegador   │  ───────────────► │  Servidor (Node/Express) │ ──► │   Persistência    │
│ HTML/CSS/JS  │  ◄─── JSON ────── │  API REST + json-server  │     │ db.json + /uploads│
└──────────────┘   (Bearer JWT)    └──────────────────────────┘     └───────────────────┘
```

1. **Camada de Apresentação (Front-end):** páginas HTML, estilos CSS e scripts JavaScript executados no navegador. Os scripts consomem a API via `fetch`, enviando o **token JWT** no cabeçalho `Authorization`.
2. **Camada de Aplicação (Back-end):** servidor Express que expõe uma **API REST**. As regras de negócio (autenticação, validações, propriedade dos dados, agregações) são tratadas em rotas customizadas; o CRUD simples cai no roteador automático do json-server.
3. **Camada de Dados:** os dados são persistidos no arquivo **`db.json`** e os arquivos enviados (avatares, capas, currículos) são salvos em disco na pasta **`/uploads`**, guardando-se apenas o caminho no banco.

A autenticação é feita por **JWT**: ao logar, o usuário recebe um token assinado (validade de 1 dia) que é exigido pelo middleware `requireAuth` nas rotas protegidas. As senhas são protegidas com **bcrypt**.

---

## Solução Implementada

### Funcionalidades

As funcionalidades a seguir estão organizadas por área. Para cada uma indicamos a **descrição**, a **estrutura de dados** associada (coleções do `db.json`) e as **instruções de acesso**.

#### Conta e Acesso

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Cadastro** | Registro de usuário como **Desenvolvedor** ou **Empresa**, com envio de e-mail de boas-vindas. | `users` | Página `auth.html` |
| **Login** | Autenticação por e-mail/senha; retorna o token JWT e reativa contas desativadas há menos de 30 dias. | `users` | Página `auth.html` |
| **Recuperação de senha** | Solicitação de redefinição por e-mail (token com validade de 1h) e troca de senha. | `password_reset_tokens` | `forgot-password.html` / `reset-password.html` |
| **Desativar conta** | Desativação com código de 6 dígitos enviado por e-mail (soft-delete de 30 dias, reversível por login). | `deactivation_codes`, `users` | "Zona de perigo" em `profile.html` |

#### Perfil

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Perfil do desenvolvedor** | Visualização/edição de avatar, headline, bio, habilidades, currículo (PDF), disponibilidade, experiências e interesses. | `users` | `profile.html` |
| **Perfil público do dev** | Página pública com skills, projetos, reputação, contribuições do GitHub e depoimentos de empresas. | `users`, `projects`, `engagementReviews` | `perfil-publico.html` |
| **Onboarding (completar perfil)** | Formulário em etapas para dev (skills, experiência, interesses) e para empresa (dados institucionais e cultura). | `users`, `companies` | `completar-perfil.html` / `completar-perfil-empresa.html` |
| **Perfil da empresa** | Página pública da empresa com cultura, estatísticas, vagas abertas e avaliações de profissionais. | `companies`, `jobs`, `engagementReviews` | `empresa-perfil.html` |

#### Projetos e GitHub

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Meus Projetos** | CRUD de projetos do portfólio (título, descrição, **capa**, tecnologias, repositório, URL publicada, status ativo/rascunho). | `projects` | `meus-projetos.html` |
| **Integração GitHub** | Importação dos repositórios públicos do dev como rascunho de projeto (dedup por repositório). | `projects`, `users` | Botão "Sincronizar GitHub" |
| **Contribuições do GitHub** | Mini-gráfico de contribuições (calendário de commits) no perfil do dev. | `users` | `profile.html` / `perfil-publico.html` |
| **Avaliação de projetos** | Outros usuários avaliam projetos com nota (1–5) e comentário. | `projectReviews`, `projects` | Modal do projeto no perfil público |

#### Feed e Q&A (Dúvidas e Respostas)

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Feed comunitário** | Publicação de posts com formatação **Markdown** (negrito, itálico, código, blocos de código, links) + curtir e comentar. | `posts`, `likes`, `comments` | `feed.html` |
| **Dúvidas (Q&A)** | Post do tipo "dúvida" (com título e status aberta/resolvida); a comunidade responde em uma aba separada de comentários. | `posts`, `answers` | Seletor "Dúvida" no editor do feed |
| **Avaliação de respostas** | Qualquer dev avalia uma resposta com **nota 1–5 + observação** e com o botão **"Útil"**; o autor da dúvida marca a **"Melhor resposta"**. | `answerRatings`, `answerHelpful`, `answers` | Aba "Respostas" da dúvida |
| **Reputação em respostas** | Nota média e contadores (respostas, melhores respostas, úteis) exibidos no perfil de quem responde. | `answers`, `answerRatings`, `answerHelpful` | `profile.html` / `perfil-publico.html` |
| **Tópicos em alta / Sugestões** | Tendências de tópicos e sugestões de quem seguir, com base no grafo social e nas habilidades. | `posts`, `users`, `follows` | Colunas laterais do `feed.html` |

#### Rede e Busca

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Seguir / Conexões** | Seguir outros usuários e listar conexões (seguindo / seguidores). | `follows` | Perfil público e sugestões |
| **Busca global** | Busca unificada por pessoas, empresas, vagas, posts e tópicos. | `users`, `companies`, `jobs`, `posts` | `busca.html` |
| **Busca de talentos (empresa)** | Painel da empresa para encontrar devs com filtros (skill, nível, disponibilidade). | `users` | `empresa-talentos.html` |

#### Vagas, Candidaturas, Contratação e Avaliação

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Vagas** | Listagem com filtros, detalhes da vaga e vagas similares; salvar vaga. | `jobs`, `saved_jobs` | `vagas.html` / `vaga-detalhes.html` |
| **Publicar vaga (empresa)** | Criação/edição de vaga (rascunho ou ativa), com requisitos, responsabilidades e benefícios. | `jobs` | `empresa-nova-vaga.html` / `empresa-vagas.html` |
| **Candidatura** | Dev se candidata a uma vaga ativa; a empresa é notificada. | `applications` | `vaga-detalhes.html` |
| **Gerenciar candidatos** | Funil de candidatos por vaga (enviada → em análise → entrevista → recusado). | `applications`, `users` | `empresa-candidatos.html` |
| **Ciclo de contratação** | Empresa contrata o candidato em modalidade **CLT** ou **freelance** (com data de fim); freelance é finalizado automaticamente ao vencer a data; permite renovar e encerrar. | `applications` | `empresa-candidatos.html` |
| **Avaliação mútua dev↔empresa** | Após o vínculo (CLT ativo ou freelance finalizado), dev avalia a empresa (ambiente, infraestrutura, organização, compromisso) e a empresa avalia o dev (técnica, comunicação, comprometimento, prazos) — por critérios 1–5. | `engagementReviews`, `companies`, `users` | `empresa-candidatos.html` / `empresa-perfil.html` |
| **Recomendações de vagas** | Vagas recomendadas ao dev com base em habilidades, interesses e comportamento. | `recommendations`, `jobs` | `oportunidades.html` |

#### Agenda, Entrevistas e Mensagens

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Agenda** | Calendário pessoal com tarefas, lembretes e entrevistas. | `tasks`, `reminders`, `interviews` | `agenda.html` |
| **Entrevistas** | Empresa agenda entrevista com o candidato; o dev recebe notificação e pode solicitar remarcação. | `interviews`, `applications` | `entrevistas.html` |
| **Mensagens (chat 1:1)** | Conversas privadas entre conexões, com indicador de leitura e presença online. | `conversations`, `messages` | `mensagens.html` |
| **Notificações** | Central de notificações (sino) para curtidas, comentários, respostas, candidaturas, entrevistas, mensagens, etc. | `notifications` | Componente de cabeçalho (todas as telas) |

#### Painéis (Dashboards)

| Funcionalidade | Descrição | Estrutura de dados | Acesso |
|----------------|-----------|--------------------|--------|
| **Dashboard do dev** | Resumo de candidaturas, força do perfil, projetos e oportunidades recomendadas. | `users`, `projects`, `jobs`, `applications` | `dashboard.html` |
| **Dashboard da empresa** | Resumo de vagas, candidatos no funil e entrevistas agendadas. | `jobs`, `applications`, `interviews` | `empresa-dashboard.html` |

---

### Estruturas de Dados

Os dados são armazenados em coleções no arquivo `db.json` (json-server). A seguir, as principais estruturas com descrição e um exemplo em JSON.

**`users`** — Usuários da plataforma (desenvolvedores e empresas).
```json
{
  "id": "a1b2c3d4-0001-4e5f-a6b7-c8d9e0f10001",
  "type": "dev",
  "name": "João Silva",
  "email": "joao@dev.com",
  "passwordHash": "$2a$10$...",
  "headline": "Full Stack Developer | React & Node.js",
  "bio": "Desenvolvedor apaixonado por produtos web.",
  "skills": ["React", "Node.js", "TypeScript"],
  "github": "joaosilva",
  "linkedin": "https://www.linkedin.com/in/joaosilva",
  "available": true,
  "avatarUrl": "/uploads/avatars/a1b2c3d4.webp",
  "createdAt": "2026-05-14T10:00:00.000Z"
}
```

**`companies`** — Perfil das empresas contratantes.
```json
{
  "id": "comp-stellar-001",
  "userId": "a1b2c3d4-0002-4e5f-a6b7-c8d9e0f10002",
  "name": "Stellar Tech",
  "tagline": "Construindo produtos SaaS que escalam",
  "industry": "Produtos SaaS",
  "location": "São Paulo, SP",
  "founded": 2018,
  "website": "https://stellartech.example.com",
  "rating": 4.8,
  "reviewsCount": 64,
  "logoInitials": "ST"
}
```

**`projects`** — Portfólio de projetos do desenvolvedor.
```json
{
  "id": "project-001",
  "userId": "a1b2c3d4-0001-4e5f-a6b7-c8d9e0f10001",
  "title": "Orbit Pay",
  "description": "Gateway de pagamentos para devs.",
  "technologies": ["React", "Node.js", "Stripe API"],
  "repoUrl": "https://github.com/joaosilva/orbit-pay",
  "liveUrl": "https://orbit-pay.example.com",
  "coverImage": "/uploads/covers/project-001.webp",
  "status": "ativo",
  "isPublic": true,
  "ratingAvg": 4.5,
  "ratingCount": 3
}
```

**`posts`** — Posts e dúvidas do feed.
```json
{
  "id": "8a457d1e-f7a7-4589-8036-dc6aa4477477",
  "userId": "a1b2c3d4-0001-4e5f-a6b7-c8d9e0f10001",
  "type": "duvida",
  "title": "Como centralizar uma div com flexbox?",
  "content": "Tentei usar **flexbox** mas não centraliza verticalmente.",
  "status": "aberta",
  "createdAt": "2026-06-08T12:00:00.000Z"
}
```

**`answers`** — Respostas a uma dúvida (Q&A).
```json
{
  "id": "43e55bd0-775c-41d4-872c-d4e6c8620a8e",
  "postId": "8a457d1e-f7a7-4589-8036-dc6aa4477477",
  "authorId": "415f7e24-1be3-4a8c-9cb7-507b06bf8418",
  "content": "Use `display:flex; justify-content:center; align-items:center;`",
  "isBest": true,
  "ratingAvg": 5,
  "ratingCount": 1,
  "createdAt": "2026-06-08T12:10:00.000Z"
}
```

**`answerRatings`** — Avaliação (1–5) das respostas pela comunidade.
```json
{
  "id": "r-001",
  "answerId": "43e55bd0-775c-41d4-872c-d4e6c8620a8e",
  "authorId": "a1b2c3d4-0001-4e5f-a6b7-c8d9e0f10001",
  "rating": 5,
  "comment": "Resolveu certinho, obrigado!",
  "createdAt": "2026-06-08T12:15:00.000Z"
}
```

**`answerHelpful`** — Marcação "Útil" das respostas (sinal da comunidade).
```json
{ "id": "h-001", "answerId": "43e55bd0-775c-41d4-872c-d4e6c8620a8e", "userId": "6793c39e-...", "createdAt": "2026-06-08T12:20:00.000Z" }
```

**`jobs`** — Vagas publicadas pelas empresas.
```json
{
  "id": "job-001",
  "companyId": "comp-stellar-001",
  "companyName": "Stellar Tech",
  "title": "Desenvolvedor(a) Front-end React",
  "level": "Júnior",
  "modality": "Remoto",
  "contractType": "CLT",
  "salaryRange": "R$ 3.500 - R$ 5.000",
  "skills": ["React", "JavaScript", "CSS"],
  "status": "active",
  "createdAt": "2026-05-15T09:00:00.000Z"
}
```

**`applications`** — Candidaturas e ciclo de contratação.
```json
{
  "id": "app-001",
  "userId": "b34e65c0-bdaf-4a80-9af2-2aa27dc6a3e6",
  "jobId": "job-001",
  "status": "contratado",
  "contractType": "freelance",
  "contractStart": "2026-06-01T00:00:00.000Z",
  "contractEnd": "2026-08-01T00:00:00.000Z",
  "hiredAt": "2026-06-01T00:00:00.000Z",
  "appliedAt": "2026-05-18T11:30:00.000Z"
}
```

**`engagementReviews`** — Avaliação mútua dev↔empresa por critérios.
```json
{
  "id": "er-001",
  "applicationId": "app-001",
  "jobId": "job-001",
  "authorId": "b34e65c0-bdaf-4a80-9af2-2aa27dc6a3e6",
  "authorType": "dev",
  "targetType": "company",
  "targetCompanyId": "comp-stellar-001",
  "criteria": { "ambiente": 5, "infraestrutura": 4, "organizacao": 5, "compromisso": 5 },
  "overall": 4.8,
  "comment": "Ótimo ambiente, equipe acolhedora.",
  "createdAt": "2026-08-02T10:00:00.000Z"
}
```

**`interviews`** — Entrevistas agendadas.
```json
{
  "id": "int-001",
  "applicationId": "app-001",
  "jobId": "job-001",
  "companyUserId": "a1b2c3d4-0002-...",
  "devUserId": "b34e65c0-...",
  "scheduledAt": "2026-06-20T14:00:00.000Z",
  "durationMin": 45,
  "mode": "online",
  "locationOrLink": "https://meet.example.com/abc",
  "status": "agendada"
}
```

**`conversations` / `messages`** — Chat privado.
```json
{ "id": "conv-001", "participantIds": ["b34e65c0-...", "a1b2c3d4-0002-..."], "lastMessageAt": "2026-05-18T10:05:00.000Z" }
```
```json
{ "id": "msg-001", "conversationId": "conv-001", "senderId": "a1b2c3d4-0002-...", "receiverId": "b34e65c0-...", "content": "Olá! Vimos seu portfólio.", "read": true, "createdAt": "2026-05-18T10:00:00.000Z" }
```

**`notifications`** — Notificações do sistema.
```json
{ "id": "notif-001", "userId": "b34e65c0-...", "type": "new_message", "message": "Você recebeu uma nova mensagem.", "refId": "conv-001", "read": false, "createdAt": "2026-05-18T10:00:30.000Z" }
```

**`follows`** — Relação de seguir entre usuários.
```json
{ "id": "follow-001", "followerId": "b34e65c0-...", "followingId": "a1b2c3d4-0001-...", "createdAt": "2026-05-10T09:00:00.000Z" }
```

> Outras coleções de apoio: **`comments`** e **`likes`** (interações de posts), **`projectReviews`** (avaliação de projetos), **`reviews`** (depoimentos de empresas — modelo legado), **`saved_jobs`** (vagas salvas), **`recommendations`** (recomendações de vagas), **`tasks`** e **`reminders`** (agenda), **`password_reset_tokens`** e **`deactivation_codes`** (segurança da conta) e **`sent_emails`** (auditoria de e-mails enviados).

---

### Módulos e APIs

#### Bibliotecas e módulos

| Módulo | Papel |
|--------|-------|
| **express** | Servidor web, rotas, middlewares e arquivos estáticos |
| **json-server** | CRUD REST automático sobre o `db.json` |
| **jsonwebtoken** | Geração e validação de tokens JWT |
| **bcryptjs** | Hash das senhas |
| **cors** | Política de origens permitidas |
| **resend** | Envio de e-mails transacionais |
| **dotenv** | Variáveis de ambiente (`.env`) |
| **crypto / fs / path** (nativos do Node) | Geração de IDs/tokens e gravação de `db.json` e uploads em disco |

#### APIs externas

- **GitHub REST API** — lista repositórios públicos do desenvolvedor para importação como projetos.
- **GitHub GraphQL API** — obtém o calendário de contribuições do usuário (com fallback para *scraping* do HTML público quando não há token).
- **Resend** — provedor de envio de e-mails (boas-vindas, recuperação de senha, desativação de conta, notificações de entrevista).

#### API REST interna (principais endpoints)

A autenticação é feita por **JWT** (cabeçalho `Authorization: Bearer <token>`); rotas marcadas com 🔒 exigem token.

**Autenticação**
- `POST /api/auth/register` — cadastro (dev ou empresa)
- `POST /api/auth/login` — login (retorna o token)
- `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` — recuperação de senha
- 🔒 `POST /api/auth/deactivate/request` · `/confirm` — desativação de conta

**Usuários e perfil** 🔒
- `GET /api/users/:id/profile` — perfil agregado (dados + projetos + avaliações + reputação Q&A)
- `PATCH /api/users/:id` — atualização do próprio perfil
- `GET /api/preferences/me` · `PUT /api/preferences/me` — preferências de vaga do dev

**Feed, Posts e Q&A** 🔒
- `GET /api/feed/me` · `GET /api/posts` · `POST /api/posts` · `DELETE /api/posts/:id`
- `POST /api/posts/:id/like` · `GET`/`POST /api/posts/:id/comments`
- `GET`/`POST /api/posts/:id/answers` · `DELETE /api/answers/:id`
- `POST /api/answers/:id/rating` · `/helpful` · `/best`

**Projetos e GitHub** 🔒
- `GET`/`POST /api/projects` · `PATCH`/`DELETE /api/projects/:id`
- `GET`/`POST /api/projects/:id/reviews`
- `GET /api/github/{repos,pages,contributions,projects}` · `POST /api/github/sync`

**Rede, Busca e Talentos** 🔒
- `POST /api/follows` · `GET /api/connections/me` · `GET /api/users/:id/follow-status`
- `GET /api/search` · `GET /api/talents` · `GET /api/suggestions/me` · `GET /api/trending`

**Vagas, Candidaturas e Avaliação** 🔒
- `GET /api/jobs` · `GET /api/jobs/mine` · `GET /api/jobs/:id` · `POST`/`PATCH`/`DELETE /api/jobs/:id`
- `POST /api/applications` · `GET /api/applications/me` · `GET /api/jobs/:id/applications`
- `PATCH /api/applications/:id` · `POST /api/applications/:id/{hire,renew,finish}`
- `GET`/`POST /api/applications/:id/review(s)`
- `POST /api/saved-jobs` · `GET /api/saved-jobs/me` · `GET /api/recommendations/me`

**Empresas** 🔒
- `GET`/`PUT /api/companies/me` · `GET /api/companies/:id`

**Agenda, Entrevistas e Mensagens** 🔒
- `GET /api/agenda/me` · `GET`/`POST`/`PATCH`/`DELETE /api/tasks` · `/reminders`
- `GET`/`POST /api/interviews` · `PATCH /api/interviews/:id` · `/cancel` · `/complete` · `/reschedule-request`
- `POST /api/conversations` · `GET /api/conversations/me` · `GET`/`POST /api/conversations/:id/messages` · `/read`

**Notificações** 🔒
- `GET /api/notifications/me` · `POST /api/notifications/read`

---

## Hospedagem e Persistência

A aplicação é publicada na **Render**, onde o servidor Express serve a **API REST**, os **arquivos estáticos** do front-end e a pasta **`/uploads`**.

- A semente versionada `src/scripts/backend/db.json` é copiada, na primeira execução, para um diretório de dados (`DATA_DIR`), garantindo a persistência entre execuções.
- Imagens enviadas em base64 (avatares, capas, logos) são convertidas em arquivos e gravadas em `/uploads`, ficando apenas o caminho no banco.
- Variáveis de ambiente: `JWT_SECRET`, `RESEND_API_KEY`, `GITHUB_TOKEN`, `DATA_DIR`, `PORT`, entre outras.

🔗 **Aplicação publicada:** https://orbit-web-wlgm.onrender.com/
🔗 **Protótipo (Figma):** https://www.figma.com/design/yRsVIU0T9L9Dvz3J9P2XhP/Rede-Social-Para-Devs---Orbit?node-id=7-6246

---

## Considerações Finais

A solução implementada do Orbit superou o escopo inicial de protótipo, entregando uma **aplicação web full-stack funcional** com autenticação, persistência e um conjunto amplo de funcionalidades — desde a criação de perfil e portfólio até o ciclo completo de contratação com avaliação mútua entre desenvolvedores e empresas, além de um feed social com sistema de dúvidas e respostas (Q&A) e reputação.

A arquitetura adotada (front-end em tecnologias web puras + API REST em Node.js) manteve o código acessível ao nível da equipe, ao mesmo tempo em que permitiu evoluir o produto de forma incremental, com persistência real de dados e integração a serviços externos (GitHub e e-mail).
