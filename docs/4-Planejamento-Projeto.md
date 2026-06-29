# 4. Planejamento do Projeto

> Aqui será feito o gerenciamento das tarefas de implementação do projeto.

---

## Divisão de Papéis

A organização da equipe foi baseada em práticas do framework Scrum, adaptadas à realidade acadêmica do projeto. Os papéis foram distribuídos de forma rotativa entre os membros da equipe ao longo das sprints, permitindo que todos tivessem contato com diferentes responsabilidades dentro do desenvolvimento do projeto.

---

### Sprint 1
- Scrum Master: Eduardo Freire Cesário  
- Desenvolvedores: Kaio Henrique Dos Santos Ferreira, Lucas Bonsucesso Rodrigues, Lucas Rodrigues Valle  
- Testes: Tiago Ribeiro Silva Quadros, Daniel Henrique Ferreira Gomes  

---

### Sprint 2
- Scrum Master: Kaio Henrique Dos Santos Ferreira  
- Desenvolvedores: Lucas Bonsucesso Rodrigues, Tiago Ribeiro Silva Quadros, Daniel Henrique Ferreira Gomes  
- Testes: Eduardo Freire Cesário, Lucas Rodrigues Valle  

---

### Sprint 3
- Scrum Master: Lucas Rodrigues Valle  
- Desenvolvedores: Kaio Henrique Dos Santos Ferreira, Daniel Henrique Ferreira Gomes, Eduardo Freire Cesário  
- Testes: Lucas Bonsucesso Rodrigues, Tiago Ribeiro Silva Quadros  

---

## Quadro de tarefas

A seguir está o acompanhamento das atividades realizadas durante o desenvolvimento do projeto, organizadas por sprint.

---

## Sprint 1

Atualizado em: 20/04/2026

| Responsável | Tarefa/Requisito | Iniciado em | Prazo | Status | Terminado em |
|-------------|------------------|-------------|--------|--------|---------------|
| Kaio        | Introdução (Contexto) | 15/04/2026 | 18/04/2026 | ✔️ | 18/04/2026 |
| Lucas Valle | Problema e Justificativa | 15/04/2026 | 18/04/2026 | ✔️ | 18/04/2026 |
| Lucas Bonsucesso | Público-alvo | 16/04/2026 | 19/04/2026 | ✔️ | 19/04/2026 |
| Daniel      | Personas | 16/04/2026 | 19/04/2026 | ✔️ | 19/04/2026 |
| Tiago       | Revisão da documentação | 17/04/2026 | 20/04/2026 | ✔️ | 20/04/2026 |

---

## Sprint 2

Atualizado em: 25/04/2026

| Responsável | Tarefa/Requisito | Iniciado em | Prazo | Status | Terminado em |
|-------------|------------------|-------------|--------|--------|---------------|
| Kaio        | Histórias de usuário | 21/04/2026 | 23/04/2026 | ✔️ | 23/04/2026 |
| Lucas Valle | Requisitos funcionais | 21/04/2026 | 24/04/2026 | ✔️ | 24/04/2026 |
| Lucas Bonsucesso | Requisitos não funcionais | 22/04/2026 | 24/04/2026 | ✔️ | 24/04/2026 |
| Daniel      | Estrutura da solução | 22/04/2026 | 25/04/2026 | ✔️ | 25/04/2026 |
| Tiago       | Revisão geral | 23/04/2026 | 25/04/2026 | ✔️ | 25/04/2026 |

---

## Sprint 3

Atualizado em: 30/04/2026

| Responsável | Tarefa/Requisito | Iniciado em | Prazo | Status | Terminado em |
|-------------|------------------|-------------|--------|--------|---------------|
| Kaio        | Projeto de Interface (User Flow) | 26/04/2026 | 28/04/2026 | ✔️ | 28/04/2026 |
| Lucas Valle | Wireframes | 26/04/2026 | 29/04/2026 | ✔️ | 29/04/2026 |
| Lucas Bonsucesso | Protótipo Figma | 27/04/2026 | 30/04/2026 | ✔️ | 30/04/2026 |
| Daniel      | Documentação da interface | 27/04/2026 | 30/04/2026 | ✔️ | 30/04/2026 |
| Tiago       | Validação final | 28/04/2026 | 30/04/2026 | ✔️ | 30/04/2026 |

---

Legenda:
- ✔️: terminado  
- 📝: em execução  
- ⌛: atrasado  
- ❌: não iniciado  

---

## Quadro de Controle de Tarefas (Kanban)

O acompanhamento das tarefas foi feito em um **quadro Kanban no Trello**, organizado nas colunas:

- **A Fazer (Backlog):** tarefas planejadas para a sprint;
- **Em Andamento:** tarefas sendo desenvolvidas;
- **Em Revisão:** tarefas concluídas aguardando revisão/testes;
- **Concluído:** tarefas finalizadas e validadas.

Cada cartão representa uma tarefa/requisito, com responsável e prazo, espelhando as tabelas de sprint acima.

🔗 **Quadro Trello:** https://trello.com/invite/b/69dbd14864d2202e560801be/ATTIf943c158f70a5f578cda13d9629196ba267B20EF/tiau-puc

As capturas de tela do quadro preenchido estão disponíveis na pasta `docs/images` (ex.: `kanban-sprint1.png`, `kanban-sprint2.png`, `kanban-sprint3.png`).

---

## Ferramentas

As ferramentas empregadas no projeto foram selecionadas com base na adequação a cada etapa do desenvolvimento — do design à hospedagem.

**Editor de código**
- **Visual Studio Code** — desenvolvimento do front-end e do back-end.

**Comunicação**
- **WhatsApp / Discord** — alinhamento diário e reuniões da equipe.

**Diagramação e design**
- **Figma** — wireframes e protótipo interativo da interface.

**Controle de versão**
- **Git + GitHub** — versionamento do código e organização da documentação.

**Gerenciamento de tarefas**
- **Trello** — quadro Kanban para acompanhamento das tarefas por sprint.

**Tecnologias de desenvolvimento**
- **Front-end:** HTML5, CSS3 e JavaScript (Vanilla JS, sem frameworks).
- **Back-end:** Node.js, Express e json-server (API REST), com autenticação JWT (jsonwebtoken), hash de senha (bcryptjs), CORS e envio de e-mails (Resend).

**Hospedagem (Deploy)**
- **Render** — publicação da aplicação (API + front-end + uploads), com o `db.json` como base de dados persistente.

**Integrações externas**
- **GitHub API (REST e GraphQL)** — importação de repositórios e gráfico de contribuições dos desenvolvedores.

> A justificativa para a escolha dessas ferramentas está na **gratuidade**, na **curva de aprendizado acessível** ao nível da equipe e na **boa integração entre elas** (especialmente Git/GitHub, VS Code e Render), permitindo evoluir de um protótipo para uma aplicação full-stack sem mudar o ecossistema de trabalho.
