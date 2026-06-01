// meus-projetos.js — Orbit · Gerenciamento de Projetos (#4 — Lucas Bonsucesso)
// JS puro, sem framework. Backend: JSON Server (CRUD /api/projects).

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
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, (options && options.headers) || {}),
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
  let projects = [];

  const GRADIENTS = [
    'linear-gradient(135deg, #131b2e 0%, #4648d4 100%)',
    'linear-gradient(135deg, #1e293b 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #4648d4 0%, #6063ee 100%)',
    'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
  ];
  function gradientFor(id) {
    let h = 0; const s = String(id || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % GRADIENTS.length;
    return GRADIENTS[h];
  }

  function techArray(p) {
    if (Array.isArray(p.technologies)) return p.technologies;
    if (Array.isArray(p.stack)) return p.stack;
    if (typeof p.technologies === 'string') return p.technologies.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }

  function isPublic(p) { return p.isPublic !== false && p.visibility !== 'private'; }

  /* ===== RENDER ===== */
  function buildCard(p) {
    const tech = techArray(p);
    const tags = tech.slice(0, 3).map(t => `<span class="mp-tag">${escapeHtml(t)}</span>`).join('');
    const pub = isPublic(p);
    const grad = p.coverGradient || gradientFor(p.id);

    return `
      <article class="mp-card" data-proj-id="${escapeHtml(p.id)}">
        <div class="mp-card__thumb" style="background:${escapeHtml(grad)}">
          <span class="mp-card__thumb-text">${escapeHtml(p.title || 'Projeto')}</span>
        </div>
        <div class="mp-card__status">
          <div class="mp-card__status-left">
            <span class="mp-card__dot mp-card__dot--${pub ? 'public' : 'private'}"></span>
            <span class="mp-card__status-label">${pub ? 'Público' : 'Privado'}</span>
          </div>
          <div class="mp-card__metrics">
            <span class="mp-card__metric">
              <svg width="13" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${p.views || 0}
            </span>
          </div>
        </div>
        <h3 class="mp-card__title">${escapeHtml(p.title || 'Projeto')}</h3>
        <p class="mp-card__desc">${escapeHtml(p.description || 'Sem descrição.')}</p>
        ${tags ? `<div class="mp-card__tags">${tags}</div>` : ''}
        <div class="mp-card__foot">
          ${p.repoUrl || p.githubUrl
            ? `<a class="mp-card__link" href="${escapeHtml(p.repoUrl || p.githubUrl)}" target="_blank" rel="noopener noreferrer">Ver Detalhes
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
               </a>`
            : `<span></span>`}
          <div class="mp-card__actions">
            <button type="button" class="mp-card__btn" data-action="edit" aria-label="Editar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="mp-card__btn mp-card__btn--danger" data-action="delete" aria-label="Excluir">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  function cardNew() {
    return `
      <button type="button" class="mp-card-new" id="card-new">
        <span class="mp-card-new__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span class="mp-card-new__title">Novo Projeto</span>
        <span class="mp-card-new__text">Transforme sua próxima ideia em realidade hoje mesmo.</span>
      </button>`;
  }

  function applyFilter(list) {
    const f = $('#filter-status').value;
    if (f === 'public') return list.filter(isPublic);
    if (f === 'private') return list.filter(p => !isPublic(p));
    return list;
  }

  function render() {
    const grid = $('#mp-grid');
    const filtered = applyFilter(projects);
    $('#mp-subtitle').textContent = projects.length
      ? `Você possui ${projects.length} projeto${projects.length > 1 ? 's' : ''}. Continue construindo sua presença técnica no mercado.`
      : 'Comece a construir seu portfólio adicionando seu primeiro projeto.';
    grid.innerHTML = filtered.map(buildCard).join('') + cardNew();
  }

  /* ===== MODAL ===== */
  function openModal(proj) {
    $('#proj-modal').hidden = false;
    $('#proj-modal-title').textContent = proj ? 'Editar Projeto' : 'Novo Projeto';
    $('#proj-id').value    = proj ? proj.id : '';
    $('#proj-title').value = proj ? (proj.title || '') : '';
    $('#proj-desc').value  = proj ? (proj.description || '') : '';
    $('#proj-tech').value  = proj ? techArray(proj).join(', ') : '';
    $('#proj-repo').value  = proj ? (proj.repoUrl || proj.githubUrl || '') : '';
    $('#proj-demo').value  = proj ? (proj.demoUrl || '') : '';
    $('#proj-public').checked = proj ? isPublic(proj) : true;
    setTimeout(() => $('#proj-title').focus(), 50);
  }
  function closeModal() { $('#proj-modal').hidden = true; $('#proj-form').reset(); }

  async function submitProject(ev) {
    ev.preventDefault();
    const id = $('#proj-id').value;
    const payload = {
      userId: currentUser.id,
      title: $('#proj-title').value.trim(),
      description: $('#proj-desc').value.trim(),
      technologies: $('#proj-tech').value.split(',').map(s => s.trim()).filter(Boolean),
      repoUrl: $('#proj-repo').value.trim(),
      demoUrl: $('#proj-demo').value.trim(),
      isPublic: $('#proj-public').checked,
    };
    if (!payload.title) { toast('Informe o título do projeto.', 'error'); return; }

    try {
      let res;
      if (id) {
        res = await api(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        payload.createdAt = new Date().toISOString();
        res = await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error('falha');
      closeModal();
      await load();
      toast(id ? 'Projeto atualizado!' : 'Projeto criado!', 'success');
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível salvar o projeto.', 'error');
    }
  }

  async function deleteProject(id) {
    const proj = projects.find(p => String(p.id) === String(id));
    if (!proj) return;
    if (!window.confirm(`Excluir o projeto "${proj.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (err.message === 'Token expirado') return;
      // ignora: o JSON Server pode lançar erro no cascade interno mesmo removendo o registro
    }
    // Confirma pelo estado real (recarrega e verifica se o projeto sumiu)
    await load();
    const aindaExiste = projects.some(p => String(p.id) === String(id));
    toast(aindaExiste ? 'Não foi possível excluir o projeto.' : 'Projeto excluído.', aindaExiste ? 'error' : 'success');
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#filter-status').addEventListener('change', render);
    $('#proj-form').addEventListener('submit', submitProject);
    $('#proj-modal-close').addEventListener('click', closeModal);
    $('#proj-modal-overlay').addEventListener('click', closeModal);
    $('#proj-cancel').addEventListener('click', closeModal);
    $('#btn-new-sidebar').addEventListener('click', () => openModal(null));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#proj-modal').hidden) closeModal(); });

    $('#mp-grid').addEventListener('click', (ev) => {
      if (ev.target.closest('#card-new')) { openModal(null); return; }
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('[data-proj-id]');
      const id = card && card.getAttribute('data-proj-id');
      const proj = projects.find(p => String(p.id) === String(id));
      if (btn.getAttribute('data-action') === 'edit') openModal(proj);
      else if (btn.getAttribute('data-action') === 'delete') deleteProject(id);
    });

    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== CARGA ===== */
  async function load() {
    try {
      const res = await api(`/api/projects?userId=${encodeURIComponent(currentUser.id)}`);
      const data = await res.json();
      projects = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#mp-grid').innerHTML = `<div class="mp-loading">Não foi possível carregar os projetos.</div>`;
      }
    }
  }

  function init() { setupEvents(); load(); }
  init();

})();
