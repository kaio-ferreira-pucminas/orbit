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
  function buildBubble(msg) {
    const mine = msg.senderId === currentUser.id;
    return `
      <div class="msg-bubble ${mine ? 'msg-bubble--me' : 'msg-bubble--them'}">
        ${escapeHtml(msg.content)}
        <span class="msg-bubble__time">${escapeHtml(fmtTime(msg.createdAt))}</span>
      </div>`;
  }

  async function openConversation(convId) {
    activeConvId = convId;
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

    // Alterna visões
    $('#chat-empty').hidden  = true;
    $('#chat-active').hidden = false;
    $('.msg-main').setAttribute('data-view', 'chat');

    // Carrega histórico
    const history = $('#chat-history');
    history.innerHTML = `<div class="msg-loading">Carregando mensagens...</div>`;
    try {
      const res = await api(`/api/conversations/${convId}/messages`);
      const msgs = await res.json();
      history.innerHTML = msgs.map(buildBubble).join('');
      history.scrollTop = history.scrollHeight;
    } catch (err) {
      if (err.message !== 'Token expirado') {
        history.innerHTML = `<div class="msg-loading">Não foi possível carregar as mensagens.</div>`;
      }
    }
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
      // Atualiza preview na lista
      await loadConversations();
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

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#conv-search').addEventListener('input', renderConvList);
    $('#chat-composer').addEventListener('submit', sendMessage);

    $('#conv-list').addEventListener('click', (ev) => {
      const item = ev.target.closest('[data-conv-id]');
      if (!item) return;
      openConversation(item.getAttribute('data-conv-id'));
    });

    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== INIT ===== */
  async function init() {
    setupEvents();
    await loadConversations();
    // Abre a primeira conversa automaticamente (desktop)
    if (conversations.length && window.innerWidth > 680) {
      openConversation(conversations[0].id);
    }
  }

  init();

})();
