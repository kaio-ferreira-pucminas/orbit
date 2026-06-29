# 6. Conclusão

<span style="color:red">Pré-requisitos: <a href="5-Implementação.md"> Implementação</a></span>

---

## Síntese dos Resultados

O projeto **Orbit** partiu de um problema concreto — a dificuldade de inserção de profissionais iniciantes no mercado de tecnologia — e evoluiu de um protótipo de interface para uma **aplicação web full-stack funcional**, hospedada e acessível publicamente.

Entre os principais resultados obtidos, destacam-se:

- **Conta e perfil:** cadastro/login com autenticação segura (JWT + bcrypt), recuperação de senha por e-mail e perfis distintos para **desenvolvedores** e **empresas**;
- **Portfólio e GitHub:** gestão de projetos com capa e a **importação automática de repositórios** e do gráfico de contribuições do GitHub, reforçando a validação prática de habilidades — objetivo central do projeto;
- **Comunidade e conhecimento:** um **feed social** com formatação em Markdown e um sistema de **dúvidas e respostas (Q&A)** com avaliação por estrelas, marcação de "útil", "melhor resposta" e **reputação**, aproximando a plataforma de referências como o StackOverflow;
- **Conexão profissional:** publicação de **vagas**, candidaturas, **busca de talentos**, mensagens privadas e notificações;
- **Ciclo completo de contratação:** contratação **CLT ou freelance**, agendamento de **entrevistas**, agenda pessoal e, ao final, **avaliação mútua entre dev e empresa** por critérios — fechando o ciclo de confiança entre as partes.

Dessa forma, o objetivo geral — desenvolver um software que aproxime profissionais e oportunidades — foi atendido, assim como os objetivos específicos relacionados à apresentação de habilidades por meio de projetos práticos e à criação de um ambiente digital de interação entre profissionais e contratantes.

---

## Limitações da Solução

Apesar dos resultados, a solução possui limitações que devem ser reconhecidas:

- A persistência é feita sobre um arquivo **`db.json`** (json-server), adequado ao escopo acadêmico, mas não a um cenário de produção com alto volume de acessos e concorrência — um banco de dados relacional ou NoSQL seria mais robusto;
- Algumas regras de acesso ainda dependem do roteador automático do json-server, exigindo **fortalecimento das validações de autorização** no servidor;
- O envio de e-mails e as integrações externas dependem de **chaves de API** e de serviços de terceiros (Resend, GitHub), sujeitos a limites de uso;
- A hospedagem em camada gratuita pode **hibernar** o serviço após período de inatividade, gerando lentidão no primeiro acesso;
- Não há, ainda, uma suíte de **testes automatizados** abrangente nem mecanismos avançados de moderação de conteúdo.

---

## Trabalhos Futuros

Como sugestões de evolução e novas linhas de estudo, propõem-se:

- Migrar a persistência para um **banco de dados** dedicado (ex.: PostgreSQL ou MongoDB);
- Implementar **testes automatizados** (unitários e de integração) e um pipeline de CI/CD;
- Evoluir o sistema de **recomendação** de vagas e talentos com técnicas mais sofisticadas (inclusive aprendizado de máquina);
- Adicionar **chat em tempo real** (WebSockets) e notificações push;
- Aprimorar a **segurança** (rate limiting, verificação de e-mail, papéis e permissões refinadas) e a **acessibilidade** da interface;
- Incluir métricas e um painel de **analytics** para acompanhamento de engajamento e empregabilidade.

---

## Considerações Finais

O desenvolvimento do Orbit permitiu à equipe aplicar, de forma integrada, conhecimentos de **front-end, back-end, banco de dados, integração com APIs e práticas ágeis (Scrum)**. Mais do que cumprir os requisitos, o projeto consolidou a experiência de evoluir um produto de forma incremental — do entendimento do problema (Product Discovery) até uma solução implementada e publicada — entregando uma plataforma coerente com o propósito de **reduzir as barreiras de entrada de novos profissionais no mercado de tecnologia**.
