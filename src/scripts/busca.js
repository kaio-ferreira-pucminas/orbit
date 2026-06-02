// busca.js — Orbit · Página de resultados da busca global
// Tabs: Posts (padrão) · Pessoas · Empresas · Vagas. JS puro.

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token = localStorage.getItem('orbit_token');
  if (!token) { window.location.href = '/pages/auth.html?tab=login'; return; }

  /* ===== HELPERS ===== */
  function $(s, r) { return (r || document).querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function avatarInner(u) {
    if (u && u.avatarUrl) return `<img src="${escapeHtml(u.avatarUrl)}" alt="${escapeHtml(u.name || '')}" />`;
    return escapeHtml(initials(u && u.name));
  }
  function snippet(text, n) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, n); }
  async function api(path) {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/pages/auth.html?tab=login'; throw new Error('401'); }
    return res;
  }

  /* ===== ESTADO ===== */
  let data = { people: [], companies: [], jobs: [], posts: [] };
  let activeTab = 'posts'; // Posts é a tab padrão

  /* ===== RENDER POR CATEGORIA ===== */
  function chips(arr) {
    return (arr || []).slice(0, 5).map(s => `<span class="res-chip">${escapeHtml(s)}</span>`).join('');
  }
  function cardPost(p) {
    const a = p.author || { name: 'Usuário' };
    return `<a class="res-card" href="/pages/feed.html">
      <span class="res-card__av">${avatarInner(a)}</span>
      <span class="res-card__body">
        <span class="res-card__title">${escapeHtml(a.name || 'Usuário')}</span>
        <span class="res-card__meta">${escapeHtml(a.title || 'Desenvolvedor(a)')}</span>
        <span class="res-card__text">${escapeHtml(snippet(p.content, 180))}</span>
        <span class="res-card__post-meta"><span>❤ ${p.likesCount || 0}</span><span>💬 ${p.commentsCount || 0}</span></span>
      </span>
    </a>`;
  }
  function cardPerson(u) {
    return `<a class="res-card" href="/pages/perfil-publico.html?id=${encodeURIComponent(u.id)}">
      <span class="res-card__av">${avatarInner(u)}</span>
      <span class="res-card__body">
        <span class="res-card__title">${escapeHtml(u.name)}</span>
        <span class="res-card__sub">${escapeHtml(u.title || 'Desenvolvedor(a)')}</span>
        ${u.headline ? `<span class="res-card__meta">${escapeHtml(u.headline)}</span>` : ''}
        <span class="res-card__chips">${chips(u.skills)}</span>
      </span>
    </a>`;
  }
  function cardCompany(c) {
    return `<a class="res-card" href="/pages/empresa-perfil.html?id=${encodeURIComponent(c.id)}">
      <span class="res-card__av">${escapeHtml(c.logoInitials || initials(c.name))}</span>
      <span class="res-card__body">
        <span class="res-card__title">${escapeHtml(c.name)}</span>
        <span class="res-card__sub">${escapeHtml(c.industry || 'Empresa')}</span>
        <span class="res-card__meta">${escapeHtml(c.location || '')}</span>
        ${c.about ? `<span class="res-card__text">${escapeHtml(snippet(c.about, 160))}</span>` : ''}
      </span>
    </a>`;
  }
  function cardJob(j) {
    const meta = [j.level, j.modality, j.location].filter(Boolean).join(' · ');
    return `<a class="res-card" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(j.id)}">
      <span class="res-card__av res-card__av--job">💼</span>
      <span class="res-card__body">
        <span class="res-card__title">${escapeHtml(j.title)}</span>
        <span class="res-card__sub">${escapeHtml(j.companyName || '')}</span>
        <span class="res-card__meta">${escapeHtml(meta)}${j.salaryRange ? ' · ' + escapeHtml(j.salaryRange) : ''}</span>
        <span class="res-card__chips">${chips(j.skills)}</span>
      </span>
    </a>`;
  }

  const RENDERERS = {
    posts:     { list: () => data.posts,     card: cardPost,    label: 'post' },
    people:    { list: () => data.people,    card: cardPerson,  label: 'pessoa' },
    companies: { list: () => data.companies, card: cardCompany, label: 'empresa' },
    jobs:      { list: () => data.jobs,      card: cardJob,     label: 'vaga' },
  };

  function renderActive() {
    const r = RENDERERS[activeTab];
    const list = r.list();
    const box = $('#busca-results');
    box.innerHTML = list.length
      ? list.map(r.card).join('')
      : `<p class="busca-empty">Nenhum resultado em "${escapeHtml(tabLabel(activeTab))}" para esta busca.</p>`;
  }
  function tabLabel(tab) {
    return { posts: 'Posts', people: 'Pessoas', companies: 'Empresas', jobs: 'Vagas' }[tab] || tab;
  }

  function updateCounts() {
    $('#count-posts').textContent     = data.posts.length;
    $('#count-people').textContent    = data.people.length;
    $('#count-companies').textContent = data.companies.length;
    $('#count-jobs').textContent      = data.jobs.length;
  }

  // Ativa uma tab (atualiza classe + renderiza)
  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.busca-tab').forEach(b =>
      b.classList.toggle('busca-tab--active', b.getAttribute('data-tab') === tab));
    renderActive();
  }

  // Seleciona a 1ª tab (na ordem) que tiver resultado; se todas vazias, Posts
  function autoSelectTab() {
    const order = ['posts', 'people', 'companies', 'jobs'];
    setActiveTab(order.find(t => RENDERERS[t].list().length > 0) || 'posts');
  }

  /* ===== BUSCA ===== */
  async function search(q) {
    const summary = $('#busca-summary');
    const box = $('#busca-results');
    if (!q) { summary.textContent = ''; box.innerHTML = '<p class="busca-empty">Digite algo para buscar.</p>'; return; }
    box.innerHTML = '<p class="busca-empty">Buscando…</p>';
    try {
      const res = await api('/api/search?q=' + encodeURIComponent(q));
      const d = await res.json();
      data = { people: d.people || [], companies: d.companies || [], jobs: d.jobs || [], posts: d.posts || [] };
      const total = data.people.length + data.companies.length + data.jobs.length + data.posts.length;
      summary.innerHTML = `<b>${total}</b> resultado(s) para <b>"${escapeHtml(q)}"</b>`;
      updateCounts();
      autoSelectTab(); // ativa a 1ª categoria com resultado
    } catch (e) {
      if (e.message !== '401') box.innerHTML = '<p class="busca-empty">Não foi possível buscar. Verifique a conexão.</p>';
    }
  }

  /* ===== EVENTOS ===== */
  $('#busca-tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.busca-tab');
    if (!btn) return;
    setActiveTab(btn.getAttribute('data-tab'));
  });

  $('#busca-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = $('#busca-input').value.trim();
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    search(q);
  });

  /* ===== INIT ===== */
  (function init() {
    const q = new URLSearchParams(window.location.search).get('q') || '';
    $('#busca-input').value = q;
    search(q);
  })();

})();
