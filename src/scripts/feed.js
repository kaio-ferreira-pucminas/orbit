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
    setAvatar($('#header-avatar-btn'),     currentUser.avatarUrl, currentUser.name, '#header-avatar-initials');
    setAvatar($('.user-menu__avatar'),     currentUser.avatarUrl, currentUser.name, '#user-menu-initials');

    $('#user-menu-name').textContent  = currentUser.name;
    $('#user-menu-email').textContent = currentUser.email;
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
     USER MENU — dropdown do avatar
  ========================================================= */
  const userMenu     = $('#user-menu');
  const avatarBtn    = $('#header-avatar-btn');
  const dropdown     = $('#user-menu-dropdown');
  const profileLink  = $('#user-menu-profile');
  const logoutBtn    = $('#user-menu-logout');

  function openMenu() {
    userMenu.classList.add('user-menu--open');
    avatarBtn.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    userMenu.classList.remove('user-menu--open');
    avatarBtn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
  }

  // Toggle ao clicar no avatar
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.contains('user-menu--open') ? closeMenu() : openMenu();
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) closeMenu();
  });

  // Fecha com Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // "Ir para o perfil" — fecha o dropdown antes de navegar
  profileLink.addEventListener('click', () => closeMenu());

  // "Sair" — limpa token e volta para login
  logoutBtn.addEventListener('click', () => {
    closeMenu();
    localStorage.removeItem('orbit_token');
    localStorage.removeItem('orbit_user');
    window.location.href = '/pages/auth.html?tab=login';
  });

  /* =========================================================
     SUGESTÕES (mock estático com base nos seeds)
  ========================================================= */
  async function loadSuggestions() {
    try {
      const res   = await api('/api/users');
      if (!res.ok) return;

      const users = await res.json();
      const suggestions = users
        .filter(u => u.id !== currentUser.id && !u.disabledAt)
        .slice(0, 3);

      const container = $('#suggestions-list');
      container.innerHTML = suggestions.map(u => `
        <div class="suggestion">
          <div class="suggestion__user suggestion__user--link" data-profile-id="${escapeHtml(u.id || '')}" role="link" tabindex="0" title="Ver perfil de ${escapeHtml(u.name || '')}">
            <div class="suggestion__avatar">${avatarInner(u)}</div>
            <div class="suggestion__info">
              <p class="suggestion__name">${escapeHtml(u.name)}</p>
              <p class="suggestion__title">${escapeHtml(u.title || 'Desenvolvedor(a)')}</p>
            </div>
          </div>
          <button class="suggestion__follow-btn" type="button" data-follow-id="${escapeHtml(u.id)}"
            aria-label="Seguir ${escapeHtml(u.name)}" title="Seguir">
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
      // Atualiza estado visual do botão
      btn.classList.toggle('is-following', !!data.following);
      if (btn.classList.contains('suggestion__follow-btn')) {
        btn.setAttribute('title', data.following ? 'Seguindo' : 'Seguir');
      } else {
        btn.textContent = data.following ? 'Seguindo' : 'Seguir';
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
  }

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
    if (!content) {
      window.showToast('Escreva algo antes de publicar.', 'error');
      return;
    }

    composerSubmit.disabled = true;
    composerSubmit.textContent = 'Publicando...';

    try {
      const res = await api('/api/posts', {
        method: 'POST',
        body:   JSON.stringify({ content }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Erro ao publicar.', 'error');
        return;
      }

      window.showToast('Publicação criada!', 'success');
      collapseComposer();
      // Adiciona o post novo no topo do feed sem refetch
      $('#post-feed').insertAdjacentHTML('afterbegin', renderPost(data));
      attachPostHandlers($('#post-feed').firstElementChild);

    } catch {
      window.showToast('Erro de conexão. Verifique se o backend está rodando.', 'error');
    } finally {
      composerSubmit.disabled  = false;
      composerSubmit.textContent = 'Publicar';
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

    return `
      <article class="post" data-post-id="${post.id}">
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
              : `<button class="post__follow-btn" type="button" data-follow-id="${escapeHtml(author.id)}">Seguir</button>`
            }
          </div>

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
     LOAD POSTS
  ========================================================= */
  async function loadPosts() {
    const container = $('#post-feed');
    try {
      const res = await api('/api/posts');
      const data = await res.json();
      if (!res.ok) {
        container.innerHTML = '<div class="post-feed__empty">Erro ao carregar posts.</div>';
        return;
      }
      if (data.length === 0) {
        container.innerHTML = '<div class="post-feed__empty">Nenhuma publicação ainda. Seja o primeiro!</div>';
        return;
      }
      container.innerHTML = data.map(renderPost).join('');
      $$('.post', container).forEach(attachPostHandlers);
    } catch {
      container.innerHTML = '<div class="post-feed__empty">Não foi possível carregar o feed. Verifique se o backend está rodando.</div>';
    }
  }

  /* =========================================================
     INIT
  ========================================================= */
  renderProfileCard();
  loadSuggestions();
  loadPosts();

})();
