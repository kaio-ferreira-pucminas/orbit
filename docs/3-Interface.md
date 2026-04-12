# 3. Projeto de Interface

<span style="color:red">Pré-requisitos: <a href="2-Especificação.md"> Documentação de Especificação</a></span>

Esta seção apresenta o projeto de interface da plataforma Orbit, detalhando a estrutura visual, organização das telas e fluxos de navegação definidos para a aplicação. O desenvolvimento da interface foi orientado com base nas personas, histórias de usuário e requisitos levantados anteriormente, garantindo que a solução proposta atenda às necessidades reais dos usuários.

A interface foi planejada considerando princípios de usabilidade e experiência do usuário (UX), priorizando simplicidade, clareza e eficiência. Como o projeto se encontra em fase inicial e é desenvolvido apenas em front-end, o foco está na construção de um protótipo funcional que represente fielmente o comportamento esperado do sistema.

---

## User Flow

O fluxo de usuário (User Flow) foi utilizado como ferramenta para mapear as interações dos usuários com a plataforma, permitindo visualizar de forma clara os caminhos que podem ser percorridos dentro do sistema. Essa técnica foi essencial para alinhar as funcionalidades com as necessidades das personas, garantindo uma navegação intuitiva e objetiva.

Foram definidos dois fluxos principais: o fluxo do desenvolvedor (usuário) e o fluxo da empresa (recrutador).

---

### Fluxo do Desenvolvedor

Home → Cadastro/Login → Criação de Perfil → Adição de Projetos → Explorar Oportunidades → Visualizar Detalhes → Candidatar-se

Esse fluxo foi projetado para facilitar a entrada de usuários iniciantes na plataforma, permitindo que eles rapidamente criem um perfil e exponham seus projetos, que são o principal meio de validação de suas habilidades.

---

### Fluxo da Empresa

Home → Cadastro/Login → Criação de Perfil da Empresa → Dashboard → Buscar Desenvolvedores → Visualizar Perfis → Criar Oportunidade → Gerenciar Candidatos → Entrar em Contato

O fluxo da empresa foi estruturado com foco em eficiência e produtividade, permitindo que recrutadores encontrem profissionais rapidamente, avaliem seus projetos e estabeleçam contato direto.

---

### Considerações sobre o Fluxo

A definição dos fluxos buscou reduzir a quantidade de etapas necessárias para que o usuário alcance seu objetivo, promovendo uma experiência mais fluida. Além disso, os fluxos foram diretamente baseados nas histórias de usuário, garantindo coerência entre a necessidade identificada e a solução proposta.

---

## Wireframes

Os wireframes foram desenvolvidos como representações visuais simplificadas das telas da aplicação, com o objetivo de definir a estrutura dos elementos e a organização das informações antes da implementação.

Diferente do design final, os wireframes não focam em aspectos visuais detalhados, mas sim na disposição dos componentes e na usabilidade da interface.

---

### Tela Inicial (Home)

Elementos principais:
- Menu de navegação  
- Apresentação da plataforma  
- Listagem de oportunidades em formato de cards  
- Botões de acesso (login e cadastro)  

Objetivo:
- Apresentar a proposta da aplicação  
- Direcionar o usuário para as principais ações  

---

### Tela de Perfil do Usuário

Elementos principais:
- Nome e descrição (bio)  
- Lista de habilidades (tags)  
- Projetos desenvolvidos (cards com descrição e links)  

Objetivo:
- Permitir que o usuário apresente suas competências  
- Destacar projetos como principal forma de validação  

---

### Tela de Busca de Desenvolvedores

Elementos principais:
- Campo de busca  
- Filtros por habilidades  
- Listagem de usuários em formato de cards  

Objetivo:
- Permitir que empresas encontrem profissionais com base em critérios específicos  

---

### Tela de Oportunidades

Elementos principais:
- Lista de oportunidades  
- Cards contendo título, descrição e requisitos  
- Botão de visualização de detalhes  

Objetivo:
- Facilitar o acesso a oportunidades disponíveis  

---

### Tela de Detalhes da Oportunidade

Elementos principais:
- Descrição completa da vaga  
- Habilidades exigidas  
- Botão de candidatura  

Objetivo:
- Apresentar informações detalhadas e permitir ação direta do usuário  

---

### Tela de Dashboard da Empresa

Elementos principais:
- Lista de oportunidades criadas  
- Lista de candidatos  
- Ações rápidas (buscar desenvolvedores, criar vaga)  

Objetivo:
- Centralizar as principais funcionalidades da empresa em um único ambiente  

---

## Protótipo

O protótipo da interface foi desenvolvido utilizando a ferramenta Figma, com o objetivo de representar visualmente as telas da aplicação e validar a organização dos elementos antes da implementação.

No momento, o protótipo possui caráter estático (não interativo), ou seja, não apresenta navegação automatizada entre as telas. Ainda assim, ele cumpre o papel de demonstrar a estrutura visual, a hierarquia das informações e o fluxo geral da aplicação.

Essa abordagem é adequada para a fase atual do projeto, servindo como base para o desenvolvimento front-end e futuras evoluções da interface.

Acesse o protótipo pelo link abaixo:  
https://www.figma.com/design/yRsVIU0T9L9Dvz3J9P2XhP/Rede-Social-Para-Devs---Orbit?node-id=7-6246&t=zyYMsf93z4BVilF7-1

---

## Decisões de Design

As principais decisões adotadas no desenvolvimento da interface incluem:

- Utilização de layout baseado em cards para facilitar a leitura e organização das informações  
- Interface simples e intuitiva, visando atender usuários iniciantes  
- Destaque para projetos como principal elemento de validação de habilidades  
- Navegação direta e com poucos níveis de profundidade  
- Estrutura responsiva para adaptação a diferentes dispositivos  

---

## Considerações Finais

O projeto de interface da Orbit foi desenvolvido com foco na experiência do usuário, buscando atender às necessidades das personas identificadas e garantir que as principais funcionalidades sejam facilmente acessíveis.

A definição dos fluxos e wireframes contribui para uma implementação mais organizada e coerente, servindo como base para o desenvolvimento do front-end da aplicação.
