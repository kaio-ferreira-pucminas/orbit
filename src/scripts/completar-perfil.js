// completar-perfil.js — Orbit · Completar Perfil Profissional (#9 — Lucas Valle)
// JS puro, sem framework. Backend: JSON Server (PATCH /api/users/:id).

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
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
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
  let skills = [];
  let experiences = [];

  /* ===== PROGRESSO ===== */
  function computeProgress(user) {
    // 6 critérios → 0..100
    const checks = [
      !!user.name,
      !!(user.headline || user.title),
      !!user.bio,
      skills.length >= 3,
      experiences.length >= 1,
      !!user.github,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function renderProgress(user) {
    const pct = computeProgress(user);
    $('#cp-pct').textContent = pct + '%';
    setTimeout(() => { $('#cp-bar').style.width = pct + '%'; }, 100);
    const level = pct >= 80 ? 'Nível 3' : pct >= 45 ? 'Nível 2' : 'Nível 1';
    $('#cp-level').textContent = level;
  }

  /* ===== SKILLS (chips) ===== */
  function renderSkills() {
    const box = $('#skill-chips');
    if (!skills.length) {
      box.innerHTML = `<span class="cp-skill-empty">Nenhuma habilidade adicionada ainda.</span>`;
      return;
    }
    box.innerHTML = skills.map((s, i) => `
      <span class="cp-skill-chip">
        ${escapeHtml(s)}
        <button type="button" class="cp-skill-chip__remove" data-skill-idx="${i}" aria-label="Remover ${escapeHtml(s)}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>`).join('');
  }

  function addSkill(value) {
    const v = value.trim();
    if (!v) return;
    if (skills.some(s => s.toLowerCase() === v.toLowerCase())) { toast('Habilidade já adicionada.', 'info'); return; }
    skills.push(v);
    renderSkills();
    renderProgress(currentUser);
  }

  /* ===== EXPERIÊNCIAS ===== */
  function renderExperiences() {
    const list = $('#exp-list');
    const empty = $('#exp-empty');
    if (!experiences.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = experiences.map((e, i) => `
      <article class="cp-exp-card">
        <div class="cp-exp-card__top">
          <div class="cp-exp-card__left">
            <div class="cp-exp-card__icon">
              <svg width="20" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <div>
              <h3 class="cp-exp-card__role">${escapeHtml(e.role)}</h3>
              <p class="cp-exp-card__company">${escapeHtml(e.company)}</p>
            </div>
          </div>
          <div class="cp-exp-card__top-right">
            <span class="cp-exp-card__period">${escapeHtml(e.period || '')}</span>
          </div>
        </div>
        ${e.description ? `<p class="cp-exp-card__desc">${escapeHtml(e.description)}</p>` : ''}
        <div class="cp-exp-card__actions">
          <button type="button" class="cp-exp-card__btn" data-exp-remove="${i}" aria-label="Remover experiência">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </article>`).join('');
  }

  function openExpForm() { $('#exp-form').hidden = false; $('#exp-empty').hidden = true; $('#exp-role').focus(); }
  function closeExpForm() {
    $('#exp-form').hidden = true;
    ['#exp-role', '#exp-company', '#exp-period', '#exp-desc'].forEach(s => { $(s).value = ''; });
    if (!experiences.length) $('#exp-empty').hidden = false;
  }

  function submitExp(ev) {
    ev.preventDefault();
    const role = $('#exp-role').value.trim();
    const company = $('#exp-company').value.trim();
    if (!role || !company) { toast('Informe ao menos cargo e empresa.', 'error'); return; }
    experiences.push({
      role, company,
      period: $('#exp-period').value.trim(),
      description: $('#exp-desc').value.trim(),
    });
    closeExpForm();
    renderExperiences();
    renderProgress(currentUser);
  }

  /* ===== SALVAR ===== */
  async function save() {
    const btn = $('#btn-save');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'Salvando...';
    try {
      const res = await api(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ skills, experiences }),
      });
      const data = await res.json();
      if (!res.ok) { btn.disabled = false; btn.innerHTML = original; toast(data.error || 'Erro ao salvar.', 'error'); return; }
      // atualiza sessão local
      const merged = Object.assign({}, currentUser, { skills, experiences });
      localStorage.setItem('orbit_user', JSON.stringify(merged));
      toast('Perfil atualizado com sucesso!', 'success');
      setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 800);
    } catch (err) {
      if (err.message !== 'Token expirado') { btn.disabled = false; btn.innerHTML = original; toast('Não foi possível salvar.', 'error'); }
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#skill-input').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addSkill(ev.target.value); ev.target.value = ''; }
    });
    $('#skill-chips').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-skill-idx]');
      if (!btn) return;
      skills.splice(Number(btn.getAttribute('data-skill-idx')), 1);
      renderSkills(); renderProgress(currentUser);
    });

    $('#btn-add-exp').addEventListener('click', openExpForm);
    $('#btn-cancel-exp').addEventListener('click', closeExpForm);
    $('#exp-form').addEventListener('submit', submitExp);
    $('#exp-list').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-exp-remove]');
      if (!btn) return;
      experiences.splice(Number(btn.getAttribute('data-exp-remove')), 1);
      renderExperiences(); renderProgress(currentUser);
    });

    $('#btn-save').addEventListener('click', save);
  }

  /* ===== INIT ===== */
  async function init() {
    $('#cp-initials').textContent = initials(currentUser.name);
    if (currentUser.avatarUrl) $('#cp-avatar').innerHTML = `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="${escapeHtml(currentUser.name)}" />`;
    setupEvents();

    // carrega dados atuais do perfil
    let user = currentUser;
    try {
      const res = await api(`/api/users/${currentUser.id}/profile`);
      if (res.ok) {
        const data = await res.json();
        user = data.user || currentUser;
      }
    } catch (err) {
      if (err.message === 'Token expirado') return;
    }

    skills = Array.isArray(user.skills) ? [...user.skills] : [];
    experiences = Array.isArray(user.experiences) ? [...user.experiences] : [];
    renderSkills();
    renderExperiences();
    renderProgress(user);
  }

  init();

})();
