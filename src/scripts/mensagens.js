// mensagens.js — Orbit · Sistema de Mensagens (#1 — Kaio)
// JS puro, sem framework. Backend: JSON Server (endpoints de conversas/mensagens).

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');
  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }
  const currentUser = JSON.parse(userJson);

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }, (options && options.headers) || {}),
    }));
    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  /* ===== ESTADO ===== */
  let conversations = [];
  let activeConvId  = null;
  let lastMsgCount  = 0; // qtd de mensagens renderizadas na conversa aberta (p/ polling)
  let lastSig      = '';                          // assinatura (qtd + recibos + não lidas) p/ re-render
  let openUnread   = { beforeId: null, count: 0 };// divisória "X não lidas" (congelada na abertura)
  let unseenBelow  = 0;                           // contador do botão "ir para recentes"
  let chatSettings = Object.assign({ showStatus: true, readReceipts: true }, currentUser.chatSettings || {});

  function myReceipts() { return chatSettings.readReceipts !== false; }

  // Status do outro participante: {online, text} ou null (se ele ocultou o status)
  function statusInfo(other) {
    if (!other) return null;
    const cs = other.chatSettings || {};
    if (cs.showStatus === false) return null;
    const last = other.lastSeenAt ? new Date(other.lastSeenAt).getTime() : 0;
    if (!last) return null;
    if (Date.now() - last < 70000) return { online: true, text: 'online' };
    return { online: false, text: 'visto por último às ' + fmtTime(other.lastSeenAt) };
  }
  function renderStatus(other) {
    const el = $('#chat-status'); if (!el) return;
    const s = statusInfo(other);
    if (!s) { el.textContent = ''; el.hidden = true; return; }
    el.hidden = false; el.textContent = s.text; el.classList.toggle('is-online', !!s.online);
  }

  // Assinatura do estado das mensagens (muda se chegou msg, alguém leu, ou há não lidas)
  function sigOf(msgs) {
    return msgs.length + ':' +
      msgs.filter(m => m.senderId === currentUser.id && m.readAt).length + ':' +
      msgs.filter(m => m.receiverId === currentUser.id && !m.read).length;
  }
  async function markRead(convId) {
    try { await api(`/api/conversations/${convId}/read`, { method: 'POST' }); } catch (e) { /* silencioso */ }
  }
  function showScrollBtn(count) {
    const b = $('#chat-scroll-btn'); if (!b) return;
    b.hidden = false;
    const badge = $('#chat-scroll-count');
    if (badge) { if (count > 0) { badge.textContent = count; badge.hidden = false; } else { badge.hidden = true; } }
  }
  function hideScrollBtn() {
    const b = $('#chat-scroll-btn'); if (b) b.hidden = true;
    unseenBelow = 0;
    const badge = $('#chat-scroll-count'); if (badge) badge.hidden = true;
  }
  async function saveChatSettings(patch) {
    chatSettings = Object.assign({}, chatSettings, patch);
    currentUser.chatSettings = chatSettings;
    try { localStorage.setItem('orbit_user', JSON.stringify(currentUser)); } catch (e) {}
    try { await api(`/api/users/${currentUser.id}`, { method: 'PATCH', body: JSON.stringify({ chatSettings }) }); } catch (e) {}
    if (activeConvId) { lastSig = ''; refreshActiveMessages(); } // reflete "Visualizada" na hora
  }

  /* ===== RENDER: LISTA DE CONVERSAS ===== */
  function buildConvItem(conv) {
    const other = conv.other || {};
    const preview = conv.lastMessage ? conv.lastMessage.content : 'Sem mensagens ainda';
    const time    = conv.lastMessage ? fmtTime(conv.lastMessage.createdAt) : '';
    const avatar  = other.avatarUrl
      ? `<img src="${escapeHtml(other.avatarUrl)}" alt="${escapeHtml(other.name)}" />`
      : `<span>${initials(other.name)}</span>`;
    const badge = conv.unreadCount > 0
      ? `<span class="msg-conv-item__badge">${conv.unreadCount}</span>` : '';

    return `
      <li class="msg-conv-item ${conv.id === activeConvId ? 'msg-conv-item--active' : ''}" data-conv-id="${escapeHtml(conv.id)}">
        <div class="msg-conv-item__avatar">${avatar}</div>
        <div class="msg-conv-item__body">
          <div class="msg-conv-item__top">
            <span class="msg-conv-item__name">${escapeHtml(other.name || 'Usuário')}</span>
            <span class="msg-conv-item__time">${escapeHtml(time)}</span>
          </div>
          <div class="msg-conv-item__top">
            <span class="msg-conv-item__preview">${escapeHtml(preview)}</span>
            ${badge}
          </div>
        </div>
      </li>`;
  }

  function renderConvList() {
    const list = $('#conv-list');
    const term = ($('#conv-search').value || '').toLowerCase().trim();

    const filtered = conversations.filter(c => {
      if (!term) return true;
      const name = (c.other && c.other.name || '').toLowerCase();
      const last = (c.lastMessage && c.lastMessage.content || '').toLowerCase();
      return name.includes(term) || last.includes(term);
    });

    if (!filtered.length) {
      list.innerHTML = `<li class="msg-loading">Nenhuma conversa encontrada.</li>`;
      return;
    }
    list.innerHTML = filtered.map(buildConvItem).join('');
  }

  /* ===== RENDER: CHAT ===== */
  function buildBubble(msg, showSeen) {
    const mine = msg.senderId === currentUser.id;
    return `
      <div class="msg-bubble ${mine ? 'msg-bubble--me' : 'msg-bubble--them'}">
        ${escapeHtml(msg.content)}
        <span class="msg-bubble__time">${escapeHtml(fmtTime(msg.createdAt))}</span>
        ${showSeen ? '<span class="msg-bubble__seen">✓ Visualizada</span>' : ''}
      </div>`;
  }

  // Monta o histórico: divisória "X não lidas" (congelada na abertura) + bolhas +
  // "Visualizada" apenas na última mensagem MINHA que foi lida (estilo Instagram, mútuo).
  function renderMessages(msgs) {
    let lastSeenIdx = -1;
    if (myReceipts()) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].senderId === currentUser.id && msgs[i].readAt) { lastSeenIdx = i; break; }
      }
    }
    let html = '';
    msgs.forEach((m, i) => {
      if (openUnread.count > 0 && m.id && m.id === openUnread.beforeId) {
        html += `<div class="msg-unread-divider">${openUnread.count} ${openUnread.count > 1 ? 'mensagens não lidas' : 'mensagem não lida'}</div>`;
      }
      html += buildBubble(m, i === lastSeenIdx);
    });
    return html;
  }

  async function openConversation(convId) {
    activeConvId = convId;
    window.orbitActiveConversationId = convId; // sino usa p/ não duplicar toast
    lastMsgCount = 0;
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    // Marca item ativo
    renderConvList();

    // Header
    const other = conv.other || {};
    $('#chat-name').textContent   = other.name || 'Usuário';
    $('#chat-initials').textContent = initials(other.name);
    const avatarEl = $('#chat-avatar');
    if (other.avatarUrl) {
      avatarEl.innerHTML = `<img src="${escapeHtml(other.avatarUrl)}" alt="${escapeHtml(other.name)}" />`;
    } else {
      avatarEl.innerHTML = `<span>${initials(other.name)}</span>`;
    }
    renderStatus(other); // online / visto por último / oculto

    // Alterna visões
    $('#chat-empty').hidden  = true;
    $('#chat-active').hidden = false;
    $('.msg-main').setAttribute('data-view', 'chat');
    document.body.classList.add('msg-in-chat'); // mobile: esconde o hambúrguer enquanto vê a conversa

    // Carrega histórico
    const history = $('#chat-history');
    history.innerHTML = `<div class="msg-loading">Carregando mensagens...</div>`;
    try {
      const res = await api(`/api/conversations/${convId}/messages`);
      const msgs = await res.json();
      // congela a divisória "X não lidas" (na primeira mensagem recebida não lida)
      const firstUnread = msgs.find(m => m.receiverId === currentUser.id && !m.read);
      openUnread = { beforeId: firstUnread ? firstUnread.id : null, count: msgs.filter(m => m.receiverId === currentUser.id && !m.read).length };
      history.innerHTML = renderMessages(msgs);
      lastMsgCount = msgs.length;
      lastSig = sigOf(msgs);
      hideScrollBtn();
      history.scrollTop = history.scrollHeight;
      markRead(convId); // marca recebidas como lidas (zera contador; recibo se confirmação ativa)
    } catch (err) {
      if (err.message !== 'Token expirado') {
        history.innerHTML = `<div class="msg-loading">Não foi possível carregar as mensagens.</div>`;
      }
    }
  }

  /* ===== TEMPO REAL: atualiza mensagens da conversa aberta ===== */
  async function refreshActiveMessages() {
    if (!activeConvId) return;
    try {
      const res = await api(`/api/conversations/${activeConvId}/messages`);
      if (!res.ok) return;
      const msgs = await res.json();
      const sig = sigOf(msgs);
      if (sig === lastSig) return; // nada mudou (qtd, recibos de leitura ou não lidas)
      const history = $('#chat-history');
      if (!history) return;
      const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
      const grew = msgs.length - lastMsgCount;
      const hasIncomingUnread = msgs.some(m => m.receiverId === currentUser.id && !m.read);
      history.innerHTML = renderMessages(msgs);
      lastMsgCount = msgs.length;
      lastSig = sig;
      if (nearBottom) {
        history.scrollTop = history.scrollHeight;
        hideScrollBtn();
        if (hasIncomingUnread) markRead(activeConvId); // li (estou no fim) → marca lida
      } else if (grew > 0) {
        unseenBelow += grew;                            // chegou msg e estou rolado pra cima
        showScrollBtn(unseenBelow);
      }
    } catch (err) {
      /* silencioso (ex.: token expirado já trata redirect) */
    }
  }

  /* ===== TEMPO REAL: ciclo de polling (lista + conversa aberta) ===== */
  async function pollRealtime() {
    await loadConversations();
    if (activeConvId) {
      const conv = conversations.find(c => c.id === activeConvId);
      if (conv) renderStatus(conv.other); // atualiza online / visto por último
    }
    await refreshActiveMessages();
  }

  /* ===== ENVIO ===== */
  async function sendMessage(ev) {
    ev.preventDefault();
    const input = $('#chat-input');
    const content = input.value.trim();
    if (!content || !activeConvId) return;

    input.value = '';
    const history = $('#chat-history');

    // Otimista: adiciona bolha localmente
    const optimistic = { senderId: currentUser.id, content, createdAt: new Date().toISOString() };
    history.insertAdjacentHTML('beforeend', buildBubble(optimistic));
    history.scrollTop = history.scrollHeight;

    try {
      const res = await api(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('falha');
      // Atualiza preview na lista e reconcilia o histórico com o servidor
      await loadConversations();
      await refreshActiveMessages();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        toast('Não foi possível enviar a mensagem.', 'error');
      }
    }
  }

  /* ===== CARGA ===== */
  async function loadConversations() {
    try {
      const res = await api('/api/conversations/me');
      conversations = await res.json();
      renderConvList();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#conv-list').innerHTML = `<li class="msg-loading">Não foi possível carregar as conversas.</li>`;
      }
    }
  }

  /* ===== MODAL: NOVA CONVERSA (conexões) ===== */
  let connections = [];

  function relationLabel(rel) {
    if (!rel) return '';
    if (rel.following && rel.followsMe) return 'Vocês se seguem';
    if (rel.following) return 'Você segue';
    if (rel.followsMe) return 'Segue você';
    return '';
  }

  function renderConnList() {
    const list = $('#conn-list');
    const term = ($('#conn-search').value || '').toLowerCase().trim();
    const filtered = connections.filter(u => !term || (u.name || '').toLowerCase().includes(term));

    if (!filtered.length) {
      list.innerHTML = `<li class="msg-loading">${connections.length ? 'Nenhuma conexão encontrada.' : 'Você ainda não tem conexões. Siga pessoas no feed para conversar.'}</li>`;
      return;
    }

    list.innerHTML = filtered.map(u => {
      const avatar = u.avatarUrl
        ? `<img src="${escapeHtml(u.avatarUrl)}" alt="${escapeHtml(u.name)}" />`
        : `<span>${initials(u.name)}</span>`;
      return `
        <li>
          <button type="button" class="msg-conn-item" data-user-id="${escapeHtml(u.id)}">
            <span class="msg-conn-item__avatar">${avatar}</span>
            <span class="msg-conn-item__body">
              <span class="msg-conn-item__name">${escapeHtml(u.name)}</span>
              <span class="msg-conn-item__rel">${escapeHtml(relationLabel(u.relation))}</span>
            </span>
          </button>
        </li>`;
    }).join('');
  }

  async function openModal() {
    $('#new-conv-modal').hidden = false;
    $('#conn-search').value = '';
    $('#conn-list').innerHTML = `<li class="msg-loading">Carregando conexões...</li>`;
    setTimeout(() => $('#conn-search').focus(), 50);
    try {
      const res = await api('/api/connections/me');
      connections = await res.json();
      renderConnList();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#conn-list').innerHTML = `<li class="msg-loading">Não foi possível carregar as conexões.</li>`;
      }
    }
  }

  function closeModal() {
    $('#new-conv-modal').hidden = true;
  }

  async function startConversation(targetUserId) {
    try {
      const res = await api('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Não foi possível iniciar a conversa.', 'error');
        return;
      }
      closeModal();
      // Recarrega a lista e abre a conversa (nova ou existente)
      await loadConversations();
      openConversation(data.id);
    } catch (err) {
      if (err.message !== 'Token expirado') {
        toast('Não foi possível iniciar a conversa.', 'error');
      }
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#conv-search').addEventListener('input', renderConvList);
    $('#chat-composer').addEventListener('submit', sendMessage);

    $('#conv-list').addEventListener('click', (ev) => {
      const item = ev.target.closest('[data-conv-id]');
      if (!item) return;
      openConversation(item.getAttribute('data-conv-id'));
    });

    // Modal nova conversa
    $('#btn-new-conversation').addEventListener('click', openModal);
    $('#new-conv-close').addEventListener('click', closeModal);
    $('#new-conv-overlay').addEventListener('click', closeModal);
    $('#conn-search').addEventListener('input', renderConnList);
    $('#conn-list').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-user-id]');
      if (!btn) return;
      startConversation(btn.getAttribute('data-user-id'));
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !$('#new-conv-modal').hidden) closeModal();
    });

    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });

    // Configurações do chat (mostrar status + confirmação de leitura)
    const setBtn = $('#btn-chat-settings');
    const setPanel = $('#chat-settings-panel');
    if (setBtn && setPanel) {
      const cb1 = $('#set-show-status'), cb2 = $('#set-read-receipts');
      if (cb1) cb1.checked = chatSettings.showStatus !== false;
      if (cb2) cb2.checked = chatSettings.readReceipts !== false;
      setBtn.addEventListener('click', (e) => { e.stopPropagation(); setPanel.hidden = !setPanel.hidden; });
      document.addEventListener('click', (e) => {
        if (!setPanel.hidden && !setPanel.contains(e.target) && !setBtn.contains(e.target)) setPanel.hidden = true;
      });
      if (cb1) cb1.addEventListener('change', (e) => saveChatSettings({ showStatus: e.target.checked }));
      if (cb2) cb2.addEventListener('change', (e) => saveChatSettings({ readReceipts: e.target.checked }));
    }

    // Botão "ir para mensagens recentes" + listener de scroll do histórico
    const scrollBtn = $('#chat-scroll-btn');
    if (scrollBtn) scrollBtn.addEventListener('click', () => {
      const h = $('#chat-history'); if (h) h.scrollTop = h.scrollHeight;
      hideScrollBtn();
      if (activeConvId) markRead(activeConvId);
    });
    const hist = $('#chat-history');
    if (hist) hist.addEventListener('scroll', () => {
      const nearBottom = hist.scrollHeight - hist.scrollTop - hist.clientHeight < 80;
      if (nearBottom) { hideScrollBtn(); if (activeConvId) markRead(activeConvId); }
      else { showScrollBtn(unseenBelow); } // visível quando rolado pra cima (badge só se houver novas)
    });

    // Botão "voltar" (mobile): retorna à lista de conversas para escolher outra
    const backBtn = $('#chat-back');
    if (backBtn) backBtn.addEventListener('click', () => {
      $('.msg-main').setAttribute('data-view', 'list');
      document.body.classList.remove('msg-in-chat');
    });
  }

  /* ===== INIT ===== */
  async function init() {
    setupEvents();
    $('.msg-main').setAttribute('data-view', 'list'); // mobile: começa mostrando a lista
    await loadConversations();

    // Deep-link: ?c=<idConversa> abre a conversa indicada (vindo do perfil/notificação)
    const params   = new URLSearchParams(window.location.search);
    const deepLink = params.get('c');
    if (deepLink && conversations.some(c => c.id === deepLink)) {
      openConversation(deepLink);
    } else if (conversations.length && window.innerWidth > 680) {
      // Abre a primeira conversa automaticamente (desktop)
      openConversation(conversations[0].id);
    }

    // Tempo real: atualiza a cada 0,5s (lista de conversas + conversa aberta)
    setInterval(pollRealtime, 500);
  }

  init();

})();
