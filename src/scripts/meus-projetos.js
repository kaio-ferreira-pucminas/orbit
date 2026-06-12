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
  let pendingCover = undefined; // undefined = não mexeu | string(dataUrl) = nova capa | null = remover

  // Redimensiona a imagem no cliente (evita payload gigante) → data URL webp/jpeg
  function resizeImageToDataUrl(file, maxSize = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) { const s = Math.min(maxSize / w, maxSize / h); w = Math.round(w * s); h = Math.round(h * s); }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/webp', quality);
          if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function setCoverPreview(url) {
    const prev = $('#proj-cover-preview'); const rm = $('#proj-cover-remove');
    if (!prev) return;
    if (url) { prev.innerHTML = `<img src="${escapeHtml(url)}" alt="capa" />`; if (rm) rm.hidden = false; }
    else { prev.innerHTML = '<span class="mp-cover__empty">Sem capa</span>'; if (rm) rm.hidden = true; }
  }

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
  function statusOf(p) { return p.status === 'rascunho' ? 'rascunho' : 'ativo'; }

  /* ===== RENDER ===== */
  function buildCard(p) {
    const tech = techArray(p);
    const tags = tech.slice(0, 3).map(t => `<span class="mp-tag">${escapeHtml(t)}</span>`).join('');
    const grad = p.coverGradient || gradientFor(p.id);
    const draft = statusOf(p) === 'rascunho';
    const repo = p.repoUrl || p.githubUrl;
    const live = p.liveUrl || null;
    const cover = p.coverImage;
    const thumbStyle = cover
      ? `background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.4)),url('${escapeHtml(cover)}') center/cover`
      : `background:${escapeHtml(grad)}`;

    return `
      <article class="mp-card ${draft ? 'mp-card--draft' : ''}" data-proj-id="${escapeHtml(p.id)}">
        <div class="mp-card__thumb" style="${thumbStyle}">
          <span class="mp-card__thumb-text">${escapeHtml(p.title || 'Projeto')}</span>
          ${p.source === 'github' ? '<span class="mp-card__src" title="Importado do GitHub">GitHub</span>' : ''}
        </div>
        <div class="mp-card__status">
          <span class="mp-status mp-status--${draft ? 'draft' : 'active'}">${draft ? 'Rascunho' : 'Ativo'}</span>
          <div class="mp-card__metrics">
            ${p.ratingCount ? `<span class="mp-card__metric" title="Avaliação média">★ ${p.ratingAvg || 0} (${p.ratingCount})</span>` : ''}
            <span class="mp-card__metric"><span class="mp-card__dot mp-card__dot--${isPublic(p) ? 'public' : 'private'}"></span>${isPublic(p) ? 'Público' : 'Privado'}</span>
          </div>
        </div>
        <h3 class="mp-card__title">${escapeHtml(p.title || 'Projeto')}</h3>
        <p class="mp-card__desc">${escapeHtml(p.description || 'Sem descrição.')}</p>
        ${tags ? `<div class="mp-card__tags">${tags}</div>` : ''}
        <div class="mp-card__foot">
          <div class="mp-card__links">
            ${repo ? `<a class="mp-card__link" href="${escapeHtml(repo)}" target="_blank" rel="noopener noreferrer">Repositório</a>` : ''}
            ${live ? `<a class="mp-card__link mp-card__link--live" href="${escapeHtml(live)}" target="_blank" rel="noopener noreferrer">Ver online</a>` : ''}
          </div>
          <div class="mp-card__actions">
            ${draft ? `<button type="button" class="mp-card__btn mp-card__btn--publish" data-action="publish" title="Publicar (aparecer no perfil)">Publicar</button>` : ''}
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
    if (f === 'ativo') return list.filter(p => statusOf(p) === 'ativo');
    if (f === 'rascunho') return list.filter(p => statusOf(p) === 'rascunho');
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
    $('#proj-demo').value  = proj ? (proj.liveUrl || proj.demoUrl || '') : '';
    $('#proj-public').checked = proj ? isPublic(proj) : true;
    pendingCover = undefined;
    setCoverPreview(proj ? (proj.coverImage || '') : '');
    const ci = $('#proj-cover-input'); if (ci) ci.value = '';
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
      liveUrl: $('#proj-demo').value.trim() || null,
      isPublic: $('#proj-public').checked,
    };
    if (pendingCover !== undefined) payload.coverImage = pendingCover;
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

  async function publishProject(id) {
    try {
      const res = await api(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ativo' }) });
      if (!res.ok) throw new Error('falha');
      await load();
      toast('Projeto publicado! Agora aparece no seu perfil.', 'success');
    } catch (err) { if (err.message !== 'Token expirado') toast('Não foi possível publicar.', 'error'); }
  }

  /* ===== MODAL — Conectar GitHub ===== */
  // Aceita URL completa, @handle ou só o usuário; devolve apenas o login.
  function normalizeGithubUser(input) {
    let v = String(input || '').trim();
    if (!v) return '';
    v = v.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '').replace(/^@/, '');
    v = v.split(/[\/?#]/)[0];
    return v.trim();
  }
  function openGithubModal() {
    const m = $('#gh-modal'); if (!m) return;
    m.hidden = false;
    const inp = $('#gh-username'); if (inp) { inp.value = currentUser.github || ''; }
    setTimeout(() => { if (inp) inp.focus(); }, 50);
  }
  function closeGithubModal() { const m = $('#gh-modal'); if (m) m.hidden = true; }

  async function submitGithub(ev) {
    ev.preventDefault();
    const username = normalizeGithubUser($('#gh-username').value);
    if (!username) { toast('Informe seu usuário do GitHub.', 'error'); return; }
    const btn = $('#gh-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    try {
      const res = await api(`/api/users/${currentUser.id}`, { method: 'PATCH', body: JSON.stringify({ github: username }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'falha');
      Object.assign(currentUser, data);
      localStorage.setItem('orbit_user', JSON.stringify(currentUser));
      closeGithubModal();
      toast('GitHub conectado! Importando seus repositórios…', 'success');
      await syncGithub();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível salvar seu usuário do GitHub.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar e sincronizar'; }
    }
  }

  async function syncGithub() {
    if (!currentUser.github) { openGithubModal(); return; }
    const btn = $('#btn-sync-github'); if (btn) btn.disabled = true;
    try {
      const res = await api('/api/github/sync', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'falha');
      await load();
      toast(data.added > 0 ? `${data.added} projeto(s) importado(s) do GitHub como rascunho.` : 'Nenhum projeto novo do GitHub para importar.', 'success');
    } catch (err) { if (err.message !== 'Token expirado') toast('Não foi possível sincronizar com o GitHub.', 'error'); }
    finally { if (btn) btn.disabled = false; }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#filter-status').addEventListener('change', render);
    $('#proj-form').addEventListener('submit', submitProject);
    $('#proj-modal-close').addEventListener('click', closeModal);
    $('#proj-modal-overlay').addEventListener('click', closeModal);
    $('#proj-cancel').addEventListener('click', closeModal);
    const bNew = $('#btn-new-sidebar'); if (bNew) bNew.addEventListener('click', () => openModal(null));
    const bSync = $('#btn-sync-github'); if (bSync) bSync.addEventListener('click', syncGithub);
    const coverBtn = $('#proj-cover-btn'); const coverInput = $('#proj-cover-input'); const coverRm = $('#proj-cover-remove');
    if (coverBtn && coverInput) coverBtn.addEventListener('click', () => coverInput.click());
    if (coverInput) coverInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      if (!file.type.startsWith('image/')) { toast('Selecione um arquivo de imagem.', 'error'); return; }
      try { pendingCover = await resizeImageToDataUrl(file); setCoverPreview(pendingCover); }
      catch { toast('Não foi possível carregar a imagem.', 'error'); }
    });
    if (coverRm) coverRm.addEventListener('click', () => { pendingCover = null; setCoverPreview(''); const ci = $('#proj-cover-input'); if (ci) ci.value = ''; });
    const ghForm = $('#gh-form'); if (ghForm) ghForm.addEventListener('submit', submitGithub);
    const ghClose = $('#gh-modal-close'); if (ghClose) ghClose.addEventListener('click', closeGithubModal);
    const ghOverlay = $('#gh-modal-overlay'); if (ghOverlay) ghOverlay.addEventListener('click', closeGithubModal);
    const ghCancel = $('#gh-cancel'); if (ghCancel) ghCancel.addEventListener('click', closeGithubModal);
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      if (!$('#proj-modal').hidden) closeModal();
      else if ($('#gh-modal') && !$('#gh-modal').hidden) closeGithubModal();
    });

    $('#mp-grid').addEventListener('click', (ev) => {
      if (ev.target.closest('#card-new')) { openModal(null); return; }
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('[data-proj-id]');
      const id = card && card.getAttribute('data-proj-id');
      const proj = projects.find(p => String(p.id) === String(id));
      const action = btn.getAttribute('data-action');
      if (action === 'edit') openModal(proj);
      else if (action === 'delete') deleteProject(id);
      else if (action === 'publish') publishProject(id);
    });

    const bLogout = $('#btn-logout');
    if (bLogout) bLogout.addEventListener('click', () => {
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

  function init() {
    setupEvents();
    load();
    // deep-link ?new (ex.: "Adicionar meu primeiro projeto" no dashboard) → abre o cadastro
    if (new URLSearchParams(window.location.search).get('new') !== null) openModal(null);
  }
  init();

})();
