// empresa-candidatos.js — Orbit · Candidatos por Vaga (#12 — Eduardo)
// JS puro. Backend: GET /api/jobs/:id/applications + ciclo de contratação (Bloco B).

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
  const params = new URLSearchParams(window.location.search);
  let jobId = params.get('id');

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
  function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); }

  const STATUS_LABEL = { enviada: 'Enviada', em_analise: 'Em Análise', entrevista: 'Entrevista', recusado: 'Recusado', contratado: 'Contratado', finalizado: 'Finalizado' };
  const DEV_CRITERIA = [
    { key: 'tecnica',         label: 'Qualidade técnica' },
    { key: 'comunicacao',     label: 'Comunicação' },
    { key: 'comprometimento', label: 'Comprometimento' },
    { key: 'prazos',          label: 'Cumprimento de prazos' },
  ];

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
  let applicants = [];
  let isOwner = false;

  function renderIdentity() {
    $('#sidebar-company-name').textContent = currentUser.name || 'Empresa';
  }

  function effStatus(a) { return a.effectiveStatus || a.status || 'enviada'; }

  /* ===== RENDER ===== */
  function buildCard(a) {
    const c = a.candidate || {};
    const skills = c.skills || [];
    const shown = skills.slice(0, 4).map(s => `<span class="cand-tag">${escapeHtml(s)}</span>`).join('');
    const extra = skills.length > 4 ? `<span class="cand-tag cand-tag--more">+${skills.length - 4} skills</span>` : '';
    const avatar = c.avatarUrl ? `<img src="${escapeHtml(c.avatarUrl)}" alt="${escapeHtml(c.name)}" />` : `<span>${initials(c.name)}</span>`;
    const st = effStatus(a);
    const hired = st === 'contratado' || st === 'finalizado';

    // Controles de status do funil + Contratar (só a empresa dona, antes da contratação)
    const statusControls = (isOwner && !hired) ? `
        <select class="cand-status-select" data-status-select aria-label="Status da candidatura">
          ${['enviada', 'em_analise', 'entrevista', 'recusado'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
        </select>
        <button type="button" class="cand-btn-primary" data-action="hire">Contratar</button>` : '';

    // Informações do contrato
    const contractInfo = hired ? `
          <div class="cand-contract">
            <span class="cand-contract__type">${a.contractType === 'clt' ? 'CLT' : 'Freelance'}</span>
            ${a.contractStart ? `<span class="cand-contract__dates">${fmtDate(a.contractStart)}${a.contractEnd ? ' → ' + fmtDate(a.contractEnd) : ''}</span>` : ''}
            ${st === 'finalizado' ? '<span class="cand-contract__done">Concluído</span>' : ''}
            ${(isOwner && a.contractType === 'freelance' && st === 'contratado') ? '<button type="button" class="cand-link-btn" data-action="renew">Renovar</button>' : ''}
            ${(isOwner && st === 'contratado') ? '<button type="button" class="cand-link-btn cand-link-btn--danger" data-action="finish">Encerrar</button>' : ''}
          </div>` : '';

    // Bloco de avaliação do candidato (empresa → dev)
    const myReview = a.myReview;
    const reviewBlock = (isOwner && a.canReview) ? `
          <div class="cand-review">
            ${myReview
              ? `<span class="cand-review__done">Você avaliou este profissional: ★ ${myReview.overall}</span> <button type="button" class="cand-link-btn" data-action="rate">Editar avaliação</button>`
              : `<button type="button" class="cand-btn-primary cand-btn-primary--sm" data-action="rate">Avaliar candidato</button>`}
          </div>` : '';

    return `
      <article class="cand-card" data-app-id="${escapeHtml(a.id)}" data-user-id="${escapeHtml(c.id || '')}">
        <div class="cand-card__avatar">${avatar}</div>
        <div class="cand-card__body">
          <div class="cand-card__top">
            <span class="cand-card__name">${escapeHtml(c.name || 'Candidato')}</span>
            <span class="cand-card__role">${escapeHtml(c.title || c.headline || 'Desenvolvedor(a)')}</span>
          </div>
          <p class="cand-card__desc">${escapeHtml(c.bio || a.coverMessage || 'Candidatura enviada para a vaga.')}</p>
          <div class="cand-card__skills">${shown}${extra}</div>
          ${contractInfo}
          ${reviewBlock}
          <div class="cand-form-slot" data-form-slot hidden></div>
        </div>
        <div class="cand-card__actions">
          <span class="cand-status cand-status--${st}">${escapeHtml(STATUS_LABEL[st] || st)}</span>
          ${statusControls}
          ${(isOwner && !hired && st !== 'recusado') ? `<a class="cand-btn-ghost" href="/pages/entrevistas.html?dev=${encodeURIComponent(c.id || '')}&vaga=${encodeURIComponent(jobId || '')}">Agendar entrevista</a>` : ''}
          <a class="cand-btn-ghost" href="/pages/empresa-talento.html?id=${encodeURIComponent(c.id || '')}">Ver Perfil</a>
        </div>
      </article>`;
  }

  /* ===== FORMULÁRIOS INLINE (no slot do card) ===== */
  function hireFormHtml() {
    return `
      <div class="cand-inline">
        <h4 class="cand-inline__title">Contratar candidato</h4>
        <label class="cand-inline__field">Tipo de contrato
          <select data-hire-type>
            <option value="clt">CLT (tempo integral)</option>
            <option value="freelance">Freelance / PJ</option>
          </select>
        </label>
        <label class="cand-inline__field" data-hire-end-wrap hidden>Data de fim do contrato
          <input type="date" data-hire-end />
        </label>
        <div class="cand-inline__actions">
          <button type="button" class="cand-link-btn" data-cancel>Cancelar</button>
          <button type="button" class="cand-btn-primary cand-btn-primary--sm" data-hire-confirm>Confirmar contratação</button>
        </div>
      </div>`;
  }
  function rateFormHtml(existing) {
    const cr = (existing && existing.criteria) || {};
    return `
      <div class="cand-inline">
        <h4 class="cand-inline__title">Avaliar profissional</h4>
        <div class="cand-inline__grid">
          ${DEV_CRITERIA.map(c => `
            <label class="cand-inline__field">${c.label}
              <select data-crit="${c.key}">
                ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(cr[c.key]) === n ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>`).join('')}
        </div>
        <textarea class="cand-inline__comment" data-rate-comment placeholder="Observações (opcional)" maxlength="800">${escapeHtml((existing && existing.comment) || '')}</textarea>
        <div class="cand-inline__actions">
          <button type="button" class="cand-link-btn" data-cancel>Cancelar</button>
          <button type="button" class="cand-btn-primary cand-btn-primary--sm" data-rate-confirm>${existing ? 'Atualizar avaliação' : 'Enviar avaliação'}</button>
        </div>
      </div>`;
  }
  function openSlot(card, html) {
    const slot = card.querySelector('[data-form-slot]');
    slot.innerHTML = html; slot.hidden = false;
  }
  function closeSlot(card) {
    const slot = card.querySelector('[data-form-slot]');
    slot.innerHTML = ''; slot.hidden = true;
  }

  function applyFilter(list) {
    const f = $('#filter-status').value;
    return f ? list.filter(a => effStatus(a) === f) : list;
  }

  function renderList() {
    const box = $('#cand-list');
    const filtered = applyFilter(applicants);
    if (!filtered.length) {
      box.innerHTML = `
        <div class="cand-empty">
          <svg class="cand-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p class="cand-empty__title">Nenhum candidato neste filtro</p>
          <p class="cand-empty__text">Ajuste o filtro de status para ver outros candidatos.</p>
        </div>`;
      return;
    }
    box.innerHTML = filtered.map(buildCard).join('');
  }

  /* ===== AÇÕES (backend) ===== */
  async function mutate(path, body, okMsg) {
    try {
      const res = await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Não foi possível concluir a ação.', 'error'); return false; }
      if (okMsg) toast(okMsg, 'success');
      await load();
      return true;
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
      return false;
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#filter-status').addEventListener('change', renderList);
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });

    $('#cand-list').addEventListener('change', async (ev) => {
      const sel = ev.target.closest('[data-status-select]');
      if (!sel) return;
      const card = sel.closest('[data-app-id]');
      const appId = card.getAttribute('data-app-id');
      try {
        const res = await api(`/api/applications/${appId}`, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { toast(data.error || 'Erro ao atualizar status.', 'error'); return; }
        const app = applicants.find(a => a.id === appId); if (app) app.status = sel.value;
        renderList();
        toast('Status atualizado.', 'success');
      } catch (e) { if (e.message !== 'Token expirado') toast('Erro de conexão.', 'error'); }
    });

    $('#cand-list').addEventListener('click', async (ev) => {
      const card = ev.target.closest('[data-app-id]');
      if (!card) return;
      const appId = card.getAttribute('data-app-id');
      const app = applicants.find(a => a.id === appId);

      if (ev.target.closest('[data-cancel]')) { closeSlot(card); return; }
      if (ev.target.closest('[data-action="hire"]')) {
        openSlot(card, hireFormHtml());
        const typeSel = card.querySelector('[data-hire-type]');
        const endWrap = card.querySelector('[data-hire-end-wrap]');
        const sync = () => { endWrap.hidden = typeSel.value !== 'freelance'; };
        typeSel.addEventListener('change', sync); sync();
        return;
      }
      if (ev.target.closest('[data-hire-confirm]')) {
        const type = card.querySelector('[data-hire-type]').value;
        const body = { contractType: type };
        if (type === 'freelance') {
          const end = card.querySelector('[data-hire-end]').value;
          if (!end) { toast('Informe a data de fim do contrato freelance.', 'error'); return; }
          body.contractEnd = end;
        }
        await mutate(`/api/applications/${appId}/hire`, body, 'Candidato contratado!');
        return;
      }
      if (ev.target.closest('[data-action="renew"]')) {
        const novo = window.prompt('Nova data de fim do contrato (AAAA-MM-DD):', '');
        if (!novo) return;
        await mutate(`/api/applications/${appId}/renew`, { contractEnd: novo }, 'Contrato renovado.');
        return;
      }
      if (ev.target.closest('[data-action="finish"]')) {
        if (!window.confirm('Encerrar o contrato deste profissional? Isso libera a avaliação mútua.')) return;
        await mutate(`/api/applications/${appId}/finish`, {}, 'Contrato encerrado.');
        return;
      }
      if (ev.target.closest('[data-action="rate"]')) {
        openSlot(card, rateFormHtml(app && app.myReview));
        return;
      }
      if (ev.target.closest('[data-rate-confirm]')) {
        const criteria = {};
        DEV_CRITERIA.forEach(c => { criteria[c.key] = parseInt(card.querySelector(`[data-crit="${c.key}"]`).value, 10); });
        const comment = card.querySelector('[data-rate-comment]').value.trim();
        await mutate(`/api/applications/${appId}/review`, { criteria, comment }, 'Avaliação registrada!');
        return;
      }
    });
  }

  /* ===== CARGA ===== */
  async function load() {
    // Esta tela é o DETALHE de uma vaga; sem ?id= o lugar certo é a lista
    if (!jobId) { window.location.replace('/pages/empresa-vagas.html'); return; }
    try {
      const res = await api(`/api/jobs/${jobId}/applications`);
      if (!res.ok) { $('#cand-loading').textContent = 'Vaga não encontrada.'; return; }
      const data = await res.json();
      applicants = data.applicants || [];
      isOwner = !!data.isOwner;

      $('#cand-job-title').textContent = data.job.title;
      $('#cand-job-location').textContent = data.job.location || data.job.modality || '';
      $('#cand-job-count').textContent = `${data.funnel.total} Candidato${data.funnel.total !== 1 ? 's' : ''} Aplicado${data.funnel.total !== 1 ? 's' : ''}`;
      const setFn = (id, v) => { const el = $(id); if (el) el.textContent = v; };
      setFn('#funnel-total', data.funnel.total);
      setFn('#funnel-analise', data.funnel.em_analise);
      setFn('#funnel-entrevista', data.funnel.entrevista);
      setFn('#funnel-recusado', data.funnel.recusado);
      setFn('#funnel-contratado', data.funnel.contratado || 0);
      setFn('#funnel-finalizado', data.funnel.finalizado || 0);

      renderList();
      $('#cand-loading').hidden = true;
      $('#cand-content').hidden = false;
    } catch (err) {
      if (err.message !== 'Token expirado') $('#cand-loading').textContent = 'Não foi possível carregar os candidatos.';
    }
  }

  function init() { renderIdentity(); setupEvents(); load(); }
  init();

})();
