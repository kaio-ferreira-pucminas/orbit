# 5. Implementação

<span style="color:red">Pré-requisitos: <a href="4-Gerenciamento-Projeto.md"> Planejamento do Projeto</a></span>

---

## Tecnologias Utilizadas

A solução proposta para o projeto Orbit foi desenvolvida utilizando tecnologias voltadas para aplicações web front-end, considerando as restrições do projeto e o nível de conhecimento atual da equipe.

As principais tecnologias utilizadas são:

- **HTML5**: utilizado para estruturação das páginas da aplicação  
- **CSS3**: responsável pela estilização e layout das interfaces  
- **JavaScript**: utilizado para interatividade e manipulação de elementos da interface  
- **Figma**: utilizado para criação dos wireframes e protótipos da aplicação  
- **Visual Studio Code**: utilizado como ambiente de desenvolvimento  
- **GitHub**: utilizado para versionamento de código e organização da documentação  

---

### 🔄 Relação entre as Tecnologias

A interação do usuário com o sistema ocorre da seguinte forma:

1. O usuário acessa a aplicação por meio do navegador  
2. As páginas HTML estruturam o conteúdo exibido  
3. O CSS aplica o design visual e layout da interface  
4. O JavaScript adiciona interatividade (ex: navegação, ações de clique)  
5. O sistema responde às ações do usuário diretamente no front-end  

Devido à ausência de back-end nesta fase, não há persistência de dados, sendo a aplicação focada na simulação do comportamento de uma plataforma real.

---

### 🔗 Protótipo e Fluxos

Durante o desenvolvimento do projeto, foram utilizados:

- Fluxos de usuário (User Flow) para definição das interações  
- Wireframes para organização das telas  
- Protótipo no Figma para validação visual da interface  

👉 Acesse o protótipo:  
https://www.figma.com/design/yRsVIU0T9L9Dvz3J9P2XhP/Rede-Social-Para-Devs---Orbit?node-id=7-6246&t=zyYMsf93z4BVilF7-1

---

## Arquitetura da Solução

A arquitetura da solução é baseada em uma estrutura simples de aplicação web front-end, considerando as limitações do projeto.

A aplicação segue o modelo:

Usuário → Navegador → HTML + CSS + JavaScript → Interface

---

### 🧠 Descrição da Arquitetura

- O usuário interage diretamente com a interface no navegador  
- O HTML define a estrutura das páginas  
- O CSS define a aparência e organização visual  
- O JavaScript controla o comportamento da interface  
- Não há comunicação com servidor ou banco de dados  

Essa arquitetura foi escolhida por ser adequada ao escopo do projeto, permitindo a construção de uma aplicação funcional e visualmente consistente.

---

## Interface do Sistema

A interface do sistema foi desenvolvida com foco na experiência do usuário, priorizando simplicidade, clareza e facilidade de navegação.

---

## Tela principal do sistema

A tela principal (Home) apresenta a proposta da plataforma Orbit e permite ao usuário acessar rapidamente as principais funcionalidades.

Elementos presentes:
- Menu de navegação  
- Apresentação da plataforma  
- Lista de oportunidades  
- Botões de login e cadastro  

[`Tela principal do sistema`](images/home.png)

---

## Telas do requisito 1 – Perfil do Usuário

### Tela de Perfil

Permite que o usuário visualize e edite suas informações, incluindo habilidades e projetos.

Elementos:
- Nome e descrição  
- Lista de habilidades  
- Projetos (cards)

[`Tela de Perfil`](images/perfil.png)

---

### Tela de Projetos

Permite visualizar os projetos cadastrados pelo usuário.

Elementos:
- Lista de projetos  
- Descrição e links  

[`Tela de Projetos`](images/projetos.png)

---

## Telas do requisito 2 – Oportunidades

### Tela de Listagem de Oportunidades

Apresenta as oportunidades disponíveis na plataforma.

Elementos:
- Lista de vagas  
- Cards com título e descrição  

[`Tela de Oportunidades`](images/oportunidades.png)

---

### Tela de Detalhes da Oportunidade

Permite visualizar informações completas sobre uma oportunidade.

Elementos:
- Descrição detalhada  
- Requisitos  
- Botão de candidatura  

[`Tela de Detalhes`](images/detalhes.png)

---

## Telas do requisito 3 – Empresa

### Dashboard da Empresa

Permite gerenciar vagas e visualizar candidatos.

Elementos:
- Lista de vagas criadas  
- Lista de candidatos  
- Ações rápidas  

[`Dashboard Empresa`](images/dashboard.png)

---

### Tela de Busca de Desenvolvedores

Permite que empresas encontrem profissionais.

Elementos:
- Campo de busca  
- Filtros  
- Lista de usuários  

[`Busca de Desenvolvedores`](images/busca.png)

---

## Considerações Finais

A implementação do projeto Orbit foi realizada considerando as limitações técnicas propostas, focando na construção de uma interface funcional e alinhada às necessidades dos usuários.

Apesar de não possuir back-end nesta fase, a aplicação representa de forma consistente o funcionamento de uma plataforma real, podendo ser evoluída futuramente com integração a serviços e persistência de dados.
