// notifications.js — Orbit · Sistema de Notificações (#11 — Tiago)
// Componente transversal: sino + dropdown + TOAST em tempo real.
// - O sino/badge/dropdown aparecem nas telas que incluem o markup #orbit-notif
//   (botão #notif-btn + span #notif-badge).
// - Os TOASTS de notificações novas funcionam em QUALQUER tela com sessão, MESMO
//   sem o sino (ex.: dashboards) — assim o usuário é alertado em tempo real.
// Consome /api/notifications/me e /api/notifications/read.
// JS puro, sem framework, AUTOSSUFICIENTE (injeta o próprio CSS do dropdown).

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('orbit_token');
  if (!token) return; // sem sessão → nada a notificar

  // Markup do sino é OPCIONAL. Sem ele, mantemos só os toasts em tempo real.
  const root = document.getElementById('orbit-notif');

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

  /* ── CSS do componente (injetado uma vez, só quando há sino na tela) ──
     Torna o sino/dropdown autossuficiente em QUALQUER tela (inclusive as
     dashboards, que não carregam o header.js). */
  function ensureStyles() {
    if (document.getElementById('orbit-notif-style')) return;
    const css = `
      .orbit-notif{position:relative;}
      .orbit-notif__btn{position:relative;}
      .orbit-notif__badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(239,68,68,.45);pointer-events:none;}
      .orbit-notif__badge[hidden]{display:none;}
      .orbit-notif__dropdown{position:absolute;top:calc(100% + 8px);right:0;width:320px;max-height:420px;background:#fff;border:1px solid #e2e7ff;border-radius:12px;box-shadow:0 12px 32px rgba(19,27,46,.18);z-index:300;display:flex;flex-direction:column;overflow:hidden;}
      .orbit-notif__header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e7ff;}
      .orbit-notif__title{font-family:'Manrope','Inter',sans-serif;font-weight:800;font-size:15px;color:#131b2e;}
      .orbit-notif__mark{font-size:12px;font-weight:700;color:#4648d4;background:none;border:none;cursor:pointer;}
      .orbit-notif__mark:hover{opacity:.75;}
      .orbit-notif__list{overflow-y:auto;display:flex;flex-direction:column;}
      .orbit-notif__item{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #e2e7ff;align-items:center;}
      .orbit-notif__item--unread{background:rgba(70,72,212,.04);}
      .orbit-notif__item--link{cursor:pointer;}
      .orbit-notif__item--link:hover{background:rgba(70,72,212,.06);}
      .orbit-notif__avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;background:#e2e7ff;color:#4648d4;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;overflow:hidden;}
      .orbit-notif__avatar img{width:100%;height:100%;object-fit:cover;}
      .orbit-notif__body{flex:1;min-width:0;}
      .orbit-notif__msg{font-size:13px;color:#131b2e;line-height:18px;margin:0;}
      .orbit-notif__time{font-size:11px;color:#464554;margin:2px 0 0;}
      .orbit-notif__empty{padding:24px 16px;text-align:center;font-size:13px;color:#464554;}
      @media (max-width:680px){.orbit-notif__dropdown{position:fixed;top:60px;left:8px;right:8px;width:auto;max-height:72vh;}}
    `;
    const style = document.createElement('style');
    style.id = 'orbit-notif-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
  if (root) ensureStyles();

  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, (options && options.headers) || {}),
    }));
    if (res.status === 401) throw new Error('Token expirado');
    return res;
  }

  /* ===== ELEMENTOS (podem não existir se a tela não tiver o sino) ===== */
  const btn   = document.getElementById('notif-btn');
  const badge = document.getElementById('notif-badge');
  let dropdown = null;
  let items = [];
  let open = false;

  /* ===== RENDER ===== */
  function renderBadge(unread) {
    if (!badge) return;
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
    if (open || !root || !btn) return;
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
    if (btn) btn.setAttribute('aria-expanded', 'false');
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
      if (open && dropdown && root) { dropdown.remove(); root.insertAdjacentHTML('beforeend', buildDropdown()); dropdown = document.getElementById('notif-dropdown'); }
    } catch { /* silencioso */ }
  }

  /* ===== TOAST de notificações novas ===== */
  // Tipos que geram alerta visual (toast) automático
  const TOAST_TYPES = {
    new_follower: true, new_message: true, new_like: true, new_comment: true,
    reminder: true, interview_scheduled: true, interview_updated: true,
    interview_canceled: true, interview_reschedule_request: true,
  };
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
      if (open && dropdown && root) { dropdown.remove(); root.insertAdjacentHTML('beforeend', buildDropdown()); dropdown = document.getElementById('notif-dropdown'); const m = document.getElementById('notif-mark'); if (m) m.addEventListener('click', markAllRead); }
    } catch { /* silencioso (ex: token expirado) */ }
  }

  /* ===== EVENTOS (só com o sino presente) ===== */
  function followItemLink(ev) {
    const item = ev.target.closest('[data-link]');
    if (!item || !root || !root.contains(item)) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.type === 'keydown') ev.preventDefault();
    const link = item.getAttribute('data-link');
    if (link) window.location.href = link;
  }

  if (btn) {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (open) closeDropdown(); else openDropdown();
    });
  }
  if (root) {
    document.addEventListener('click', (ev) => { if (open && !root.contains(ev.target)) closeDropdown(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeDropdown(); });
    // Clique/Enter em um item com destino navega (perfil do seguidor ou conversa)
    root.addEventListener('click', followItemLink);
    root.addEventListener('keydown', followItemLink);
  }

  // rotina: atualiza a cada 1s — detecta novas notificações quase em tempo real
  load();
  setInterval(load, 1000);

  // expõe para outras telas dispararem refresh se quiserem
  window.orbitRefreshNotifications = load;

})();
