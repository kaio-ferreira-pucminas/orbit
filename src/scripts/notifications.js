// notifications.js — Orbit · Sistema de Notificações (#11 — Tiago)
// Componente transversal: sino + dropdown, presente em qualquer tela que inclua
// o markup #orbit-notif. Consome /api/notifications/me e /api/notifications/read.
// JS puro, sem framework.

(function () {
  'use strict';

  const root = document.getElementById('orbit-notif');
  if (!root) return; // tela sem o componente

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('orbit_token');
  if (!token) return;

  /* ===== HELPERS ===== */
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }
  function initials(name) {
    if (!name) return '•';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function avatarHtml(actor) {
    if (actor && actor.avatarUrl) {
      return `<span class="orbit-notif__avatar"><img src="${escapeHtml(actor.avatarUrl)}" alt="${escapeHtml(actor.name || '')}" /></span>`;
    }
    return `<span class="orbit-notif__avatar">${escapeHtml(actor ? initials(actor.name) : '•')}</span>`;
  }

  /* ── Injeta os estilos extras do dropdown (avatar + item clicável) uma vez ──
     Mantém o componente robusto em qualquer tela, sem depender do CSS da página. */
  function ensureStyles() {
    if (document.getElementById('orbit-notif-extra-style')) return;
    const css = `
      .orbit-notif__item{align-items:center;}
      .orbit-notif__avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;background:var(--lighter-purple,#e2e7ff);color:var(--primary,#4648d4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;overflow:hidden;}
      .orbit-notif__avatar img{width:100%;height:100%;object-fit:cover;}
      .orbit-notif__item--link{cursor:pointer;}
      .orbit-notif__item--link:hover{background:rgba(70,72,212,.06);}
    `;
    const style = document.createElement('style');
    style.id = 'orbit-notif-extra-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
  ensureStyles();
  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, (options && options.headers) || {}),
    }));
    if (res.status === 401) throw new Error('Token expirado');
    return res;
  }

  /* ===== ELEMENTOS ===== */
  const btn   = document.getElementById('notif-btn');
  const badge = document.getElementById('notif-badge');
  let dropdown = null;
  let items = [];
  let open = false;

  /* ===== RENDER ===== */
  function renderBadge(unread) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function buildDropdown() {
    const unread = items.filter(n => !n.read).length;
    const list = items.length
      ? items.map(n => {
          const linkAttrs = n.link ? ` data-link="${escapeHtml(n.link)}" role="button" tabindex="0"` : '';
          return `
          <div class="orbit-notif__item ${n.read ? '' : 'orbit-notif__item--unread'} ${n.link ? 'orbit-notif__item--link' : ''}"${linkAttrs}>
            ${avatarHtml(n.actor)}
            <div class="orbit-notif__body">
              <p class="orbit-notif__msg">${escapeHtml(n.message)}</p>
              <p class="orbit-notif__time">${escapeHtml(timeAgo(n.createdAt))}</p>
            </div>
          </div>`;
        }).join('')
      : `<div class="orbit-notif__empty">Você não tem notificações.</div>`;

    return `
      <div class="orbit-notif__dropdown" id="notif-dropdown" role="menu">
        <div class="orbit-notif__header">
          <span class="orbit-notif__title">Notificações</span>
          ${unread > 0 ? `<button type="button" class="orbit-notif__mark" id="notif-mark">Marcar todas como lidas</button>` : ''}
        </div>
        <div class="orbit-notif__list">${list}</div>
      </div>`;
  }

  function openDropdown() {
    if (open) return;
    root.insertAdjacentHTML('beforeend', buildDropdown());
    dropdown = document.getElementById('notif-dropdown');
    btn.setAttribute('aria-expanded', 'true');
    open = true;
    const mark = document.getElementById('notif-mark');
    if (mark) mark.addEventListener('click', markAllRead);
    // Ao abrir o menu, as notificações são consideradas lidas.
    if (items.some(n => !n.read)) markAllRead();
  }

  function closeDropdown() {
    if (!open) return;
    if (dropdown) dropdown.remove();
    dropdown = null;
    btn.setAttribute('aria-expanded', 'false');
    open = false;
  }

  /* ===== AÇÕES ===== */
  async function markAllRead() {
    try {
      const res = await api('/api/notifications/read', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      items = items.map(n => ({ ...n, read: true }));
      renderBadge(data.unreadCount != null ? data.unreadCount : 0);
      // re-renderiza o dropdown aberto para refletir o estado lido (sem o botão "marcar")
      if (open && dropdown) { dropdown.remove(); root.insertAdjacentHTML('beforeend', buildDropdown()); dropdown = document.getElementById('notif-dropdown'); }
    } catch { /* silencioso */ }
  }

  /* ===== TOAST de notificações novas ===== */
  // Tipos que geram alerta visual (toast) automático
  const TOAST_TYPES = { new_follower: true, new_message: true };
  let seenIds = null; // ids já conhecidos; null = primeira carga (não notifica histórico)

  function notifyNew(list) {
    if (seenIds === null) {
      // primeira execução: registra o estado atual sem disparar toasts antigos
      seenIds = new Set(list.map(n => n.id));
      return;
    }
    // dispara toast para notificações novas (não vistas) e ainda não lidas
    const fresh = list.filter(n => !seenIds.has(n.id) && !n.read && TOAST_TYPES[n.type]);
    fresh.forEach(n => {
      // evita toast redundante: a conversa da mensagem já está aberta na tela
      if (n.type === 'new_message' && n.conversationId && n.conversationId === window.orbitActiveConversationId) return;
      if (window.showToast) window.showToast(n.message, 'info');
    });
    list.forEach(n => seenIds.add(n.id));
  }

  async function load() {
    try {
      const res = await api('/api/notifications/me');
      const data = await res.json();
      const list = (data.notifications || []).slice(0, 20);
      notifyNew(list);
      items = list;
      renderBadge(data.unreadCount || 0);
      // se o dropdown estiver aberto, mantém atualizado
      if (open && dropdown) { dropdown.remove(); root.insertAdjacentHTML('beforeend', buildDropdown()); dropdown = document.getElementById('notif-dropdown'); const m = document.getElementById('notif-mark'); if (m) m.addEventListener('click', markAllRead); }
    } catch { /* silencioso (ex: token expirado) */ }
  }

  /* ===== EVENTOS ===== */
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (open) closeDropdown(); else openDropdown();
  });
  document.addEventListener('click', (ev) => {
    if (open && !root.contains(ev.target)) closeDropdown();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeDropdown(); });

  // Clique/Enter em um item com destino navega (perfil do seguidor ou conversa)
  function followItemLink(ev) {
    const item = ev.target.closest('[data-link]');
    if (!item || !root.contains(item)) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.type === 'keydown') ev.preventDefault();
    const link = item.getAttribute('data-link');
    if (link) window.location.href = link;
  }
  root.addEventListener('click', followItemLink);
  root.addEventListener('keydown', followItemLink);

  // rotina: atualiza a cada 10s (polling leve) — detecta novos seguidores/mensagens
  load();
  setInterval(load, 10000);

  // expõe para outras telas dispararem refresh se quiserem
  window.orbitRefreshNotifications = load;

})();
