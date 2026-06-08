// feed.js — Orbit Community Feed
// JS puro, sem framework

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* =========================================================
     AUTH GUARD — bloqueia acesso sem token
  ========================================================= */
  const token = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');

  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }

  const currentUser = JSON.parse(userJson);

  /* =========================================================
     HELPERS
  ========================================================= */
  function $(selector, root = document) { return root.querySelector(selector); }
  function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, ch => map[ch]);
  }

  // Iniciais do nome (ex: "João Silva" → "JS")
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  // Conteúdo do avatar: imagem do usuário (avatarUrl) com fallback para as iniciais
  function avatarInner(user) {
    user = user || {};
    if (user.avatarUrl) {
      return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name || '')}" />`;
    }
    return `<span>${initials(user.name)}</span>`;
  }

  // Ex: "há 2h", "há 3d"
  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)    return 'agora';
    if (min < 60)   return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24)     return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)      return `${d}d`;
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  /* =========================================================
     MARKDOWN PARSER — XSS-safe (~30 linhas)
     Suporta: code block ```...```, inline `code`, **bold**, *italic*, [text](url)
  ========================================================= */
  function parseMarkdown(text) {
    if (!text) return '';

    // 1. Escapa todo HTML primeiro (segurança)
    let html = escapeHtml(text);

    // 2. Code block (```...```) — TEM que vir antes de inline code
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
    );

    // 3. Inline code (`...`)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 4. Bold (**...**)
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    // 5. Italic (*...*) — depois do bold
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    // 6. Link [text](url) — só http(s)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // 7. Quebras de linha → parágrafos (exceto dentro de <pre>)
    const parts = html.split(/<pre>[\s\S]*?<\/pre>/g);
    const blocks = html.match(/<pre>[\s\S]*?<\/pre>/g) || [];
    let result = '';
    parts.forEach((part, i) => {
      const paragraphs = part
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      result += paragraphs;
      if (blocks[i]) result += blocks[i];
    });

    return result;
  }

  /* =========================================================
     FETCH WRAPPER — adiciona Bearer token e trata 401
  ========================================================= */
  async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }

    return res;
  }

  /* =========================================================
     RENDER — sidebar (perfil + header + sugestões)
  ========================================================= */
  function renderProfileCard() {
    $('#profile-card-name').textContent  = currentUser.name;
    $('#profile-card-title').textContent = currentUser.title ||
      (currentUser.type === 'company' ? 'Empresa' : 'Desenvolvedor(a)');

    setAvatar($('.profile-card__avatar'),  currentUser.avatarUrl, currentUser.name, '#profile-card-initials');
    setAvatar($('.composer__avatar'),      currentUser.avatarUrl, currentUser.name, '#composer-initials');
    // Header (avatar + menu do usuário) agora é responsabilidade do componente header.js
  }

  // Helper: aplica imagem ou iniciais a um elemento avatar
  function setAvatar(container, url, name, initialsSelector) {
    if (!container) return;
    const initialsEl = initialsSelector ? container.querySelector(initialsSelector) : null;
    container.querySelector('img')?.remove();

    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = name || '';
      container.appendChild(img);
      if (initialsEl) initialsEl.style.display = 'none';
    } else if (initialsEl) {
      initialsEl.style.display = '';
      initialsEl.textContent = initials(name);
    }
  }

  /* =========================================================
     USER MENU — agora renderizado e controlado pelo header.js
     (avatar do header, dropdown, "Ir para o perfil" e logout)
  ========================================================= */

  /* =========================================================
     FOLLOWING — quem eu já sigo (reflete "Seguindo" já no load)
  ========================================================= */
  const followingIds = new Set();
  async function loadFollowing() {
    try {
      const res = await api('/api/connections/me');
      if (!res.ok) return;
      const conns = await res.json();
      conns.forEach(u => { if (u.relation && u.relation.following) followingIds.add(u.id); });
    } catch { /* silencioso */ }
  }

  /* =========================================================
     SUGESTÕES — algoritmo de grafo (/api/suggestions/me), com motivo
  ========================================================= */
  async function loadSuggestions() {
    try {
      const res = await api('/api/suggestions/me');
      if (!res.ok) return;

      const suggestions = await res.json();
      const container = $('#suggestions-list');
      if (!suggestions.length) {
        container.innerHTML = '<p class="suggestion__empty">Sem sugestões no momento.</p>';
        return;
      }

      container.innerHTML = suggestions.map(u => `
        <div class="suggestion">
          <div class="suggestion__user suggestion__user--link" data-profile-id="${escapeHtml(u.id || '')}" role="link" tabindex="0" title="Ver perfil de ${escapeHtml(u.name || '')}">
            <div class="suggestion__avatar">${avatarInner(u)}</div>
            <div class="suggestion__info">
              <p class="suggestion__name">${escapeHtml(u.name)}</p>
              <p class="suggestion__title">${escapeHtml(u.reason || u.title || 'Desenvolvedor(a)')}</p>
            </div>
          </div>
          <button class="suggestion__follow-btn${followingIds.has(u.id) ? ' is-following' : ''}" type="button" data-follow-id="${escapeHtml(u.id)}"
            aria-label="Seguir ${escapeHtml(u.name)}" title="${followingIds.has(u.id) ? 'Seguindo' : 'Seguir'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </button>
        </div>
      `).join('');
    } catch {
      /* silencioso */
    }
  }

  /* =========================================================
     TÓPICOS EM ALTA — /api/trending
  ========================================================= */
  async function loadTrending() {
    const container = document.getElementById('trending-list');
    if (!container) return;
    try {
      const res = await api('/api/trending');
      if (!res.ok) return;
      const topics = await res.json();
      if (!topics.length) {
        container.innerHTML = '<p class="trending-empty">Nenhum tópico em alta ainda.</p>';
        return;
      }
      container.innerHTML = topics.map(t => {
        const tag = t.tag.startsWith('#') ? t.tag : '#' + t.tag;
        const q   = encodeURIComponent(tag.replace(/^#/, '')); // busca o tópico sem o "#"
        const n   = t.postsCount;
        return `
          <a href="/pages/busca.html?q=${q}" class="trending-item">
            <span class="trending-item__tag">${escapeHtml(tag)}</span>
            <span class="trending-item__meta">${n} post${n === 1 ? '' : 's'}</span>
          </a>`;
      }).join('');
    } catch {
      /* silencioso */
    }
  }

  /* =========================================================
     FOLLOW — liga os botões "Seguir" ao backend (toggle)
  ========================================================= */
  async function toggleFollow(targetUserId, btn) {
    btn.disabled = true;
    try {
      const res = await api('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (window.orbitToast) window.orbitToast(data.error || 'Não foi possível seguir.', 'error');
        return;
      }
      // Mantém o conjunto de "quem eu sigo" em sincronia
      if (data.following) followingIds.add(targetUserId); else followingIds.delete(targetUserId);
      // Atualiza estado visual do botão
      // Atualiza TODOS os botões de seguir desse usuário no DOM (posts do feed + sugestões)
      $$(`[data-follow-id="${targetUserId}"]`).forEach(b => {
        b.classList.toggle('is-following', !!data.following);
        if (b.classList.contains('post__follow-btn')) b.textContent = data.following ? 'Seguindo' : 'Seguir';
        else if (b.classList.contains('suggestion__follow-btn')) b.setAttribute('title', data.following ? 'Seguindo' : 'Seguir');
      });
      // Ao seguir, some das "Sugestões para você" (se estiver lá) e entra uma nova pessoa
      if (data.following) {
        const sugBtn = document.querySelector(`.suggestion__follow-btn[data-follow-id="${targetUserId}"]`);
        if (sugBtn) { const card = sugBtn.closest('.suggestion'); if (card) card.remove(); loadSuggestions(); }
      }
      if (window.orbitToast) {
        window.orbitToast(data.following ? 'Você começou a seguir.' : 'Você deixou de seguir.', 'success');
      }
    } catch {
      if (window.orbitToast) window.orbitToast('Não foi possível seguir agora.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // Delegação global para qualquer botão de seguir (sugestões e posts)
  document.addEventListener('click', (ev) => {
    const sBtn = ev.target.closest('.suggestion__follow-btn[data-follow-id]');
    if (sBtn) { toggleFollow(sBtn.getAttribute('data-follow-id'), sBtn); return; }
    const pBtn = ev.target.closest('.post__follow-btn[data-follow-id]');
    if (pBtn) { toggleFollow(pBtn.getAttribute('data-follow-id'), pBtn); return; }

    // Clique no container avatar+nome → perfil público do usuário
    const profileEl = ev.target.closest('[data-profile-id]');
    if (profileEl) {
      const id = profileEl.getAttribute('data-profile-id');
      if (id) window.location.href = `/pages/perfil-publico.html?id=${encodeURIComponent(id)}`;
    }
  });

  // Acessibilidade: Enter/Espaço no container de perfil
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const profileEl = ev.target.closest && ev.target.closest('[data-profile-id]');
    if (profileEl) {
      ev.preventDefault();
      const id = profileEl.getAttribute('data-profile-id');
      if (id) window.location.href = `/pages/perfil-publico.html?id=${encodeURIComponent(id)}`;
    }
  });

  /* =========================================================
     COMPOSER — expandir / colapsar / toolbar / submit
  ========================================================= */
  const composerCollapsed = $('#composer-collapsed');
  const composerExpanded  = $('#composer-expanded');
  const composerTrigger   = $('#composer-trigger');
  const composerCancel    = $('#composer-cancel');
  const composerSubmit    = $('#composer-submit');
  const composerTextarea  = $('#composer-textarea');
  const composerPreview   = $('#composer-preview');
  const previewToggle     = $('#composer-preview-toggle');
  const composerTitle     = $('#composer-title');
  let   composerType      = 'post';

  function expandComposer() {
    composerCollapsed.style.display = 'none';
    composerExpanded.classList.remove('composer__expanded--hidden');
    composerTextarea.focus();
  }

  function collapseComposer() {
    composerExpanded.classList.add('composer__expanded--hidden');
    composerCollapsed.style.display = 'flex';
    composerTextarea.value = '';
    composerPreview.innerHTML = '';
    composerPreview.classList.add('composer__preview--hidden');
    previewToggle.textContent = 'Pré-visualizar';
    setComposerType('post');
  }

  // Alterna entre Publicação e Dúvida (mostra/oculta o campo de título)
  function setComposerType(type) {
    composerType = type === 'duvida' ? 'duvida' : 'post';
    $$('.composer__type-btn').forEach(b => b.classList.toggle('is-active', b.dataset.ctype === composerType));
    if (composerType === 'duvida') {
      composerTitle.classList.remove('composer__title-input--hidden');
      composerTextarea.placeholder = 'Descreva sua dúvida com detalhes. Outros devs poderão responder e você avalia as respostas.';
      composerSubmit.textContent = 'Publicar dúvida';
    } else {
      composerTitle.classList.add('composer__title-input--hidden');
      composerTitle.value = '';
      composerTextarea.placeholder = 'Compartilhe algo com a comunidade...';
      composerSubmit.textContent = 'Publicar';
    }
  }
  $$('.composer__type-btn').forEach(b => b.addEventListener('click', () => setComposerType(b.dataset.ctype)));

  composerTrigger.addEventListener('click', expandComposer);
  composerCancel.addEventListener('click',  collapseComposer);

  // Toolbar — envolve seleção com marcadores markdown
  $$('.composer__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta    = composerTextarea;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const sel   = ta.value.substring(start, end);
      const fmt   = btn.dataset.format;

      let wrapped, cursorOffset;

      switch (fmt) {
        case 'bold':
          wrapped = `**${sel || 'texto em negrito'}**`;
          cursorOffset = sel ? wrapped.length : 2 + 'texto em negrito'.length;
          break;
        case 'italic':
          wrapped = `*${sel || 'texto em itálico'}*`;
          cursorOffset = sel ? wrapped.length : 1 + 'texto em itálico'.length;
          break;
        case 'code':
          wrapped = `\`${sel || 'código'}\``;
          cursorOffset = sel ? wrapped.length : 1 + 'código'.length;
          break;
        case 'codeblock':
          wrapped = `\n\`\`\`\n${sel || 'seu código aqui'}\n\`\`\`\n`;
          cursorOffset = wrapped.length;
          break;
        case 'link':
          wrapped = `[${sel || 'texto'}](https://)`;
          cursorOffset = sel ? wrapped.length : 1 + 'texto'.length;
          break;
        default:
          return;
      }

      ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
      ta.focus();
      const newPos = start + cursorOffset;
      ta.setSelectionRange(newPos, newPos);
    });
  });

  // Pré-visualização
  previewToggle.addEventListener('click', () => {
    const isHidden = composerPreview.classList.contains('composer__preview--hidden');

    if (isHidden) {
      composerPreview.innerHTML = parseMarkdown(composerTextarea.value) ||
        '<p style="color:var(--feed-text-muted)">Nada para pré-visualizar.</p>';
      composerPreview.classList.remove('composer__preview--hidden');
      previewToggle.textContent = 'Editar';
    } else {
      composerPreview.classList.add('composer__preview--hidden');
      previewToggle.textContent = 'Pré-visualizar';
    }
  });

  // Submit do post
  composerSubmit.addEventListener('click', async () => {
    const content = composerTextarea.value.trim();
    const title   = composerTitle.value.trim();
    if (!content) {
      window.showToast('Escreva algo antes de publicar.', 'error');
      return;
    }
    if (composerType === 'duvida' && !title) {
      window.showToast('Dê um título para a sua dúvida.', 'error');
      composerTitle.focus();
      return;
    }

    composerSubmit.disabled = true;
    composerSubmit.textContent = 'Publicando...';

    try {
      const payload = composerType === 'duvida'
        ? { content, type: 'duvida', title }
        : { content };
      const res = await api('/api/posts', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Erro ao publicar.', 'error');
        return;
      }

      window.showToast(composerType === 'duvida' ? 'Dúvida publicada!' : 'Publicação criada!', 'success');
      collapseComposer();
      // Post recém-criado pelo próprio usuário: fixa no topo do MEU feed (até dar F5)
      // e aparece na hora (otimista), sem esperar novo fetch.
      if (data && data.id) { sessionPostIds.unshift(data.id); feedPosts.unshift(data); }
      renderFeed();
      hideNewPostsButton();
      loadTrending();

    } catch {
      window.showToast('Erro de conexão. Verifique se o backend está rodando.', 'error');
    } finally {
      composerSubmit.disabled  = false;
      composerSubmit.textContent = composerType === 'duvida' ? 'Publicar dúvida' : 'Publicar';
    }
  });

  /* =========================================================
     RENDER — POST CARD
  ========================================================= */
  function renderPost(post) {
    const author      = post.author || { name: 'Usuário', title: '', id: null };
    const isOwn       = author.id === currentUser.id;
    const likedClass  = post.likedByMe ? 'post__action-btn--liked' : '';
    const likeFill    = post.likedByMe ? 'currentColor' : 'none';
    const isDuvida    = post.type === 'duvida';
    const status      = post.status === 'resolvida' ? 'resolvida' : 'aberta';
    const qaHead = isDuvida ? `
          <div class="post__qa-head">
            <span class="post__badge post__badge--duvida">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Dúvida
            </span>
            <span class="post__status post__status--${status}">${status === 'resolvida' ? 'Resolvida' : 'Aberta'}</span>
          </div>
          ${post.title ? `<h3 class="post__qa-title">${escapeHtml(post.title)}</h3>` : ''}` : '';

    return `
      <article class="post${isDuvida ? ' post--duvida' : ''}" data-post-id="${post.id}" data-post-type="${isDuvida ? 'duvida' : 'post'}">
        <div class="post__body">
          <div class="post__header">
            <div class="post__author post__author--link" data-profile-id="${escapeHtml(author.id || '')}" role="link" tabindex="0" title="Ver perfil de ${escapeHtml(author.name || '')}">
              <div class="post__avatar">${avatarInner(author)}</div>
              <div class="post__author-info">
                <p class="post__author-name">${escapeHtml(author.name)}</p>
                <span class="post__author-title">
                  ${escapeHtml(author.title || 'Desenvolvedor(a)')} • ${timeAgo(post.createdAt)}
                </span>
              </div>
            </div>
            ${ isOwn
              ? `<button class="post__delete-btn" data-action="delete" title="Deletar post" aria-label="Deletar post">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>`
              : `<button class="post__follow-btn${followingIds.has(author.id) ? ' is-following' : ''}" type="button" data-follow-id="${escapeHtml(author.id)}">${followingIds.has(author.id) ? 'Seguindo' : 'Seguir'}</button>`
            }
          </div>

          ${qaHead}
          <div class="post__content">${parseMarkdown(post.content)}</div>
        </div>

        <div class="post__actions">
          <button class="post__action-btn ${likedClass}" data-action="like">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="${likeFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span><span data-likes-count>${post.likesCount}</span> Curtir</span>
          </button>

          <button class="post__action-btn" data-action="comment">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span><span data-comments-count>${post.commentsCount}</span> Comentar</span>
          </button>

          ${isDuvida ? `<button class="post__action-btn" data-action="answers">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><line x1="7" y1="22" x2="7" y2="11"/></svg>
            <span><span data-answers-count>${post.answersCount || 0}</span> Respostas</span>
          </button>` : ''}

          <button class="post__action-btn" data-action="share">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5"  r="3"/>
              <circle cx="6"  cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Compartilhar</span>
          </button>

          <button class="post__action-btn" data-action="send">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <span>Enviar</span>
          </button>
        </div>

        <!-- Seção de comentários (oculta por padrão) -->
        <div class="post__comments post__comments--hidden" data-comments-section>
          <form class="comment-form" data-comment-form>
            <div class="comment-form__avatar">${avatarInner(currentUser)}</div>
            <input type="text" class="comment-form__input"
              placeholder="Escreva um comentário..." maxlength="1000" required />
            <button type="submit" class="comment-form__submit">Enviar</button>
          </form>
          <div class="comment-list" data-comment-list></div>
        </div>
        ${isDuvida ? `
        <div class="post__answers post__answers--hidden" data-answers-section>
          <form class="answer-form" data-answer-form>
            <div class="answer-form__avatar">${avatarInner(currentUser)}</div>
            <div class="answer-form__main">
              <textarea class="answer-form__input" placeholder="Escreva uma resposta para ajudar..." maxlength="5000" rows="2" required></textarea>
              <button type="submit" class="answer-form__submit">Publicar resposta</button>
            </div>
          </form>
          <div class="answer-list" data-answer-list></div>
        </div>` : ''}
      </article>
    `;
  }

  /* =========================================================
     INTERAÇÕES — like, comment, share, delete
  ========================================================= */
  function attachPostHandlers(article) {
    const postId = article.dataset.postId;

    // CURTIR (toggle)
    article.querySelector('[data-action="like"]').addEventListener('click', async (e) => {
      const btn       = e.currentTarget;
      const countEl   = btn.querySelector('[data-likes-count]');
      const svg       = btn.querySelector('svg');

      try {
        const res = await api(`/api/posts/${postId}/like`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Erro ao curtir.', 'error');
          return;
        }
        countEl.textContent = data.likesCount;
        btn.classList.toggle('post__action-btn--liked', data.liked);
        svg.setAttribute('fill', data.liked ? 'currentColor' : 'none');
      } catch {
        window.showToast('Erro de conexão.', 'error');
      }
    });

    // COMENTAR — mostra/oculta seção
    const commentsSection = article.querySelector('[data-comments-section]');
    const commentList     = article.querySelector('[data-comment-list]');
    let commentsLoaded    = false;

    article.querySelector('[data-action="comment"]').addEventListener('click', async () => {
      const wasHidden = commentsSection.classList.contains('post__comments--hidden');
      commentsSection.classList.toggle('post__comments--hidden');
      const ansSec = article.querySelector('[data-answers-section]');
      if (wasHidden && ansSec) ansSec.classList.add('post__answers--hidden'); // comporta como aba

      if (wasHidden && !commentsLoaded) {
        try {
          const res = await api(`/api/posts/${postId}/comments`);
          const data = await res.json();
          if (res.ok) {
            commentList.innerHTML = data.map(renderComment).join('');
            commentsLoaded = true;
          }
        } catch { /* silencioso */ }
      }
    });

    // Submit comentário
    article.querySelector('[data-comment-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = e.currentTarget.querySelector('input');
      const submit = e.currentTarget.querySelector('button[type="submit"]');
      const content = input.value.trim();
      if (!content) return;

      submit.disabled = true;

      try {
        const res = await api(`/api/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Erro ao comentar.', 'error');
          return;
        }
        commentList.insertAdjacentHTML('beforeend', renderComment(data));
        input.value = '';
        // Atualiza o contador
        const countEl = article.querySelector('[data-comments-count]');
        countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
      } catch {
        window.showToast('Erro de conexão.', 'error');
      } finally {
        submit.disabled = false;
      }
    });

    // COMPARTILHAR (copia link mockado)
    article.querySelector('[data-action="share"]').addEventListener('click', () => {
      navigator.clipboard?.writeText(`${window.location.origin}/pages/feed.html#post-${postId}`);
      window.showToast('Link copiado para a área de transferência!', 'success');
    });

    // ENVIAR (placeholder)
    article.querySelector('[data-action="send"]').addEventListener('click', () => {
      window.showToast('Funcionalidade de mensagem em breve!', 'success');
    });

    // DELETAR (só posts próprios)
    const deleteBtn = article.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja deletar este post?')) return;
        try {
          const res = await api(`/api/posts/${postId}`, { method: 'DELETE' });
          if (!res.ok) {
            window.showToast('Erro ao deletar.', 'error');
            return;
          }
          article.style.transition = 'opacity 0.3s, transform 0.3s';
          article.style.opacity   = '0';
          article.style.transform = 'scale(0.95)';
          setTimeout(() => article.remove(), 300);
          window.showToast('Post deletado.', 'success');
        } catch {
          window.showToast('Erro de conexão.', 'error');
        }
      });
    }

    // Respostas (Q&A) — só age em posts do tipo dúvida (no-op se não houver seção)
    setupAnswers(article, postId);
  }

  function renderComment(c) {
    const author = c.author || { name: 'Usuário' };
    return `
      <div class="comment">
        <div class="comment__avatar">${avatarInner(author)}</div>
        <div class="comment__body">
          <p class="comment__author">
            ${escapeHtml(author.name)}
            <span class="comment__time">• ${timeAgo(c.createdAt)}</span>
          </p>
          <p class="comment__content">${escapeHtml(c.content)}</p>
        </div>
      </div>
    `;
  }

  /* =========================================================
     RESPOSTAS (Q&A) — render + interações
  ========================================================= */
  function answerStars(myRating) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
      s += `<button type="button" class="answer-rate__star${i <= myRating ? ' is-on' : ''}" data-star="${i}" aria-label="${i} estrela${i > 1 ? 's' : ''}">★</button>`;
    }
    return `<span class="answer-rate__stars" data-stars data-selected="${myRating || 0}">${s}</span>`;
  }

  function renderAnswer(a, isAsker) {
    const author = a.author || { name: 'Usuário' };
    const isOwn  = a.isOwn;
    const ratingLabel = a.ratingCount ? `★ ${a.ratingAvg} · ${a.ratingCount} avaliaç${a.ratingCount > 1 ? 'ões' : 'ão'}` : 'Sem avaliações';
    const rateBlock = isOwn ? '' : `
          <div class="answer-rate" data-answer-rate>
            <span class="answer-rate__title">${a.myRating ? 'Sua avaliação' : 'Avalie esta resposta'}</span>
            ${answerStars(a.myRating)}
            <input type="text" class="answer-rate__comment" data-rate-comment maxlength="500" placeholder="Observação (opcional) — o que faltou?" value="${escapeHtml(a.myComment || '')}" />
            <button type="button" class="answer-rate__submit" data-rate-submit>${a.myRating ? 'Atualizar' : 'Enviar'}</button>
          </div>`;
    return `
      <div class="answer${a.isBest ? ' answer--best' : ''}" data-answer-id="${escapeHtml(a.id)}">
        <div class="answer__avatar">${avatarInner(author)}</div>
        <div class="answer__main">
          <div class="answer__head">
            <span class="answer__author post__author--link" data-profile-id="${escapeHtml(author.id || '')}" role="link" tabindex="0">${escapeHtml(author.name)}</span>
            <span class="answer__time">• ${timeAgo(a.createdAt)}</span>
            ${a.isBest ? '<span class="answer__best-badge">🏅 Melhor resposta</span>' : ''}
            <span class="answer__rating" data-answer-rating>${ratingLabel}</span>
          </div>
          <div class="answer__content">${parseMarkdown(a.content)}</div>
          <div class="answer__foot">
            <button type="button" class="answer__util${a.helpfulByMe ? ' is-on' : ''}" data-util${isOwn ? ' disabled title="Você não pode marcar a própria resposta"' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              Útil <span data-util-count>${a.helpfulCount}</span>
            </button>
            ${isAsker ? `<button type="button" class="answer__best-btn${a.isBest ? ' is-on' : ''}" data-best>${a.isBest ? 'Desmarcar melhor' : 'Marcar como melhor'}</button>` : ''}
            ${isOwn ? '<button type="button" class="answer__delete" data-answer-delete>Excluir</button>' : ''}
          </div>
          ${rateBlock}
        </div>
      </div>`;
  }

  function updatePostStatus(article, status) {
    const el = article.querySelector('.post__status');
    if (!el) return;
    const resolved = status === 'resolvida';
    el.classList.toggle('post__status--resolvida', resolved);
    el.classList.toggle('post__status--aberta', !resolved);
    el.textContent = resolved ? 'Resolvida' : 'Aberta';
  }

  function setupAnswers(article, postId) {
    const section = article.querySelector('[data-answers-section]');
    if (!section) return;
    const list = section.querySelector('[data-answer-list]');
    const btn  = article.querySelector('[data-action="answers"]');
    let loaded = false;
    let isAsker = false;

    async function loadAnswers() {
      try {
        const res = await api(`/api/posts/${postId}/answers`);
        const data = await res.json();
        if (!res.ok) return;
        isAsker = !!data.isAsker;
        updatePostStatus(article, data.postStatus);
        list.innerHTML = data.answers.length
          ? data.answers.map(a => renderAnswer(a, isAsker)).join('')
          : '<p class="answer-list__empty">Ainda não há respostas. Seja o primeiro a ajudar!</p>';
      } catch { /* silencioso */ }
    }

    if (btn) btn.addEventListener('click', async () => {
      const wasHidden = section.classList.contains('post__answers--hidden');
      section.classList.toggle('post__answers--hidden');
      const cs = article.querySelector('[data-comments-section]');
      if (wasHidden && cs) cs.classList.add('post__comments--hidden'); // comporta como aba
      if (wasHidden && !loaded) { await loadAnswers(); loaded = true; }
    });

    section.querySelector('[data-answer-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = e.currentTarget.querySelector('textarea');
      const submit = e.currentTarget.querySelector('button[type="submit"]');
      const content = ta.value.trim();
      if (!content) return;
      submit.disabled = true;
      try {
        const res = await api(`/api/posts/${postId}/answers`, { method: 'POST', body: JSON.stringify({ content }) });
        const data = await res.json();
        if (!res.ok) { window.showToast(data.error || 'Erro ao responder.', 'error'); return; }
        const empty = list.querySelector('.answer-list__empty'); if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', renderAnswer(data, isAsker));
        ta.value = '';
        const countEl = article.querySelector('[data-answers-count]');
        if (countEl) countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
        window.showToast('Resposta publicada!', 'success');
      } catch { window.showToast('Erro de conexão.', 'error'); }
      finally { submit.disabled = false; }
    });

    list.addEventListener('click', async (e) => {
      const answerEl = e.target.closest('[data-answer-id]');
      if (!answerEl) return;
      const answerId = answerEl.dataset.answerId;

      const star = e.target.closest('[data-star]');
      if (star) {
        const stars = star.closest('[data-stars]');
        const val = parseInt(star.dataset.star, 10);
        stars.dataset.selected = String(val);
        [...stars.querySelectorAll('[data-star]')].forEach(s => s.classList.toggle('is-on', parseInt(s.dataset.star, 10) <= val));
        return;
      }

      const rateSubmit = e.target.closest('[data-rate-submit]');
      if (rateSubmit) {
        const box = answerEl.querySelector('[data-answer-rate]');
        const sel = parseInt(box.querySelector('[data-stars]').dataset.selected, 10) || 0;
        const comment = box.querySelector('[data-rate-comment]').value.trim();
        if (!sel) { window.showToast('Escolha de 1 a 5 estrelas.', 'error'); return; }
        rateSubmit.disabled = true;
        try {
          const res = await api(`/api/answers/${answerId}/rating`, { method: 'POST', body: JSON.stringify({ rating: sel, comment }) });
          const data = await res.json();
          if (!res.ok) { window.showToast(data.error || 'Erro ao avaliar.', 'error'); return; }
          answerEl.querySelector('[data-answer-rating]').textContent = `★ ${data.ratingAvg} · ${data.ratingCount} avaliaç${data.ratingCount > 1 ? 'ões' : 'ão'}`;
          box.querySelector('.answer-rate__title').textContent = 'Sua avaliação';
          rateSubmit.textContent = 'Atualizar';
          window.showToast('Avaliação registrada!', 'success');
        } catch { window.showToast('Erro de conexão.', 'error'); }
        finally { rateSubmit.disabled = false; }
        return;
      }

      const util = e.target.closest('[data-util]');
      if (util) {
        if (util.hasAttribute('disabled')) return;
        try {
          const res = await api(`/api/answers/${answerId}/helpful`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) { window.showToast(data.error || 'Erro.', 'error'); return; }
          util.classList.toggle('is-on', data.helpful);
          util.querySelector('[data-util-count]').textContent = data.helpfulCount;
        } catch { window.showToast('Erro de conexão.', 'error'); }
        return;
      }

      const best = e.target.closest('[data-best]');
      if (best) {
        best.disabled = true;
        try {
          const res = await api(`/api/answers/${answerId}/best`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) { window.showToast(data.error || 'Erro.', 'error'); best.disabled = false; return; }
          await loadAnswers();
          window.showToast(data.isBest ? 'Marcada como melhor resposta! 🏅' : 'Marcação removida.', 'success');
        } catch { window.showToast('Erro de conexão.', 'error'); best.disabled = false; }
        return;
      }

      const del = e.target.closest('[data-answer-delete]');
      if (del) {
        if (!confirm('Excluir esta resposta?')) return;
        try {
          const res = await api(`/api/answers/${answerId}`, { method: 'DELETE' });
          if (!res.ok) { window.showToast('Erro ao excluir.', 'error'); return; }
          answerEl.remove();
          const countEl = article.querySelector('[data-answers-count]');
          if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || '0', 10) - 1);
          if (!list.querySelector('[data-answer-id]')) list.innerHTML = '<p class="answer-list__empty">Ainda não há respostas. Seja o primeiro a ajudar!</p>';
          window.showToast('Resposta excluída.', 'success');
        } catch { window.showToast('Erro de conexão.', 'error'); }
        return;
      }
    });
  }

  /* =========================================================
     LOAD POSTS
  ========================================================= */
  /* ===== Estado do feed (cronológico + pin dos posts da sessão) ===== */
  let feedPosts = [];           // posts atuais (servidor + otimistas do autor)
  const sessionPostIds = [];    // ids criados nesta sessão → fixados no topo (só pro autor, some no F5)
  let displayedIds = new Set(); // ids exibidos (baseline p/ detectar novos)
  let pendingFeed = null;       // feed do polling (carregado ao clicar no botão)

  // Posts da sessão (mais novo primeiro) fixados no topo; depois o restante (sem duplicar).
  function orderedFeed() {
    const byId = new Map();
    feedPosts.forEach(p => { if (p && !byId.has(p.id)) byId.set(p.id, p); });
    const pinned = [];
    sessionPostIds.forEach(id => { if (byId.has(id)) { pinned.push(byId.get(id)); byId.delete(id); } });
    return pinned.concat([...byId.values()]);
  }

  function renderFeed() {
    const container = $('#post-feed');
    const ordered = orderedFeed();
    if (!ordered.length) {
      container.innerHTML = '<div class="post-feed__empty">Nenhuma publicação ainda. Seja o primeiro!</div>';
      displayedIds = new Set();
      return;
    }
    container.innerHTML = ordered.map(renderPost).join('');
    $$('.post', container).forEach(attachPostHandlers);
    displayedIds = new Set(ordered.map(p => p.id));
  }

  async function loadPosts() {
    const container = $('#post-feed');
    try {
      const res = await api('/api/feed/me');
      const data = await res.json();
      if (!res.ok) { container.innerHTML = '<div class="post-feed__empty">Erro ao carregar posts.</div>'; return; }
      feedPosts = data;
      renderFeed();
      hideNewPostsButton();
    } catch {
      container.innerHTML = '<div class="post-feed__empty">Não foi possível carregar o feed. Verifique se o backend está rodando.</div>';
    }
  }

  /* ===== Botão flutuante "Visualizar posts recentes" (estilo X) ===== */
  async function checkNewPosts() {
    try {
      const res = await api('/api/feed/me');
      if (!res.ok) return;
      const data = await res.json();
      pendingFeed = data;
      // posts novos de OUTROS usuários (não exibidos ainda e não meus)
      const novos = data.filter(p => p && !displayedIds.has(p.id) && p.author && p.author.id !== currentUser.id);
      if (novos.length) showNewPostsButton(novos.length); else hideNewPostsButton();
    } catch { /* silencioso */ }
  }
  function showNewPostsButton(count) {
    let btn = document.getElementById('new-posts-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'new-posts-btn';
      btn.type = 'button';
      btn.className = 'new-posts-btn';
      btn.addEventListener('click', () => {
        if (pendingFeed) { feedPosts = pendingFeed; pendingFeed = null; }
        renderFeed();
        hideNewPostsButton();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      document.body.appendChild(btn);
    }
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg><span>Visualizar posts recentes' + (count > 1 ? ' (' + count + ')' : '') + '</span>';
    btn.classList.add('new-posts-btn--show');
  }
  function hideNewPostsButton() {
    const btn = document.getElementById('new-posts-btn');
    if (btn) btn.classList.remove('new-posts-btn--show');
  }

  /* =========================================================
     INIT
  ========================================================= */
  /* ===== MEUS ATALHOS (dinâmico a partir dos interesses + editável) ===== */
  const SHORTCUT_ICON = '<svg class="aside-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
  let shortcutsEditing = false;

  function defaultShortcuts() {
    const interests = Array.isArray(currentUser.interests) ? currentUser.interests : [];
    const fromInterests = interests.slice(0, 6).map(it => ({ label: it, href: '/pages/busca.html?q=' + encodeURIComponent(it) }));
    if (fromInterests.length) return fromInterests;
    return [
      { label: 'Oportunidades', href: '/pages/oportunidades.html' },
      { label: 'Mensagens', href: '/pages/mensagens.html' },
    ];
  }
  function getShortcuts() {
    return Array.isArray(currentUser.shortcuts) ? currentUser.shortcuts : defaultShortcuts();
  }
  function renderShortcuts() {
    const list = $('#shortcuts-list');
    if (!list) return;
    const items = getShortcuts();
    list.innerHTML = items.length ? items.map((s, i) => `
      <div class="aside-nav__row">
        <a href="${escapeHtml(s.href || '#')}" class="aside-nav__link">${SHORTCUT_ICON}<span>${escapeHtml(s.label)}</span></a>
        ${shortcutsEditing ? `<button type="button" class="aside-nav__remove" data-remove="${i}" aria-label="Remover atalho">&times;</button>` : ''}
      </div>`).join('') : '<p class="aside-nav__empty">Sem atalhos. Clique em "Editar" para adicionar.</p>';
  }
  async function saveShortcuts(list) {
    currentUser.shortcuts = list;
    try { localStorage.setItem('orbit_user', JSON.stringify(currentUser)); } catch (e) {}
    try { await api(`/api/users/${currentUser.id}`, { method: 'PATCH', body: JSON.stringify({ shortcuts: list }) }); } catch (e) {}
  }
  function setupShortcuts() {
    renderShortcuts();
    const editBtn = $('#shortcuts-edit');
    const addForm = $('#shortcut-add');
    const input   = $('#shortcut-input');
    const list    = $('#shortcuts-list');
    if (editBtn) editBtn.addEventListener('click', () => {
      shortcutsEditing = !shortcutsEditing;
      editBtn.textContent = shortcutsEditing ? 'Concluir' : 'Editar';
      if (addForm) addForm.hidden = !shortcutsEditing;
      renderShortcuts();
    });
    if (list) list.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (!rm) return;
      e.preventDefault();
      const idx = Number(rm.getAttribute('data-remove'));
      saveShortcuts(getShortcuts().filter((_, i) => i !== idx));
      renderShortcuts();
    });
    if (addForm) addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = (input.value || '').trim();
      if (!label) return;
      saveShortcuts(getShortcuts().concat([{ label, href: '/pages/busca.html?q=' + encodeURIComponent(label) }]));
      input.value = '';
      renderShortcuts();
    });
  }

  (async function init() {
    renderProfileCard();
    setupShortcuts();
    await loadFollowing();   // carrega quem já sigo antes de renderizar os botões
    loadSuggestions();
    loadPosts();
    loadTrending();
  })();

  // Ao voltar para o feed (botão Voltar/bfcache ou retorno de aba), re-busca sugestões
  // + estado de "seguindo": quem você passou a seguir some das sugestões e os botões atualizam.
  let _lastResync = 0;
  function resyncFollowState() {
    const now = Date.now();
    if (now - _lastResync < 1500) return; // evita disparo duplicado (pageshow + visibilitychange)
    _lastResync = now;
    loadFollowing().then(loadSuggestions);
    checkNewPosts(); // checa se há posts novos de outros (mostra o botão flutuante)
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) resyncFollowState(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resyncFollowState(); });

  // Polling em background para detectar novos posts (sem re-renderizar; só mostra o botão)
  setInterval(() => { if (document.visibilityState === 'visible') checkNewPosts(); }, 30000);

})();
