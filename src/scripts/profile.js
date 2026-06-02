// profile.js — Orbit Developer Profile
// JS puro, sem framework

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* =========================================================
     AUTH GUARD
  ========================================================= */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');

  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }

  const currentUser = JSON.parse(userJson);

  // ID do perfil a carregar — vem da query string (?id=xxx) ou cai no usuário logado
  const params      = new URLSearchParams(window.location.search);
  const targetId    = params.get('id') || currentUser.id;

  /* =========================================================
     HELPERS
  ========================================================= */
  function $(s, root = document)  { return root.querySelector(s); }
  function $$(s, root = document) { return [...root.querySelectorAll(s)]; }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, ch => map[ch]);
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }

    return res;
  }

  /* =========================================================
     HEADER — renderizado e controlado pelo componente header.js
  ========================================================= */
  function renderHeader() {
    // O header (avatar + menu do usuário + sino + chat) agora vem do header.js
  }

  // Helper: aplica imagem ou iniciais a um elemento avatar
  function setAvatar(container, url, name, initialsSelector) {
    if (!container) return;
    const initialsEl = initialsSelector ? container.querySelector(initialsSelector) : null;

    // Remove img anterior se existir
    const oldImg = container.querySelector('img');
    if (oldImg) oldImg.remove();

    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = name || '';
      container.appendChild(img);
      if (initialsEl) initialsEl.style.display = 'none';
    } else {
      if (initialsEl) {
        initialsEl.style.display = '';
        initialsEl.textContent = initials(name);
      }
    }
  }

  // Menu do usuário (avatar dropdown + logout) é controlado pelo componente header.js

  /* =========================================================
     RENDER — HERO
  ========================================================= */
  function renderHero(user, stats) {
    // Avatar do hero (imagem ou iniciais)
    setAvatar($('#profile-avatar'), user.avatarUrl, user.name, '#profile-avatar-initials');

    // Botão "Editar perfil" — só no próprio perfil
    const isOwn = user.id === currentUser.id;
    $('#profile-edit-btn').style.display = isOwn ? '' : 'none';

    // Link do currículo (se existir)
    const resumeLink = $('#profile-resume-link');
    if (user.resumeUrl) {
      resumeLink.href = user.resumeUrl;
      resumeLink.download = user.resumeFileName || 'curriculo.pdf';
      resumeLink.style.display = '';
    } else {
      resumeLink.style.display = 'none';
    }

    // Disponibilidade
    const availBadge  = $('#profile-availability');
    const availText   = $('#profile-availability-text');
    if (user.available) {
      availBadge.classList.remove('profile-badge--unavailable');
      availBadge.classList.add('profile-badge--available');
      availText.textContent = 'DISPONÍVEL PARA PROJETOS';
    } else {
      availBadge.classList.remove('profile-badge--available');
      availBadge.classList.add('profile-badge--unavailable');
      availText.textContent = 'NÃO DISPONÍVEL';
    }

    // Rating
    renderStars(stats.rating);
    $('#profile-rating-value').textContent = stats.rating > 0 ? stats.rating.toFixed(1) : '—';
    $('#profile-rating-count').textContent =
      stats.reviewsCount > 0
        ? `(${stats.reviewsCount} avaliaç${stats.reviewsCount === 1 ? 'ão' : 'ões'})`
        : '(sem avaliações)';

    // Nome + headline
    $('#profile-name').textContent     = user.name;
    $('#profile-headline').textContent = user.headline ||
      (user.type === 'company' ? 'Empresa parceira da Orbit' : 'Desenvolvedor(a)');

    // Links sociais
    const githubLink   = $('#profile-github');
    const linkedinLink = $('#profile-linkedin');

    if (user.github) {
      githubLink.href = `https://github.com/${user.github}`;
      githubLink.style.display = '';
    } else {
      githubLink.style.display = 'none';
    }

    if (user.linkedin) {
      // Usa exatamente o link salvo pelo usuário; só normaliza prepend do https:// se faltar
      linkedinLink.href = /^https?:\/\//i.test(user.linkedin)
        ? user.linkedin
        : `https://${user.linkedin}`;
      linkedinLink.style.display = '';
    } else {
      linkedinLink.style.display = 'none';
    }

    // Contato — copia email
    $('#profile-contact-btn').addEventListener('click', () => {
      navigator.clipboard?.writeText(user.email);
      window.showToast(`Email copiado: ${user.email}`, 'success');
    });

    // Empresa: esconde elementos de dev no hero (disponibilidade + rating)
    const isCompany = user.type === 'company';
    availBadge.style.display = isCompany ? 'none' : '';
    $('#profile-rating').style.display = isCompany ? 'none' : '';
    // "Ir para o Dashboard" aponta para o dashboard certo conforme o tipo
    const dashLink = document.querySelector('.profile-actions .profile-cta--primary');
    if (dashLink) dashLink.href = isCompany ? '/pages/empresa-dashboard.html' : '/pages/dashboard.html';

    // Atualiza title da aba
    document.title = `${user.name} — Orbit`;
  }

  function renderStars(rating) {
    const container = $('#profile-rating-stars');
    const full      = Math.floor(rating);
    const hasHalf   = (rating - full) >= 0.5;
    const total     = 5;

    let html = '';
    for (let i = 1; i <= total; i++) {
      const filled = i <= full || (i === full + 1 && hasHalf);
      html += `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="${filled ? 'currentColor' : 'none'}"
          stroke="currentColor" stroke-width="${filled ? 0 : 1.5}"
          class="${filled ? '' : 'profile-star--empty'}">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      `;
    }
    container.innerHTML = html;
  }

  /* =========================================================
     RENDER — ABOUT
  ========================================================= */
  function renderAbout(user) {
    const body = $('#profile-about-body');
    if (user.bio) {
      // Quebra em parágrafos por \n\n
      body.innerHTML = user.bio
        .split(/\n\n+/)
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');
    } else {
      body.innerHTML = `<p style="color: var(--feed-text-muted);">
        Este usuário ainda não adicionou uma bio.
      </p>`;
    }
  }

  /* =========================================================
     RENDER — SKILLS
  ========================================================= */
  function renderSkills(user) {
    const container = $('#profile-skills');
    if (user.skills && user.skills.length > 0) {
      container.innerHTML = user.skills
        .map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`)
        .join('');
    } else {
      container.innerHTML = `<p class="skills-cloud__empty">
        Suas habilidades aparecerão aqui assim que você adicionar.
      </p>`;
    }
  }

  /* =========================================================
     RENDER — PORTFOLIO
  ========================================================= */
  function renderProjects(projects) {
    const container = $('#profile-projects');

    if (!projects || projects.length === 0) {
      container.innerHTML = `<div class="projects-grid__empty">
        Nenhum projeto em destaque ainda.
      </div>`;
      return;
    }

    container.innerHTML = projects.map(p => {
      const techs = (p.technologies || [])
        .map(t => `<span class="project-card__tech">${escapeHtml(t)}</span>`)
        .join('');

      return `
        <article class="project-card">
          <div class="project-card__cover" style="background: ${p.coverGradient || 'linear-gradient(135deg, #131b2e 0%, #4648d4 100%)'};">
            ${escapeHtml(p.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}
          </div>
          <div class="project-card__body">
            <div class="project-card__meta">
              <span class="project-card__category">${escapeHtml(p.category || 'PROJETO')}</span>
              ${p.year ? `<span class="project-card__year">${p.year}</span>` : ''}
            </div>
            <h3 class="project-card__title">${escapeHtml(p.title)}</h3>
            <p class="project-card__description">${escapeHtml(p.description || '')}</p>
            ${techs ? `<div class="project-card__techs">${techs}</div>` : ''}
            ${ (p.demoUrl || p.repoUrl)
              ? `<div class="project-card__links">
                  ${ p.demoUrl ? `<a href="${escapeHtml(p.demoUrl)}" target="_blank" rel="noopener" class="project-card__link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Live Demo
                  </a>` : '' }
                  ${ p.repoUrl ? `<a href="${escapeHtml(p.repoUrl)}" target="_blank" rel="noopener" class="project-card__link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                      fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                    GitHub
                  </a>` : '' }
                </div>`
              : ''
            }
          </div>
        </article>
      `;
    }).join('');
  }

  /* =========================================================
     RENDER — REVIEWS
  ========================================================= */
  function renderReviews(reviews) {
    const container = $('#profile-reviews');

    if (!reviews || reviews.length === 0) {
      container.innerHTML = `<div class="reviews-grid__empty">
        Nenhum depoimento ainda. Os primeiros aparecerão aqui após contratos via Orbit.
      </div>`;
      return;
    }

    container.innerHTML = reviews.map(r => `
      <article class="review-card">
        <span class="review-card__quote-icon" aria-hidden="true">"</span>
        <p class="review-card__content">"${escapeHtml(r.content)}"</p>
        <div class="review-card__author">
          <div class="review-card__avatar">${escapeHtml((r.companyName || '?')[0].toUpperCase())}</div>
          <div>
            <p class="review-card__company">${escapeHtml(r.companyName || 'Empresa')}</p>
            <p class="review-card__role">${escapeHtml(r.reviewerRole || '')}</p>
          </div>
        </div>
      </article>
    `).join('');
  }

  /* =========================================================
     LOAD PROFILE
  ========================================================= */
  async function loadProfile() {
    try {
      const res = await api(`/api/users/${targetId}/profile`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.showToast(data.error || 'Erro ao carregar perfil.', 'error');
        return;
      }
      const data = await res.json();

      // Sincroniza currentUser + localStorage com os dados frescos quando é o próprio perfil
      if (data.user.id === currentUser.id) {
        Object.assign(currentUser, data.user);
        localStorage.setItem('orbit_user', JSON.stringify(currentUser));
      }

      renderHero(data.user, data.stats);
      if (data.user.type === 'company') {
        renderCompanyProfile();
      } else {
        renderAbout(data.user);
        renderSkills(data.user);
        renderProjects(data.projects);
        renderReviews(data.reviews);
      }

    } catch {
      window.showToast('Não foi possível conectar ao servidor.', 'error');
    }
  }

  /* =========================================================
     PERFIL DE EMPRESA (conta dona da conta) — corpo estilo empresa-perfil
  ========================================================= */
  let companyData = null;
  const CO_STAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.9 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>';
  function coInitials(name){ return (name||'?').split(' ').filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join(''); }
  function coChips(arr){ return (arr||[]).slice(0,4).map(s=>`<span class="pco-chip">${escapeHtml(s)}</span>`).join(''); }
  function coGalleryImg(url){ return `<img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`; }
  function renderCoGallery(images, overlay){
    const cells = [];
    cells.push(`<div class="pco-gallery__cell pco-gallery__cell--large">${images[0] ? coGalleryImg(images[0]) : ''}${overlay ? `<div class="pco-gallery__overlay"><div class="pco-gallery__overlay-title">${escapeHtml(overlay.title || '')}</div><div class="pco-gallery__overlay-text">${escapeHtml(overlay.text || '')}</div></div>` : ''}</div>`);
    if (images[1]) cells.push(`<div class="pco-gallery__cell">${coGalleryImg(images[1])}</div>`);
    if (images[2]) cells.push(`<div class="pco-gallery__cell">${coGalleryImg(images[2])}</div>`);
    return `<div class="pco-gallery">${cells.join('')}</div>`;
  }

  async function renderCompanyProfile() {
    const devBody = $('#profile-dev-body'); if (devBody) devBody.hidden = true;
    const coBody  = $('#profile-company-body'); if (coBody) coBody.hidden = false;

    try {
      const res = await api('/api/companies/me');
      const d = res.ok ? await res.json() : {};
      companyData = d.company || null;
    } catch { companyData = null; }

    if (!companyData) {
      ['#pco-culture-section', '#pco-jobs-section', '#pco-testimonials-section'].forEach(s => { const el = $(s); if (el) el.hidden = true; });
      $('#pco-empty').hidden = false;
      $('#pco-about').textContent = 'Complete o perfil da sua empresa para exibir as informações aqui.';
      ['#pco-stat-employees', '#pco-stat-projects', '#pco-stat-countries', '#pco-stat-rating'].forEach(s => { $(s).textContent = '—'; });
      return;
    }

    let stats = {}, jobs = [], company = companyData;
    try {
      const r2 = await api('/api/companies/' + encodeURIComponent(companyData.id));
      if (r2.ok) { const dd = await r2.json(); company = dd.company || companyData; stats = dd.stats || {}; jobs = dd.jobs || []; }
    } catch {}
    fillCompanyBody(company, stats, jobs);
  }

  function fillCompanyBody(c, stats, jobs) {
    $('#pco-about').textContent = c.about || 'Esta empresa ainda não adicionou uma descrição.';
    $('#pco-stat-employees').textContent = stats.employees != null ? stats.employees : '—';
    $('#pco-stat-projects').textContent  = stats.projects != null ? stats.projects : (stats.jobs != null ? stats.jobs : '—');
    $('#pco-stat-countries').textContent = stats.countries != null ? stats.countries : '—';
    $('#pco-stat-rating').textContent    = stats.rating != null ? stats.rating : '—';

    const images = Array.isArray(c.cultureImages) ? c.cultureImages.filter(Boolean) : [];
    const culture = Array.isArray(c.culture) ? c.culture : [];
    if (images.length) {
      $('#pco-culture').innerHTML = renderCoGallery(images, culture[0]);
    } else if (culture.length) {
      $('#pco-culture').innerHTML = culture.map(v => `
        <div class="pco-culture__card">
          <div class="pco-culture__icon">${CO_STAR}</div>
          <div class="pco-culture__title">${escapeHtml(v.title || '')}</div>
          <div class="pco-culture__text">${escapeHtml(v.text || '')}</div>
        </div>`).join('');
    } else { $('#pco-culture-section').hidden = true; }

    $('#pco-jobs-count').textContent = jobs.length;
    $('#pco-jobs').innerHTML = jobs.length
      ? jobs.map(j => `
        <div class="pco-job">
          <span class="pco-job__tag">${escapeHtml(j.modality || 'Vaga')}</span>
          <div class="pco-job__title">${escapeHtml(j.title)}</div>
          <div class="pco-job__desc">${escapeHtml(j.description || '')}</div>
          <div class="pco-job__chips">${coChips(j.skills)}</div>
          <a class="pco-job__cta" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(j.id)}">Ver vaga</a>
        </div>`).join('')
      : '<p class="pco-jobs__empty">Nenhuma vaga publicada no momento.</p>';

    const ts = Array.isArray(c.testimonials) ? c.testimonials : [];
    if (ts.length) {
      $('#pco-testimonials').innerHTML = ts.map(t => `
        <div class="pco-testimonial">
          <span class="pco-testimonial__badge">99</span>
          <p class="pco-testimonial__quote">${escapeHtml(t.quote || '')}</p>
          <div class="pco-testimonial__author">
            <div class="pco-testimonial__avatar">${escapeHtml(coInitials(t.authorName))}</div>
            <div>
              <div class="pco-testimonial__name">${escapeHtml(t.authorName || '')}</div>
              <div class="pco-testimonial__role">${escapeHtml(t.authorRole || '')}</div>
            </div>
          </div>
        </div>`).join('');
    } else { $('#pco-testimonials-section').hidden = true; }
  }

  /* =========================================================
     EDIT MODAL — abrir, popular, salvar
  ========================================================= */
  const editOverlay   = $('#edit-modal-overlay');
  const editBtn       = $('#profile-edit-btn');
  const closeBtn      = $('#edit-modal-close');
  const cancelBtn     = $('#edit-modal-cancel');
  const saveBtn       = $('#edit-modal-save');
  const avatarInput   = $('#edit-avatar-input');
  const avatarRemove  = $('#edit-avatar-remove');
  const avatarPreview = $('#edit-avatar-preview');
  const resumeInput   = $('#edit-resume-input');
  const resumeRemove  = $('#edit-resume-remove');
  const resumeInfo    = $('#edit-resume-info');
  const resumeNameEl  = $('#edit-resume-name');
  const bioTextarea   = $('#edit-bio');
  const bioCount      = $('#edit-bio-count');

  // Limites
  const MAX_AVATAR_BYTES = 10 * 1024 * 1024;  // 10 MB
  const MAX_RESUME_BYTES = 10 * 1024 * 1024;  // 10 MB

  // Estado local — base64 dos arquivos pendentes (null = remover, undefined = não mexer)
  let pendingAvatar     = undefined;
  let pendingResume     = undefined;
  let pendingResumeName = undefined;
  let pendingCultureImages = []; // galeria de cultura (conta empresa)

  function openEditModal() {
    const u = currentUser;
    const isCompany = u.type === 'company';

    // Alterna blocos do formulário conforme o tipo de conta
    const devFields = $('#edit-dev-fields'); if (devFields) devFields.hidden = isCompany;
    const coFields  = $('#edit-company-fields'); if (coFields) coFields.hidden = !isCompany;
    const nameLabel = document.querySelector('label[for="edit-name"]');
    if (nameLabel) nameLabel.textContent = isCompany ? 'Nome da empresa' : 'Nome completo';

    if (isCompany) {
      const c = companyData || {};
      $('#edit-name').value        = c.name || u.name || '';
      $('#edit-headline').value    = c.tagline || '';
      $('#edit-co-about').value    = c.about || '';
      $('#edit-co-industry').value = c.industry || '';
      $('#edit-co-location').value = c.location || '';
      $('#edit-co-size').value     = c.size || '';
      $('#edit-co-founded').value  = c.founded || '';
      $('#edit-co-website').value  = c.website || '';
      pendingCultureImages = Array.isArray(c.cultureImages) ? [...c.cultureImages] : [];
      renderGalleryThumbs();
    } else {
      // Popula campos (dev)
      $('#edit-name').value     = u.name     || '';
      $('#edit-headline').value = u.headline || '';
      $('#edit-bio').value      = u.bio      || '';
      $('#edit-skills').value   = (u.skills || []).join(', ');
      $('#edit-github').value   = u.github   || '';
      $('#edit-linkedin').value = u.linkedin || '';
      $('#edit-available').checked = !!u.available;
    }

    // Avatar preview
    setAvatar(avatarPreview, u.avatarUrl, u.name, '#edit-avatar-initials');

    // Currículo
    if (u.resumeUrl) {
      resumeNameEl.textContent = u.resumeFileName || 'curriculo.pdf';
      resumeInfo.style.display = '';
    } else {
      resumeInfo.style.display = 'none';
    }

    // Reset estado pendente
    pendingAvatar     = undefined;
    pendingResume     = undefined;
    pendingResumeName = undefined;

    // Atualiza contador de bio
    updateBioCount();

    // Abre
    editOverlay.classList.add('edit-modal-overlay--open');
    editOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#edit-name').focus(), 100);
  }

  function closeEditModal() {
    editOverlay.classList.remove('edit-modal-overlay--open');
    editOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Aciona modal
  editBtn.addEventListener('click', openEditModal);
  closeBtn.addEventListener('click', closeEditModal);
  cancelBtn.addEventListener('click', closeEditModal);

  // Fecha ao clicar no backdrop
  editOverlay.addEventListener('click', (e) => {
    if (e.target === editOverlay) closeEditModal();
  });

  // Fecha com Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editOverlay.classList.contains('edit-modal-overlay--open')) {
      closeEditModal();
    }
  });

  // Contador de bio
  function updateBioCount() {
    bioCount.textContent = `${bioTextarea.value.length} / 2000`;
  }
  bioTextarea.addEventListener('input', updateBioCount);

  // Helper: lê arquivo como data URL base64
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  // ===== Galeria (Cultura e Valores) — upload de várias imagens (conta empresa) =====
  function renderGalleryThumbs() {
    const grid = $('#edit-gallery-grid');
    if (!grid) return;
    grid.innerHTML = pendingCultureImages.map((src, i) => `
      <div class="edit-gallery__thumb">
        <img src="${src}" alt="" />
        <button type="button" class="edit-gallery__remove" data-gallery-remove="${i}" aria-label="Remover imagem">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  }
  const galleryInput = $('#edit-gallery-input');
  if (galleryInput) {
    galleryInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { window.showToast(`"${file.name}": apenas JPG, PNG ou WebP.`, 'error'); continue; }
        if (file.size > MAX_AVATAR_BYTES) { window.showToast(`"${file.name}": muito grande (máx 10MB).`, 'error'); continue; }
        try { pendingCultureImages.push(await fileToDataUrl(file)); } catch {}
      }
      galleryInput.value = '';
      renderGalleryThumbs();
    });
  }
  const galleryGrid = $('#edit-gallery-grid');
  if (galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gallery-remove]');
      if (!btn) return;
      pendingCultureImages.splice(Number(btn.getAttribute('data-gallery-remove')), 1);
      renderGalleryThumbs();
    });
  }

  // Upload de avatar
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      window.showToast('Apenas JPG, PNG ou WebP.', 'error');
      avatarInput.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      window.showToast('Imagem muito grande. Máx 10MB.', 'error');
      avatarInput.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      pendingAvatar = dataUrl;
      // Atualiza preview
      avatarPreview.querySelector('img')?.remove();
      const img = document.createElement('img');
      img.src = dataUrl;
      avatarPreview.appendChild(img);
      const initialsEl = $('#edit-avatar-initials');
      if (initialsEl) initialsEl.style.display = 'none';
    } catch {
      window.showToast('Erro ao processar imagem.', 'error');
    }
  });

  // Remover avatar
  avatarRemove.addEventListener('click', () => {
    pendingAvatar = null;
    avatarInput.value = '';
    avatarPreview.querySelector('img')?.remove();
    const initialsEl = $('#edit-avatar-initials');
    if (initialsEl) {
      initialsEl.style.display = '';
      initialsEl.textContent = initials(currentUser.name);
    }
  });

  // Upload de currículo
  resumeInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      window.showToast('Apenas arquivos PDF.', 'error');
      resumeInput.value = '';
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      window.showToast('Currículo muito grande. Máx 10MB.', 'error');
      resumeInput.value = '';
      return;
    }

    try {
      pendingResume     = await fileToDataUrl(file);
      pendingResumeName = file.name;
      resumeNameEl.textContent = file.name;
      resumeInfo.style.display = '';
    } catch {
      window.showToast('Erro ao processar currículo.', 'error');
    }
  });

  // Remover currículo
  resumeRemove.addEventListener('click', () => {
    pendingResume     = null;
    pendingResumeName = null;
    resumeInput.value = '';
    resumeInfo.style.display = 'none';
  });

  // SALVAR
  saveBtn.addEventListener('click', async () => {
    const name = $('#edit-name').value.trim();
    if (!name) {
      window.showToast('Nome é obrigatório.', 'error');
      return;
    }

    // ===== Conta EMPRESA: salva na coleção companies (PUT /api/companies/me) =====
    if (currentUser.type === 'company') {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
      const foundedRaw = $('#edit-co-founded').value.trim();
      const coPayload = {
        name,
        tagline:  $('#edit-headline').value.trim(),
        about:    $('#edit-co-about').value.trim(),
        industry: $('#edit-co-industry').value.trim(),
        location: $('#edit-co-location').value.trim(),
        size:     $('#edit-co-size').value,
        founded:  foundedRaw ? parseInt(foundedRaw, 10) : null,
        website:  $('#edit-co-website').value.trim(),
        cultureImages: pendingCultureImages,
      };
      try {
        const r = await api('/api/companies/me', { method: 'PUT', body: JSON.stringify(coPayload) });
        const cd = await r.json();
        if (!r.ok) { window.showToast(cd.error || 'Erro ao salvar.', 'error'); return; }
        companyData = cd.company || companyData;
        // mantém nome + avatar do usuário em sincronia (header)
        const userPatch = { name };
        if (pendingAvatar !== undefined) userPatch.avatarUrl = pendingAvatar;
        const ur = await api(`/api/users/${currentUser.id}`, { method: 'PATCH', body: JSON.stringify(userPatch) });
        const ud = await ur.json().catch(() => ({}));
        if (ur.ok) { Object.assign(currentUser, ud); localStorage.setItem('orbit_user', JSON.stringify(currentUser)); }
        await loadProfile();
        window.showToast('Perfil da empresa atualizado!', 'success');
        closeEditModal();
      } catch {
        window.showToast('Erro de conexão. Tente novamente.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar alterações';
      }
      return;
    }

    // Monta o payload — só envia campos que mudaram seria ideal, mas
    // aqui mandamos tudo pra simplificar. Backend tem whitelist.
    const payload = {
      name,
      headline: $('#edit-headline').value.trim() || null,
      bio:      $('#edit-bio').value.trim() || null,
      skills:   $('#edit-skills').value
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean),
      github:   $('#edit-github').value.trim() || null,
      linkedin: $('#edit-linkedin').value.trim() || null,
      available: $('#edit-available').checked,
    };

    // Arquivos: só inclui se houve mudança
    if (pendingAvatar !== undefined) payload.avatarUrl = pendingAvatar;
    if (pendingResume !== undefined) {
      payload.resumeUrl      = pendingResume;
      payload.resumeFileName = pendingResumeName;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      const res = await api(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        body:   JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Erro ao salvar.', 'error');
        return;
      }

      // Atualiza localStorage e variável atual
      Object.assign(currentUser, data);
      localStorage.setItem('orbit_user', JSON.stringify(currentUser));

      // Re-render header + hero
      renderHeader();
      // Recarrega o perfil para refletir todas as mudanças
      await loadProfile();

      window.showToast('Perfil atualizado com sucesso!', 'success');
      closeEditModal();
    } catch {
      window.showToast('Erro de conexão. Tente novamente.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar alterações';
    }
  });

  /* =========================================================
     DEACTIVATE MODAL — pedir código → digitar código → confirmar
  ========================================================= */
  const deactivateOverlay  = $('#deactivate-modal-overlay');
  const deactivateBtn      = $('#danger-deactivate-btn');
  const deactivateClose    = $('#deactivate-modal-close');
  const deactivateCancel   = $('#deactivate-cancel');
  const deactivateAction   = $('#deactivate-action');
  const deactivateStep1    = $('#deactivate-step-1');
  const deactivateStep2    = $('#deactivate-step-2');
  const deactivateCodeIn   = $('#deactivate-code');
  const deactivateResend   = $('#deactivate-resend');
  const deactivateTarget   = $('#deactivate-target-email');

  let deactivateStep = 1;

  function openDeactivateModal() {
    closeEditModal();      // fecha o de edição se estiver aberto
    deactivateStep = 1;
    deactivateStep1.style.display = '';
    deactivateStep2.style.display = 'none';
    deactivateAction.textContent  = 'Enviar código por e-mail';
    deactivateAction.classList.remove('edit-modal__btn--danger');
    deactivateAction.classList.add('edit-modal__btn--primary');
    deactivateCodeIn.value = '';

    deactivateOverlay.classList.add('edit-modal-overlay--open');
    deactivateOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDeactivateModal() {
    deactivateOverlay.classList.remove('edit-modal-overlay--open');
    deactivateOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  deactivateBtn.addEventListener('click', openDeactivateModal);
  deactivateClose.addEventListener('click', closeDeactivateModal);
  deactivateCancel.addEventListener('click', closeDeactivateModal);

  deactivateOverlay.addEventListener('click', (e) => {
    if (e.target === deactivateOverlay) closeDeactivateModal();
  });

  // Solicitar código
  async function requestDeactivationCode() {
    deactivateAction.disabled = true;
    deactivateAction.textContent = 'Enviando...';

    try {
      const res = await api('/api/auth/deactivate/request', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Erro ao enviar código.', 'error');
        return false;
      }
      window.showToast('Código enviado! Verifique seu e-mail.', 'success');
      return true;
    } catch {
      window.showToast('Erro de conexão.', 'error');
      return false;
    } finally {
      deactivateAction.disabled = false;
    }
  }

  // Confirmar código
  async function confirmDeactivation(code) {
    deactivateAction.disabled = true;
    deactivateAction.textContent = 'Confirmando...';

    try {
      const res = await api('/api/auth/deactivate/confirm', {
        method: 'POST',
        body:   JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Código inválido.', 'error');
        deactivateAction.disabled = false;
        deactivateAction.textContent = 'Confirmar desativação';
        return;
      }

      window.showToast('Conta desativada. Até logo!', 'success');
      // Limpa sessão e volta pro login
      setTimeout(() => {
        localStorage.removeItem('orbit_token');
        localStorage.removeItem('orbit_user');
        window.location.href = '/pages/auth.html?tab=login';
      }, 1800);
    } catch {
      window.showToast('Erro de conexão.', 'error');
      deactivateAction.disabled = false;
      deactivateAction.textContent = 'Confirmar desativação';
    }
  }

  // Botão principal — alterna entre etapa 1 e 2
  deactivateAction.addEventListener('click', async () => {
    if (deactivateStep === 1) {
      const ok = await requestDeactivationCode();
      if (!ok) return;
      // Avança pra etapa 2
      deactivateStep = 2;
      deactivateStep1.style.display = 'none';
      deactivateStep2.style.display = '';
      deactivateTarget.textContent = currentUser.email;
      deactivateAction.textContent  = 'Confirmar desativação';
      deactivateAction.classList.remove('edit-modal__btn--primary');
      deactivateAction.classList.add('edit-modal__btn--danger');
      setTimeout(() => deactivateCodeIn.focus(), 100);
    } else {
      const code = deactivateCodeIn.value.trim();
      if (!/^\d{6}$/.test(code)) {
        window.showToast('Digite os 6 dígitos do código.', 'error');
        return;
      }
      await confirmDeactivation(code);
    }
  });

  // Reenviar código
  deactivateResend.addEventListener('click', async (e) => {
    e.preventDefault();
    await requestDeactivationCode();
  });

  // Aceitar só dígitos no input do código
  deactivateCodeIn.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  /* =========================================================
     INIT
  ========================================================= */
  renderHeader();
  loadProfile();

})();
