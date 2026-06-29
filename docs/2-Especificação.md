# 2. Especificações do Projeto

<span style="color:red">Pré-requisitos: <a href="1-Contexto.md"> Documentação de Contexto</a></span>

Esta seção apresenta a especificação do projeto Orbit, detalhando as personas, histórias de usuário, requisitos funcionais e não funcionais, além das restrições do sistema. Para a construção desta etapa, foram utilizadas técnicas como Design Thinking, definição de personas, matriz CSD e modelagem de histórias de usuário, com o objetivo de compreender melhor as necessidades dos usuários e orientar o desenvolvimento da solução.

---

## Personas

### 👨‍💻 Persona 1 — Kaio (Desenvolvedor Iniciante)

Kaio tem 20 anos, é estudante de Sistemas de Informação e está no início da sua jornada na área de tecnologia. Ele já possui conhecimentos básicos em programação e já desenvolveu alguns projetos acadêmicos e pessoais, mas enfrenta dificuldades para conseguir sua primeira oportunidade profissional.

Ele utiliza frequentemente plataformas digitais, como GitHub e LinkedIn, mas sente que não consegue se destacar entre outros candidatos. Seu principal objetivo é conseguir seu primeiro emprego ou estágio na área, validando suas habilidades por meio de projetos práticos.

---

### 💻 Persona 2 — Lucas (Freelancer)

Lucas tem 24 anos, trabalha como desenvolvedor freelancer e possui conhecimentos intermediários em desenvolvimento web. Apesar de já ter realizado alguns trabalhos, enfrenta dificuldades para manter uma renda constante devido à falta de clientes recorrentes.

Ele busca uma plataforma que facilite a divulgação de seus projetos e permita conexão direta com empresas, reduzindo a dependência de intermediários e aumentando suas oportunidades de trabalho.

---

### 🏢 Persona 3 — Daniel (Recrutador)

Daniel tem 30 anos e trabalha como recrutador em uma empresa de tecnologia. Ele é responsável por encontrar profissionais qualificados para diferentes projetos, mas enfrenta dificuldades na validação das habilidades dos candidatos, já que muitos perfis não apresentam evidências práticas suficientes.

Seu objetivo é encontrar profissionais de forma rápida e eficiente, analisando projetos reais que comprovem suas competências técnicas.

---

## Histórias de Usuários

Com base nas personas, foram identificadas as seguintes histórias de usuários:

### 👨‍💻 Desenvolvedor Iniciante

|EU COMO...| QUERO/PRECISO ... |PARA ...|
|----------|------------------|--------|
|Desenvolvedor iniciante| Criar um perfil profissional | Me apresentar para o mercado |
|Desenvolvedor iniciante| Adicionar meus projetos | Demonstrar minhas habilidades |
|Desenvolvedor iniciante| Visualizar oportunidades | Encontrar vagas compatíveis |
|Desenvolvedor iniciante| Me candidatar a oportunidades | Conseguir meu primeiro emprego |

---

### 💻 Freelancer

|EU COMO...| QUERO/PRECISO ... |PARA ...|
|----------|------------------|--------|
|Freelancer| Divulgar meu portfólio | Atrair novos clientes |
|Freelancer| Encontrar oportunidades | Aumentar minha renda |
|Freelancer| Conectar com empresas | Fechar novos projetos |

---

### 🏢 Empresa / Recrutador

|EU COMO...| QUERO/PRECISO ... |PARA ...|
|----------|------------------|--------|
|Empresa| Buscar desenvolvedores | Encontrar profissionais qualificados |
|Empresa| Filtrar candidatos | Economizar tempo na seleção |
|Empresa| Visualizar projetos | Validar habilidades técnicas |
|Empresa| Criar oportunidades | Atrair candidatos |

---

## Requisitos

As tabelas a seguir apresentam os requisitos funcionais e não funcionais do sistema Orbit.

---

### Requisitos Funcionais

|ID    | Descrição do Requisito  | Prioridade |
|------|-------------------------|------------|
|RF-001| Permitir que o usuário crie um perfil | ALTA |
|RF-002| Permitir que o usuário adicione projetos ao perfil | ALTA |
|RF-003| Exibir lista de oportunidades disponíveis | ALTA |
|RF-004| Permitir que o usuário visualize detalhes de oportunidades | ALTA |
|RF-005| Permitir que o usuário se candidate a oportunidades | MÉDIA |
|RF-006| Permitir que empresas criem oportunidades | ALTA |
|RF-007| Permitir que empresas busquem desenvolvedores | ALTA |
|RF-008| Permitir a visualização de perfis de usuários | ALTA |
|RF-009| Permitir filtro de busca por habilidades | MÉDIA |
|RF-010| Permitir navegação entre páginas do sistema | ALTA |

---

### Requisitos Não Funcionais

|ID     | Descrição do Requisito  | Prioridade |
|-------|--------------------------|------------|
|RNF-001| O sistema deve ser responsivo (desktop e mobile) | ALTA |
|RNF-002| O sistema deve ter interface simples e intuitiva | ALTA |
|RNF-003| O sistema deve carregar as páginas em até 3 segundos | MÉDIA |
|RNF-004| O sistema deve ser compatível com navegadores modernos | ALTA |
|RNF-005| O sistema deve utilizar HTML, CSS e JavaScript | ALTA |
|RNF-006| O sistema deve ter organização de código clara | MÉDIA |

---

## Restrições

O projeto está sujeito às seguintes restrições:

|ID| Restrição |
|--|----------|
|01| O **front-end** é desenvolvido com HTML, CSS e JavaScript puro (sem frameworks) |
|02| O **back-end é simulado via JSON Server** (Node.js/Express), não sendo um servidor de produção dedicado |
|03| A **persistência é temporária**: os dados ficam salvos no arquivo **`db.json`**, não havendo banco de dados relacional ou NoSQL |
|04| A hospedagem é feita em camada gratuita (Render), podendo hibernar após período de inatividade |
|05| O projeto deve ser entregue até o final do semestre |

> **Observação:** o back-end da aplicação é **simulado com o JSON Server** — uma API REST construída sobre um arquivo JSON. Dessa forma, os dados criados durante o uso (perfis, posts, vagas, candidaturas, avaliações, etc.) ficam **salvos temporariamente no arquivo `db.json`**, que atua como base de dados do projeto. Essa abordagem é adequada ao escopo acadêmico, porém sem as garantias (escalabilidade, concorrência, integridade) de um banco de dados de produção.

---

## Considerações Finais

A especificação apresentada tem como objetivo orientar o desenvolvimento da aplicação Orbit, garantindo que as principais necessidades dos usuários sejam atendidas dentro das limitações do projeto. A utilização de personas, histórias de usuário e requisitos permite uma melhor organização e compreensão do escopo da solução.
