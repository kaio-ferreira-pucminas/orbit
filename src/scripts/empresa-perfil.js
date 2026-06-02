// empresa-perfil.js — Orbit · Perfil público de empresa (fiel ao Figma). JS puro.

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token = localStorage.getItem('orbit_token');
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('orbit_user') || 'null'); } catch (e) {}
  if (!token) { window.location.href = '/pages/auth.html?tab=login'; return; }

  /* ===== HELPERS ===== */
  function $(s) { return document.querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function chips(arr) {
    return (arr || []).slice(0, 6).map(s => `<span class="emp-chip">${escapeHtml(s)}</span>`).join('');
  }
  function toast(m, t) { if (window.orbitToast) window.orbitToast(m, t || 'info'); }
  async function api(path, opts) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, opts, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, (opts && opts.headers) || {}),
    }));
    if (res.status === 401) { localStorage.clear(); window.location.href = '/pages/auth.html?tab=login'; throw new Error('401'); }
    return res;
  }

  const CULTURE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.9 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>';

  const companyId = new URLSearchParams(window.location.search).get('id');
  let company = null;

  /* ===== RENDER ===== */
  function renderJob(j) {
    const meta = [j.level, j.modality, j.location].filter(Boolean).join(' · ');
    const active = j.status === 'active';
    return `<div class="emp-job">
      <div>
        <div class="emp-job__title">${escapeHtml(j.title)}
          <span class="emp-job__status emp-job__status--${active ? 'active' : 'closed'}">${active ? 'Aberta' : 'Encerrada'}</span>
        </div>
        <div class="emp-job__meta">${escapeHtml(meta)}${j.salaryRange ? ' · ' + escapeHtml(j.salaryRange) : ''}</div>
        <div class="emp-job__chips">${chips(j.skills)}</div>
      </div>
      <a class="emp-job__cta" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(j.id)}">Ver vaga</a>
    </div>`;
  }

  function render(c, jobs, stats) {
    company = c;

    if (c.coverGradient) $('#emp-cover').style.background = c.coverGradient;
    const logo = $('#emp-logo');
    if (c.logoUrl) logo.innerHTML = `<img src="${escapeHtml(c.logoUrl)}" alt="${escapeHtml(c.name)}" />`;
    else logo.textContent = c.logoInitials || initials(c.name);

    $('#emp-name').textContent = c.name || 'Empresa';
    $('#emp-tagline').textContent = c.tagline || c.industry || '';
    $('#emp-location').textContent = c.location || '';

    // Estatísticas
    $('#stat-followers').textContent = stats.followers != null ? stats.followers : '—';
    $('#stat-jobs').textContent      = stats.jobs != null ? stats.jobs : '—';
    $('#stat-rating').textContent    = stats.rating != null ? `★ ${stats.rating}` : '—';
    $('#stat-founded').textContent   = stats.founded || '—';

    // Site
    if (c.website) {
      const site = $('#emp-site');
      site.href = /^https?:\/\//.test(c.website) ? c.website : 'https://' + c.website;
      site.hidden = false;
    }

    // Ver vagas → rola até a seção
    $('#btn-ver-vagas').addEventListener('click', () => {
      const sec = $('#emp-jobs-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Seguir empresa (só quando há usuário-empresa vinculado e não é o próprio)
    if (c.userId && (!currentUser || c.userId !== currentUser.id)) {
      setupFollow(c.userId);
    }

    // Sobre + meta
    $('#emp-about').textContent = c.about || 'Esta empresa ainda não adicionou uma descrição.';
    const meta = [];
    if (c.industry) meta.push(`<span class="emp-meta__item">Setor: <b>${escapeHtml(c.industry)}</b></span>`);
    if (stats.size) meta.push(`<span class="emp-meta__item">Porte: <b>${escapeHtml(stats.size)}</b></span>`);
    if (c.location) meta.push(`<span class="emp-meta__item">Local: <b>${escapeHtml(c.location)}</b></span>`);
    if (stats.founded) meta.push(`<span class="emp-meta__item">Fundada em <b>${escapeHtml(String(stats.founded))}</b></span>`);
    $('#emp-meta').innerHTML = meta.join('');

    // Cultura e Valores
    const culture = c.culture || [];
    if (culture.length) {
      $('#emp-culture').innerHTML = culture.map(v => `
        <div class="emp-culture__card">
          <div class="emp-culture__icon">${CULTURE_ICON}</div>
          <div class="emp-culture__title">${escapeHtml(v.title || '')}</div>
          <div class="emp-culture__text">${escapeHtml(v.text || '')}</div>
        </div>`).join('');
    } else {
      $('#emp-culture-section').hidden = true;
    }

    // Vagas
    $('#emp-jobs-count').textContent = jobs.length;
    $('#emp-jobs').innerHTML = jobs.length
      ? jobs.map(renderJob).join('')
      : '<p class="emp-jobs__empty">Nenhuma vaga publicada no momento.</p>';

    // Depoimentos
    const ts = c.testimonials || [];
    if (ts.length) {
      $('#emp-testimonials').innerHTML = ts.map(t => `
        <div class="emp-testimonial">
          <p class="emp-testimonial__quote">${escapeHtml(t.quote || '')}</p>
          <div class="emp-testimonial__author">
            <div class="emp-testimonial__avatar">${escapeHtml(initials(t.authorName))}</div>
            <div>
              <div class="emp-testimonial__name">${escapeHtml(t.authorName || '')}</div>
              <div class="emp-testimonial__role">${escapeHtml(t.authorRole || '')}</div>
            </div>
          </div>
        </div>`).join('');
    } else {
      $('#emp-testimonials-section').hidden = true;
    }

    $('#emp-loading').hidden = true;
    $('#emp-content').hidden = false;
  }

  /* ===== SEGUIR EMPRESA ===== */
  function setupFollow(targetUserId) {
    const btn = $('#btn-follow-company');
    btn.hidden = false;
    let following = false;

    function paint() {
      btn.classList.toggle('is-following', following);
      btn.textContent = following ? 'Seguindo' : 'Seguir Empresa';
    }

    // estado inicial
    api(`/api/users/${targetUserId}/follow-status`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { following = !!d.following; paint(); }
    }).catch(() => {});

    btn.addEventListener('click', async () => {
      try {
        const res = await api('/api/follows', { method: 'POST', body: JSON.stringify({ targetUserId }) });
        const d = await res.json();
        if (!res.ok) { toast(d.error || 'Não foi possível seguir.', 'error'); return; }
        following = !!d.following;
        paint();
        toast(following ? 'Você começou a seguir a empresa.' : 'Você deixou de seguir.', 'success');
      } catch (e) { if (e.message !== '401') toast('Não foi possível seguir agora.', 'error'); }
    });
  }

  /* ===== INIT ===== */
  (async function init() {
    if (!companyId) { $('#emp-loading').textContent = 'Empresa não informada.'; return; }
    try {
      const res = await api('/api/companies/' + encodeURIComponent(companyId));
      if (!res.ok) { $('#emp-loading').textContent = 'Empresa não encontrada.'; return; }
      const data = await res.json();
      render(data.company, data.jobs || [], data.stats || {});
    } catch (e) {
      if (e.message !== '401') $('#emp-loading').textContent = 'Não foi possível carregar a empresa.';
    }
  })();

})();
