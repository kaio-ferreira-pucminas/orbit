// entrevistas.js — Orbit · Central de Entrevistas (dev + empresa)
// JS puro, sem framework. Backend: /api/interviews/* (+ /api/jobs, /api/companies/me,
// /api/jobs/:id/applications e /api/conversations). Visões por papel:
//   EMPRESA → agenda, remarca, conclui, cancela e conversa com candidatos.
//   DEV     → acompanha, solicita remarcação e entra em contato com a empresa.

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
  const isCompany   = currentUser.type === 'company';

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

  /* ===== CONSTANTES ===== */
  const ACTIVE_STATUSES = ['agendada', 'remarcacao_solicitada'];
  const STATUS_LABEL = {
    agendada: 'Agendada',
    remarcacao_solicitada: 'Remarcação solicitada',
    realizada: 'Realizada',
    cancelada: 'Cancelada',
  };
  const MODE_LABEL = { video: 'Vídeo chamada', presencial: 'Presencial', telefone: 'Telefone' };

  // Ícones SVG inline (estilo Feather: stroke currentColor, stroke-width 2)
  function svg(paths, size) {
    return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }
  const ICON = {
    video:    svg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'),
    pin:      svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    phone:    svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    clock:    svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    external: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
    alert:    svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', 48),
  };
  const MODE_ICON = { video: ICON.video, presencial: ICON.pin, telefone: ICON.phone };

  /* ===== ESTADO ===== */
  let interviews  = [];          // entrevistas do usuário (já vêm ordenadas por scheduledAt asc)
  let companyJobs = [];          // vagas da empresa logada (apenas papel empresa)
  let myCompany   = null;        // shape de GET /api/companies/me → { company } (pode ser null)
  const appsCache = new Map();   // jobId → applicants[] (sem 'recusado')
  const filters   = { job: '', status: '', search: '' };
  let modalCtx    = { mode: 'create', interviewId: null };
  let reschedInterviewId = null;
  let queryHandled = false;

  /* ===== DATAS ===== */
  function pad(n) { return String(n).padStart(2, '0'); }
  // Date → valor de <input type="datetime-local"> no fuso local (YYYY-MM-DDTHH:MM)
  function toLocalInput(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtTime(d)  { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function fmtMonth(d) { return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(); }
  function fmtFull(d)  { return `${d.toLocaleDateString('pt-BR')} às ${fmtTime(d)}`; }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ===== IDENTIDADE / UI POR PAPEL ===== */
  function renderRoleUi() {
    $('#itv-subtitle').textContent = isCompany
      ? 'Agende e acompanhe as entrevistas com os candidatos das suas vagas.'
      : 'Acompanhe suas entrevistas e combine remarcações com as empresas.';
    $('#filter-search').placeholder = isCompany ? 'Buscar por candidato...' : 'Buscar por empresa...';
    if (isCompany) $('#btn-new-interview').hidden = false;
  }

  /* ===== CARGA ===== */
  async function loadAll() {
    try {
      const tasks = [api('/api/interviews/me').then(r => r.json())];
      if (isCompany) {
        // /api/companies/me responde { company: {...} | null } (200 mesmo sem perfil)
        tasks.push(api('/api/companies/me').then(r => r.json()).catch(() => ({ company: null })));
        tasks.push(api('/api/jobs').then(r => r.json()).catch(() => []));
      }
      const results = await Promise.all(tasks);
      interviews = (results[0] && results[0].interviews) || [];
      if (isCompany) {
        myCompany = (results[1] && results[1].company) || null;
        const allJobs = Array.isArray(results[2]) ? results[2] : [];
        companyJobs = myCompany ? allJobs.filter(j => j.companyId === myCompany.id) : [];
      }
      populateJobFilter();
      $('#itv-loading').hidden = true;
      $('#itv-content').hidden = false;
      renderAll();
      await applyQueryParams();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#itv-loading').innerHTML = '<p class="itv-empty__text">Não foi possível carregar as entrevistas. Recarregue a página.</p>';
      }
    }
  }

  // Recarrega só a lista de entrevistas (após cada mutação)
  async function reloadInterviews() {
    try {
      const res  = await api('/api/interviews/me');
      const data = await res.json();
      interviews = data.interviews || [];
      populateJobFilter();
      renderAll();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro ao atualizar a lista.', 'error');
    }
  }

  /* ===== FILTRO DE VAGA ===== */
  function populateJobFilter() {
    const sel = $('#filter-job');
    let jobs;
    if (isCompany) {
      // Empresa vê TODAS as vagas dela, mesmo sem entrevista
      jobs = companyJobs.map(j => ({ id: j.id, title: j.title }));
    } else {
      // Dev vê as vagas distintas presentes nas entrevistas
      const seen = new Map();
      interviews.forEach(i => { if (i.job && !seen.has(i.job.id)) seen.set(i.job.id, i.job.title); });
      jobs = Array.from(seen, entry => ({ id: entry[0], title: entry[1] }));
    }
    sel.innerHTML = '<option value="">Todas as vagas</option>' +
      jobs.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.title || 'Vaga')}</option>`).join('');
    sel.value = filters.job;
    if (sel.value !== filters.job) { filters.job = ''; sel.value = ''; }
  }

  /* ===== FILTRAGEM ===== */
  function matchesJob(itv)    { return !filters.job || itv.jobId === filters.job; }
  function matchesStatus(itv) { return !filters.status || itv.status === filters.status; }
  function matchesSearch(itv) {
    const q = filters.search.trim().toLowerCase();
    if (!q) return true;
    const name = isCompany
      ? (itv.candidate && itv.candidate.name) || ''
      : (itv.company && itv.company.name) || '';
    const jobTitle = (itv.job && itv.job.title) || '';
    return name.toLowerCase().includes(q) || jobTitle.toLowerCase().includes(q);
  }
  function visibleInterviews() {
    return interviews.filter(i => matchesJob(i) && matchesStatus(i) && matchesSearch(i));
  }

  /* ===== RESUMO (respeita o filtro de vaga ativo) ===== */
  function updateSummary() {
    const base  = interviews.filter(matchesJob);
    const count = st => base.filter(i => i.status === st).length;
    $('#sum-agendadas').textContent  = count('agendada');
    $('#sum-realizadas').textContent = count('realizada');
    $('#sum-canceladas').textContent = count('cancelada');
    const remarc = count('remarcacao_solicitada');
    $('#sum-remarcacao').textContent = remarc;
    $('#sum-remarcacao-card').classList.toggle('itv-summary__card--alert', remarc > 0);
  }

  /* ===== RENDER DO CARD ===== */
  function hasActiveInterview(applicationId) {
    return interviews.some(i => i.applicationId === applicationId && ACTIVE_STATUSES.includes(i.status));
  }

  function buildActions(itv) {
    const active = ACTIVE_STATUSES.includes(itv.status);
    const btns = [];
    if (isCompany) {
      if (active) {
        const remarcCls = itv.status === 'remarcacao_solicitada' ? 'itv-btn--primary' : 'itv-btn--ghost';
        btns.push(`<button type="button" class="itv-btn ${remarcCls} itv-btn--sm" data-action="edit">Remarcar</button>`);
        btns.push('<button type="button" class="itv-btn itv-btn--ghost itv-btn--sm" data-action="complete">Concluir</button>');
        btns.push('<button type="button" class="itv-btn itv-btn--danger itv-btn--sm" data-action="cancel">Cancelar</button>');
      }
      if (itv.devUserId) {
        btns.push(`<button type="button" class="itv-btn itv-btn--ghost itv-btn--sm" data-action="message" data-user="${escapeHtml(itv.devUserId)}">Mensagem</button>`);
      }
      if (itv.candidate && itv.candidate.id) {
        btns.push(`<a class="itv-btn itv-btn--ghost itv-btn--sm" href="/pages/empresa-talento.html?id=${encodeURIComponent(itv.candidate.id)}">Ver perfil</a>`);
      }
    } else {
      if (itv.status === 'agendada') {
        btns.push('<button type="button" class="itv-btn itv-btn--ghost itv-btn--sm" data-action="resched">Solicitar remarcação</button>');
      }
      if (active && itv.company && itv.company.userId) {
        btns.push(`<button type="button" class="itv-btn itv-btn--ghost itv-btn--sm" data-action="message" data-user="${escapeHtml(itv.company.userId)}">Entrar em contato</button>`);
      }
      if (itv.job && itv.job.id) {
        btns.push(`<a class="itv-btn itv-btn--ghost itv-btn--sm" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(itv.job.id)}">Ver vaga</a>`);
      }
    }
    return btns.join('');
  }

  function buildCard(itv) {
    const when = new Date(itv.scheduledAt);
    const now  = new Date();
    const dateMod = sameDay(when, now) ? 'today' : (when.getTime() < now.getTime() ? 'past' : 'future');
    const job  = itv.job || {};

    // Quem aparece no card: empresa vê o CANDIDATO; dev vê a EMPRESA
    let avatarHtml, name, role;
    if (isCompany) {
      const c = itv.candidate || {};
      avatarHtml = c.avatarUrl
        ? `<div class="itv-card__avatar"><img src="${escapeHtml(c.avatarUrl)}" alt="${escapeHtml(c.name || 'Candidato')}" /></div>`
        : `<div class="itv-card__avatar"><span>${escapeHtml(initials(c.name))}</span></div>`;
      name = c.name || 'Candidato';
      role = c.title || '';
    } else {
      const co = itv.company || {};
      avatarHtml = co.logoUrl
        ? `<div class="itv-card__avatar itv-card__avatar--logo"><img src="${escapeHtml(co.logoUrl)}" alt="${escapeHtml(co.name || 'Empresa')}" /></div>`
        : `<div class="itv-card__avatar itv-card__avatar--logo"><span>${escapeHtml(co.logoInitials || initials(co.name))}</span></div>`;
      name = co.name || 'Empresa';
      role = [job.level, job.modality].filter(Boolean).join(' · ');
    }

    // Chips: vaga + modo + duração + local/link
    const modeKey  = itv.mode || 'video';
    const chips = [];
    chips.push(`<span class="itv-chip" title="${escapeHtml(job.title || 'Vaga')}">${escapeHtml(job.title || 'Vaga')}</span>`);
    chips.push(`<span class="itv-mode">${MODE_ICON[modeKey] || ICON.video}${escapeHtml(itv.modeLabel || MODE_LABEL[modeKey] || modeKey)}</span>`);
    chips.push(`<span class="itv-mode">${ICON.clock}${escapeHtml(String(itv.durationMin || 60))} min</span>`);
    const loc = (itv.locationOrLink || '').trim();
    if (loc.indexOf('http') === 0) {
      chips.push(`<a class="itv-loc-link" href="${escapeHtml(loc)}" target="_blank" rel="noopener">${ICON.external}Abrir link</a>`);
    } else if (loc) {
      chips.push(`<span class="itv-mode">${ICON.pin}${escapeHtml(loc)}</span>`);
    }

    const notesHtml = itv.notes
      ? `<p class="itv-card__notes"><strong>Obs.:</strong> ${escapeHtml(itv.notes)}</p>` : '';

    const reschedHtml = (itv.status === 'remarcacao_solicitada' && itv.rescheduleReason)
      ? `<div class="itv-card__resched">${ICON.alert}<div><strong>Pedido de remarcação:</strong> ${escapeHtml(itv.rescheduleReason)}</div></div>` : '';

    const isLate   = isCompany && itv.status === 'agendada' && when.getTime() < now.getTime();
    const lateHtml = isLate ? `<span class="itv-card__late">${ICON.clock}Atrasada — conclua ou remarque</span>` : '';

    return `
      <article class="itv-card ${itv.status === 'cancelada' ? 'itv-card--cancelada' : ''}" data-itv-id="${escapeHtml(itv.id)}">
        <div class="itv-card__date itv-card__date--${dateMod}" aria-label="${escapeHtml(fmtFull(when))}">
          <span class="itv-card__date-day">${when.getDate()}</span>
          <span class="itv-card__date-month">${escapeHtml(fmtMonth(when))}</span>
          <span class="itv-card__date-time">${escapeHtml(fmtTime(when))}</span>
        </div>
        <div class="itv-card__body">
          <div class="itv-card__who">
            ${avatarHtml}
            <div>
              <p class="itv-card__name">${escapeHtml(name)}</p>
              ${role ? `<p class="itv-card__role">${escapeHtml(role)}</p>` : ''}
            </div>
          </div>
          <div class="itv-card__meta">${chips.join('')}</div>
          ${notesHtml}
          ${reschedHtml}
        </div>
        <div class="itv-card__side">
          <span class="itv-status itv-status--${escapeHtml(itv.status)}">${escapeHtml(STATUS_LABEL[itv.status] || itv.status)}</span>
          ${lateHtml}
          <div class="itv-card__actions">${buildActions(itv)}</div>
        </div>
      </article>`;
  }

  /* ===== RENDER DAS LISTAS ===== */
  function renderEmptyGlobal() {
    const box = $('#itv-empty');
    if (isCompany) {
      box.innerHTML = `
        ${ICON.calendar.replace('<svg ', '<svg class="itv-empty__icon" ')}
        <p class="itv-empty__title">Nenhuma entrevista ainda</p>
        <p class="itv-empty__text">Agende a primeira com um candidato das suas vagas.</p>
        <button type="button" class="itv-btn itv-btn--primary" data-action="new">Agendar entrevista</button>`;
    } else {
      box.innerHTML = `
        ${ICON.calendar.replace('<svg ', '<svg class="itv-empty__icon" ')}
        <p class="itv-empty__title">Você ainda não tem entrevistas marcadas.</p>
        <p class="itv-empty__text">Quando uma empresa agendar, ela aparece aqui e na sua Agenda.</p>`;
    }
  }

  function renderLists() {
    const upcomingSec = $('#itv-upcoming-section');
    const historySec  = $('#itv-history-section');
    const emptyBox    = $('#itv-empty');
    const filterEmpty = $('#itv-filter-empty');

    // Sem nenhuma entrevista: estado vazio por papel (esconde filtros e resumo)
    if (!interviews.length) {
      renderEmptyGlobal();
      emptyBox.hidden = false;
      filterEmpty.hidden = true;
      upcomingSec.hidden = true;
      historySec.hidden  = true;
      $('#itv-summary').hidden = true;
      $('#itv-filters').hidden = true;
      return;
    }
    emptyBox.hidden = true;
    $('#itv-summary').hidden = false;
    $('#itv-filters').hidden = false;

    const visible  = visibleInterviews();
    const upcoming = visible.filter(i => ACTIVE_STATUSES.includes(i.status)); // já em ordem asc
    const history  = visible.filter(i => i.status === 'realizada' || i.status === 'cancelada')
      .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

    // Filtros sem resultado
    if (!visible.length) {
      filterEmpty.hidden = false;
      upcomingSec.hidden = true;
      historySec.hidden  = true;
      return;
    }
    filterEmpty.hidden = true;

    upcomingSec.hidden = !upcoming.length;
    historySec.hidden  = !history.length;
    $('#upcoming-count').textContent = upcoming.length;
    $('#history-count').textContent  = history.length;
    $('#itv-upcoming').innerHTML = upcoming.map(buildCard).join('');
    $('#itv-history').innerHTML  = history.map(buildCard).join('');
  }

  function renderAll() { updateSummary(); renderLists(); }

  /* ===== MODAIS (abre/fecha por hidden; Escape e overlay fecham) ===== */
  function openModal(m)  { m.hidden = false; }
  function closeModal(m) { m.hidden = true; }

  /* ===== MODAL DE AGENDAMENTO / REMARCAÇÃO ===== */
  async function loadApplicants(jobId) {
    if (appsCache.has(jobId)) return appsCache.get(jobId);
    const res = await api(`/api/jobs/${jobId}/applications`);
    if (!res.ok) throw new Error('Falha ao carregar candidatos');
    const data = await res.json();
    const list = (data.applicants || []).filter(a => (a.effectiveStatus || a.status) !== 'recusado');
    appsCache.set(jobId, list);
    return list;
  }

  async function fillCandidateSelect(jobId, preselectAppId) {
    const sel = $('#itv-f-candidate');
    sel.disabled = true;
    sel.innerHTML = '<option value="">Carregando candidatos…</option>';
    try {
      const list = await loadApplicants(jobId);
      // resposta atrasada de uma vaga que o usuário já trocou: descarta
      if ($('#itv-f-job').value !== jobId) return;
      if (!list.length) {
        sel.innerHTML = '<option value="">Nenhum candidato nesta vaga</option>';
        return;
      }
      sel.innerHTML = '<option value="">Selecione o candidato</option>' + list.map(a => {
        const c = a.candidate || {};
        const busy  = hasActiveInterview(a.id);
        const label = `${c.name || 'Candidato'}${c.title ? ' — ' + c.title : ''}${busy ? ' — entrevista ativa' : ''}`;
        return `<option value="${escapeHtml(a.id)}"${busy ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
      sel.disabled = false;
      if (preselectAppId) {
        sel.value = preselectAppId;
        if (sel.value !== preselectAppId) sel.value = '';
      }
    } catch (err) {
      if (err.message === 'Token expirado') throw err;
      sel.innerHTML = '<option value="">Erro ao carregar candidatos</option>';
    }
  }

  function openScheduleModal(editItv) {
    // Sem perfil de empresa ou sem vagas não há o que agendar — orienta em vez
    // de abrir um modal vazio (o backend recusaria com 403/404 de toda forma)
    if (!editItv) {
      if (!myCompany) {
        toast('Complete o perfil da sua empresa (menu Perfil) antes de agendar entrevistas.', 'info');
        return;
      }
      if (!companyJobs.length) {
        toast('Você ainda não tem vagas publicadas — as entrevistas são agendadas com candidatos das suas vagas.', 'info');
        return;
      }
    }
    const modal = $('#itv-modal');
    $('#itv-form').reset();
    const dt = $('#itv-f-datetime');
    dt.min = toLocalInput(new Date()); // mínimo = agora
    $('#itv-f-duration').value = '60';
    $('#itv-f-mode').value = 'video';

    if (editItv) {
      // ── Modo edição (Remarcar): vaga/candidato viram texto fixo ──
      modalCtx = { mode: 'edit', interviewId: editItv.id };
      $('#itv-modal-title').textContent = 'Remarcar entrevista';
      $('#itv-modal-hint').textContent  = 'Ao salvar, o pedido de remarcação é resolvido e o candidato é notificado por email.';
      $('#itv-f-submit').textContent    = 'Salvar remarcação';
      $('#itv-form-pick').hidden = true;
      const fixed = $('#itv-form-fixed');
      fixed.hidden = false;
      fixed.innerHTML =
        `<strong>Vaga:</strong> ${escapeHtml((editItv.job && editItv.job.title) || 'Vaga')}<br />` +
        `<strong>Candidato:</strong> ${escapeHtml((editItv.candidate && editItv.candidate.name) || 'Candidato')}`;

      const when = new Date(editItv.scheduledAt);
      if (!isNaN(when.getTime()) && when.getTime() > Date.now()) dt.value = toLocalInput(when);
      const durSel = $('#itv-f-duration');
      durSel.value = String(editItv.durationMin || 60);
      if (!durSel.value) durSel.value = '60';
      $('#itv-f-mode').value     = MODE_LABEL[editItv.mode] ? editItv.mode : 'video';
      $('#itv-f-location').value = editItv.locationOrLink || '';
      $('#itv-f-notes').value    = editItv.notes || '';
    } else {
      // ── Modo agendamento: passo 1 (vaga → candidato) + passo 2 (detalhes) ──
      modalCtx = { mode: 'create', interviewId: null };
      $('#itv-modal-title').textContent = 'Agendar entrevista';
      $('#itv-modal-hint').textContent  = 'O candidato é notificado no app e por email com todos os detalhes.';
      $('#itv-f-submit').textContent    = 'Agendar entrevista';
      $('#itv-form-pick').hidden  = false;
      $('#itv-form-fixed').hidden = true;
      $('#itv-f-job').innerHTML = '<option value="">Selecione a vaga</option>' +
        companyJobs.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.title || 'Vaga')}</option>`).join('');
      const candSel = $('#itv-f-candidate');
      candSel.innerHTML = '<option value="">Escolha a vaga primeiro</option>';
      candSel.disabled  = true;
    }
    openModal(modal);
  }

  async function submitScheduleForm() {
    const dtVal = $('#itv-f-datetime').value;
    if (!dtVal) { toast('Informe a data e a hora da entrevista.', 'error'); return; }
    const when = new Date(dtVal);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast('A entrevista deve ser em uma data futura.', 'error');
      return;
    }
    const body = {
      scheduledAt:    when.toISOString(),
      durationMin:    parseInt($('#itv-f-duration').value, 10) || 60,
      mode:           $('#itv-f-mode').value,
      locationOrLink: $('#itv-f-location').value.trim(),
      notes:          $('#itv-f-notes').value.trim(),
    };
    if (modalCtx.mode === 'create') {
      const appId = $('#itv-f-candidate').value;
      if (!$('#itv-f-job').value || !appId) { toast('Selecione a vaga e o candidato.', 'error'); return; }
      body.applicationId = appId;
    }

    const btn = $('#itv-f-submit');
    btn.disabled = true;
    try {
      const res = modalCtx.mode === 'edit'
        ? await api(`/api/interviews/${modalCtx.interviewId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api('/api/interviews', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Não foi possível salvar a entrevista.', 'error'); return; }
      toast(modalCtx.mode === 'edit'
        ? 'Entrevista remarcada! O candidato foi notificado.'
        : 'Entrevista agendada! O candidato foi notificado por email.', 'success');
      closeModal($('#itv-modal'));
      await reloadInterviews();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ===== MODAL DE PEDIDO DE REMARCAÇÃO (dev) ===== */
  function openReschedModal(interviewId) {
    reschedInterviewId = interviewId;
    $('#itv-resched-form').reset();
    openModal($('#itv-resched-modal'));
  }

  async function submitReschedForm() {
    if (!reschedInterviewId) return;
    const btn = $('#itv-resched-submit');
    btn.disabled = true;
    try {
      const reason = $('#itv-resched-reason').value.trim();
      const res  = await api(`/api/interviews/${reschedInterviewId}/reschedule-request`, {
        method: 'POST', body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Não foi possível enviar o pedido.', 'error'); return; }
      toast('Pedido de remarcação enviado à empresa!', 'success');
      closeModal($('#itv-resched-modal'));
      await reloadInterviews();
      if (data.conversationId) {
        toast('Abrindo a conversa para combinar o novo horário…', 'info');
        setTimeout(() => {
          window.location.href = `/pages/mensagens.html?c=${encodeURIComponent(data.conversationId)}`;
        }, 1200);
      }
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ===== AÇÕES DOS CARDS ===== */
  async function postAction(path, btn, okMsg) {
    if (btn) btn.disabled = true;
    try {
      const res  = await api(path, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Não foi possível concluir a ação.', 'error'); return; }
      if (okMsg) toast(okMsg, 'success');
      await reloadInterviews();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function openConversation(targetUserId, btn) {
    if (!targetUserId) { toast('Contato indisponível para esta entrevista.', 'error'); return; }
    if (btn) btn.disabled = true;
    try {
      const res  = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ targetUserId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Não foi possível abrir a conversa.', 'error'); return; }
      window.location.href = `/pages/mensagens.html?c=${encodeURIComponent(data.id)}`;
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ===== QUERY PARAMS (?vaga=<jobId> e ?dev=<userId>) ===== */
  async function applyQueryParams() {
    if (queryHandled) return;
    queryHandled = true;
    const params = new URLSearchParams(window.location.search);

    // ?vaga → pré-seleciona o filtro de vaga
    const vaga = params.get('vaga');
    if (vaga) {
      const sel = $('#filter-job');
      sel.value = vaga;
      if (sel.value === vaga) { filters.job = vaga; renderAll(); }
      else sel.value = '';
    }

    // ?dev (empresa) → acha a candidatura do dev nas vagas da empresa e abre o modal
    const dev = params.get('dev');
    if (!dev || !isCompany) return;
    if (!companyJobs.length) {
      toast('Este talento ainda não se candidatou a nenhuma das suas vagas.', 'info');
      return;
    }
    try {
      // se a URL também trouxe ?vaga=, prioriza a candidatura daquela vaga
      const jobsToSearch = vaga
        ? [...companyJobs.filter(j => j.id === vaga), ...companyJobs.filter(j => j.id !== vaga)]
        : companyJobs;
      const results = await Promise.all(jobsToSearch.map(j =>
        loadApplicants(j.id).then(list => ({ job: j, list })).catch(() => null)
      ));
      let hit = null;
      for (const r of results) {
        if (!r) continue;
        const app = r.list.find(a => a.userId === dev || (a.candidate && a.candidate.id === dev));
        if (app) { hit = { job: r.job, app }; break; }
      }
      if (!hit) {
        toast('Este talento ainda não se candidatou a nenhuma das suas vagas.', 'info');
        return;
      }
      openScheduleModal();
      $('#itv-f-job').value = hit.job.id;
      if (hasActiveInterview(hit.app.id)) {
        toast('Este candidato já tem uma entrevista ativa nesta vaga.', 'info');
        await fillCandidateSelect(hit.job.id);
      } else {
        await fillCandidateSelect(hit.job.id, hit.app.id);
      }
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível localizar a candidatura do talento.', 'error');
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    // Filtros (combinam entre si e re-renderizam na hora)
    $('#filter-job').addEventListener('change', () => { filters.job = $('#filter-job').value; renderAll(); });
    $('#filter-status').addEventListener('change', () => { filters.status = $('#filter-status').value; renderLists(); });
    $('#filter-search').addEventListener('input', () => { filters.search = $('#filter-search').value; renderLists(); });

    // Botão do header (empresa)
    $('#btn-new-interview').addEventListener('click', () => openScheduleModal());

    // Ações delegadas nos cards + empty state
    $('#itv-content').addEventListener('click', async (ev) => {
      const actEl = ev.target.closest('[data-action]');
      if (!actEl) return;
      const action = actEl.getAttribute('data-action');
      if (action === 'new') { openScheduleModal(); return; }

      const card = actEl.closest('[data-itv-id]');
      const itv  = card ? interviews.find(i => i.id === card.getAttribute('data-itv-id')) : null;
      if (!itv) return;

      if (action === 'edit') { openScheduleModal(itv); return; }
      if (action === 'complete') { await postAction(`/api/interviews/${itv.id}/complete`, actEl, 'Entrevista marcada como realizada.'); return; }
      if (action === 'cancel') {
        if (!window.confirm('Cancelar esta entrevista? O candidato será notificado.')) return;
        await postAction(`/api/interviews/${itv.id}/cancel`, actEl, 'Entrevista cancelada.');
        return;
      }
      if (action === 'message') { await openConversation(actEl.getAttribute('data-user'), actEl); return; }
      if (action === 'resched') { openReschedModal(itv.id); return; }
    });

    // Modal de agendamento: vaga escolhida → carrega candidatos
    $('#itv-f-job').addEventListener('change', () => {
      const jid = $('#itv-f-job').value;
      if (jid) {
        fillCandidateSelect(jid).catch(() => {});
      } else {
        const candSel = $('#itv-f-candidate');
        candSel.innerHTML = '<option value="">Escolha a vaga primeiro</option>';
        candSel.disabled  = true;
      }
    });

    // Submits
    $('#itv-form').addEventListener('submit', (ev) => { ev.preventDefault(); submitScheduleForm(); });
    $('#itv-resched-form').addEventListener('submit', (ev) => { ev.preventDefault(); submitReschedForm(); });

    // Fechar modais: X e overlay (data-modal-close) + Escape
    document.querySelectorAll('.itv-modal').forEach(m => {
      m.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-modal-close]')) closeModal(m);
      });
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      // dropdown do orbit-select aberto: o Esc é dele (fecha só o painel)
      if (document.querySelector('.osel-panel:not([hidden])')) return;
      document.querySelectorAll('.itv-modal:not([hidden])').forEach(closeModal);
    });
  }

  /* ===== INIT ===== */
  function init() {
    renderRoleUi();
    setupEvents();
    loadAll();
  }
  init();

})();
