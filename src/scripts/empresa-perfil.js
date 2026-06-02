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
    return (arr || []).slice(0, 4).map(s => `<span class="emp-chip">${escapeHtml(s)}</span>`).join('');
  }
  function toast(m, t) { if (window.orbitToast) window.orbitToast(m, t || 'info'); }
  async function api(path, opts) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, opts, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, (opts && opts.headers) || {}),
    }));
    if (res.status === 401) { localStorage.clear(); window.location.href = '/pages/auth.html?tab=login'; throw new Error('401'); }
    return res;
  }

  const STAR_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.9 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>';
  const BOOKMARK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

  const companyId = new URLSearchParams(window.location.search).get('id');

  /* ===== RENDER: galeria de cultura ===== */
  function cultureImg(url) {
    return `<img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`;
  }
  function renderGallery(images, overlay) {
    const cells = [];
    cells.push(`<div class="emp-gallery__cell emp-gallery__cell--large">
      ${images[0] ? cultureImg(images[0]) : ''}
      ${overlay ? `<div class="emp-gallery__overlay"><div class="emp-gallery__overlay-title">${escapeHtml(overlay.title || '')}</div><div class="emp-gallery__overlay-text">${escapeHtml(overlay.text || '')}</div></div>` : ''}
    </div>`);
    if (images[1]) cells.push(`<div class="emp-gallery__cell">${cultureImg(images[1])}</div>`);
    if (images[2]) cells.push(`<div class="emp-gallery__cell">${cultureImg(images[2])}</div>`);
    return `<div class="emp-gallery">${cells.join('')}</div>`;
  }
  function renderCultureCards(culture) {
    return `<div class="emp-culture-cards">${culture.map(v => `
      <div class="emp-culture-card">
        <div class="emp-culture-card__icon">${STAR_ICON}</div>
        <div class="emp-culture-card__title">${escapeHtml(v.title || '')}</div>
        <div class="emp-culture-card__text">${escapeHtml(v.text || '')}</div>
      </div>`).join('')}</div>`;
  }

  /* ===== RENDER: vaga (card) ===== */
  function renderJobCard(j) {
    return `<div class="emp-job-card">
      <div class="emp-job-card__top">
        <span class="emp-job-card__tag">${escapeHtml(j.modality || 'Vaga')}</span>
        <span class="emp-job-card__bookmark" aria-hidden="true">${BOOKMARK_SVG}</span>
      </div>
      <div class="emp-job-card__title">${escapeHtml(j.title)}</div>
      <div class="emp-job-card__desc">${escapeHtml(j.description || '')}</div>
      <div class="emp-job-card__chips">${chips(j.skills)}</div>
      <a class="emp-job-card__cta" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(j.id)}">Candidatar-se</a>
    </div>`;
  }

  /* ===== RENDER principal ===== */
  function render(c, jobs, stats) {
    // Capa: imagem (se houver) com gradiente como fallback; senão só gradiente
    const grad = c.coverGradient || 'linear-gradient(135deg,#131b2e 0%,#4648d4 100%)';
    $('#emp-cover').style.background = c.coverUrl
      ? `url("${c.coverUrl}") center/cover no-repeat, ${grad}`
      : grad;

    // Logo
    const logo = $('#emp-logo');
    if (c.logoUrl) logo.innerHTML = `<img src="${escapeHtml(c.logoUrl)}" alt="${escapeHtml(c.name)}" onerror="this.remove()" />`;
    else logo.textContent = c.logoInitials || initials(c.name);

    $('#emp-name').textContent = c.name || 'Empresa';
    $('#emp-tagline').textContent = c.tagline || c.industry || '';

    // Ações
    $('#btn-ver-vagas').addEventListener('click', () => {
      const sec = $('#emp-jobs-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (c.website) {
      const site = $('#emp-site');
      site.href = /^https?:\/\//.test(c.website) ? c.website : 'https://' + c.website;
      site.hidden = false;
    }
    if (c.userId && (!currentUser || c.userId !== currentUser.id)) setupFollow(c.userId);

    // Sobre Nós
    $('#emp-about').textContent = c.about || 'Esta empresa ainda não adicionou uma descrição.';

    // Estatísticas (4 cards)
    $('#stat-employees').textContent = stats.employees != null ? stats.employees : '—';
    $('#stat-projects').textContent  = stats.projects != null ? stats.projects : (stats.jobs != null ? stats.jobs : '—');
    $('#stat-countries').textContent = stats.countries != null ? stats.countries : '—';
    $('#stat-rating').textContent    = stats.rating != null ? stats.rating : '—';

    // Cultura e Valores: galeria (se imagens) → senão cards de valores → senão oculta
    const subtitle = c.cultureSubtitle;
    if (subtitle) { $('#emp-culture-subtitle').textContent = subtitle; $('#emp-culture-subtitle').hidden = false; }
    const images = Array.isArray(c.cultureImages) ? c.cultureImages.filter(Boolean) : [];
    const culture = Array.isArray(c.culture) ? c.culture : [];
    if (images.length) {
      $('#emp-culture').innerHTML = renderGallery(images, culture[0]);
    } else if (culture.length) {
      $('#emp-culture').innerHTML = renderCultureCards(culture);
    } else {
      $('#emp-culture-section').hidden = true;
    }

    // Vagas (cards)
    $('#emp-jobs-count').textContent = jobs.length;
    $('#emp-jobs').innerHTML = jobs.length
      ? jobs.map(renderJobCard).join('')
      : '<p class="emp-jobs__empty">Nenhuma vaga publicada no momento.</p>';

    // Depoimentos
    const ts = Array.isArray(c.testimonials) ? c.testimonials : [];
    if (ts.length) {
      $('#emp-testimonials').innerHTML = ts.map(t => `
        <div class="emp-testimonial">
          <span class="emp-testimonial__badge">99</span>
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
    const paint = () => { btn.classList.toggle('is-following', following); btn.textContent = following ? 'Seguindo' : 'Seguir Empresa'; };
    api(`/api/users/${targetUserId}/follow-status`).then(r => r.ok ? r.json() : null).then(d => { if (d) { following = !!d.following; paint(); } }).catch(() => {});
    btn.addEventListener('click', async () => {
      try {
        const res = await api('/api/follows', { method: 'POST', body: JSON.stringify({ targetUserId }) });
        const d = await res.json();
        if (!res.ok) { toast(d.error || 'Não foi possível seguir.', 'error'); return; }
        following = !!d.following; paint();
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
