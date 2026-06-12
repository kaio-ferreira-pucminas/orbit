// vaga-detalhes.js — Orbit · Detalhes da Vaga + candidatura (#3 — Lucas Valle)
// JS puro, sem framework. Backend: JSON Server.

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

  /* ===== PARAM ===== */
  const params = new URLSearchParams(window.location.search);
  const jobId  = params.get('id');

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
  function timeAgo(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'Postada hoje';
    if (days === 1) return 'Postada há 1 dia';
    return `Postada há ${days} dias`;
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  // Renderiza a formatação leve da descrição — MESMO parser do compositor de
  // vagas (empresa-nova-vaga.js) e do preview, para o dev ver exatamente o que
  // a empresa aprovou: **negrito**, *itálico*, `código`, [link](https://...) e
  // listas com "- ". Escapa o HTML antes (sem XSS).
  function renderBlocks(part) {
    const out = [];
    let buf  = [];  // linhas de texto corrente (vira parágrafos)
    let list = [];  // itens da lista corrente
    function flushText() {
      buf.join('\n')
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .forEach(p => out.push(`<p>${p.replace(/\n/g, '<br>')}</p>`));
      buf = [];
    }
    function flushList() {
      if (list.length) out.push(`<ul>${list.map(i => `<li>${i}</li>`).join('')}</ul>`);
      list = [];
    }
    part.split('\n').forEach((line) => {
      const m = line.match(/^\s*-\s+(.+)$/);
      if (m) { flushText(); list.push(m[1].trim()); }
      else   { flushList(); buf.push(line); }
    });
    flushText();
    flushList();
    return out.join('');
  }

  function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // listas + parágrafos FORA dos <pre> (code blocks ficam intactos)
    const parts  = html.split(/<pre>[\s\S]*?<\/pre>/g);
    const blocks = html.match(/<pre>[\s\S]*?<\/pre>/g) || [];
    let result = '';
    parts.forEach((part, i) => {
      result += renderBlocks(part);
      if (blocks[i]) result += blocks[i];
    });
    return result;
  }

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

  let job = null;

  /* ===== RENDER ===== */
  function render(data) {
    job = data;
    const company = data.company || {};

    // Tracking best-effort: sinaliza visualização da vaga p/ o algoritmo de recomendação
    api('/api/activity', { method: 'POST', body: JSON.stringify({ type: 'job_view', jobId }) }).catch(() => {});

    $('#vd-logo').textContent     = company.logoInitials || initials(data.companyName);
    $('#vd-title').textContent    = data.title;
    $('#vd-company').textContent  = `${data.companyName || ''}${data.location ? ' • ' + data.location : ''}`;
    $('#vd-posted').textContent   = timeAgo(data.createdAt);
    $('#vd-salary').textContent   = data.salaryRange || data.salary || '—';
    $('#vd-level').textContent    = data.level || '—';
    $('#vd-contract').textContent = data.contractType || 'PJ ou CLT';
    $('#vd-modality').textContent = data.modality || '—';
    $('#vd-about').innerHTML      = parseMarkdown(data.description) || 'Descrição não informada.';

    // Skills
    $('#vd-skills').innerHTML = (data.skills || []).map(s => `<span class="vd-tag">${escapeHtml(s)}</span>`).join('');

    // Responsabilidades (some a seção se a vaga não informou nenhuma)
    const resp = (data.responsibilities || []).filter(Boolean);
    if (resp.length) {
      $('#vd-responsibilities').innerHTML = resp.map(r => `<li>${escapeHtml(r)}</li>`).join('');
      $('#vd-responsibilities-section').hidden = false;
    } else {
      $('#vd-responsibilities-section').hidden = true;
    }

    // Benefícios (some a seção se a vaga não informou nenhum)
    const benefits = (data.benefits || []).filter(b => b && (b.title || b.description));
    if (benefits.length) {
      $('#vd-benefits').innerHTML = benefits.map(b =>
        `<div class="vd-benefit"><span class="vd-benefit__title">${escapeHtml(b.title || '')}</span><span class="vd-benefit__desc">${escapeHtml(b.description || '')}</span></div>`
      ).join('');
      $('#vd-benefits-section').hidden = false;
    } else {
      $('#vd-benefits-section').hidden = true;
    }

    // Similares
    const sim = $('#vd-similar');
    if ((data.similar || []).length) {
      sim.innerHTML = data.similar.map(s => `
        <article class="vd-similar-card" data-job-id="${escapeHtml(s.id)}">
          <h3 class="vd-similar-card__title">${escapeHtml(s.title)}</h3>
          <p class="vd-similar-card__company">${escapeHtml(s.companyName || '')}</p>
          <div class="vd-similar-card__meta">
            <span class="vd-similar-card__badge">${escapeHtml(s.modality || '')}</span>
            <span class="vd-similar-card__badge">${escapeHtml(s.level || '')}</span>
          </div>
          <span class="vd-similar-card__salary">${escapeHtml(s.salaryRange || '')}</span>
        </article>`).join('');
    } else {
      sim.innerHTML = `<p class="vd-loading">Nenhuma vaga similar encontrada.</p>`;
    }

    // Estados de aplicar / salvar
    const applyBtn = $('#btn-apply');
    const jobStatus = data.status || 'active';
    if (data.appliedByMe) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = 'Candidatura enviada';
    } else if (jobStatus !== 'active') {
      // vaga pausada/encerrada não recebe candidaturas — reflete antes do clique
      applyBtn.disabled = true;
      applyBtn.innerHTML = jobStatus === 'paused' ? 'Vaga pausada' : 'Vaga encerrada';
    }
    const saveBtn = $('#btn-save');
    if (data.savedByMe) {
      saveBtn.classList.add('is-saved');
      $('#btn-save-label').textContent = 'Vaga salva';
    }

    $('#vd-loading').hidden = true;
    $('#vd-content').hidden = false;
  }

  /* ===== AÇÕES ===== */
  async function apply() {
    const btn = $('#btn-apply');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'Enviando...';
    try {
      const res = await api('/api/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { btn.textContent = 'Candidatura enviada'; toast('Você já se candidatou a esta vaga.', 'info'); return; }
        btn.disabled = false; btn.innerHTML = original;
        toast(data.error || 'Não foi possível candidatar-se.', 'error'); return;
      }
      btn.textContent = 'Candidatura enviada';
      toast('Candidatura enviada com sucesso!', 'success');
    } catch (err) {
      if (err.message !== 'Token expirado') { btn.disabled = false; btn.innerHTML = original; toast('Erro ao candidatar-se.', 'error'); }
    }
  }

  async function toggleSave() {
    const btn = $('#btn-save');
    try {
      const res = await api('/api/saved-jobs', { method: 'POST', body: JSON.stringify({ jobId }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Erro ao salvar.', 'error'); return; }
      btn.classList.toggle('is-saved', !!data.saved);
      $('#btn-save-label').textContent = data.saved ? 'Vaga salva' : 'Salvar Vaga';
      toast(data.saved ? 'Vaga salva!' : 'Removida dos salvos.', 'success');
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro ao salvar a vaga.', 'error');
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#btn-apply').addEventListener('click', apply);
    $('#btn-save').addEventListener('click', toggleSave);
    $('#vd-similar').addEventListener('click', (ev) => {
      const card = ev.target.closest('[data-job-id]');
      if (card) window.location.href = `/pages/vaga-detalhes.html?id=${encodeURIComponent(card.getAttribute('data-job-id'))}`;
    });
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== INIT ===== */
  async function init() {
    setupEvents();
    if (!jobId) {
      $('#vd-loading').textContent = 'Vaga não especificada. Volte para a listagem.';
      return;
    }
    try {
      const res = await api(`/api/jobs/${jobId}`);
      if (!res.ok) {
        $('#vd-loading').textContent = 'Vaga não encontrada.';
        return;
      }
      render(await res.json());
    } catch (err) {
      if (err.message !== 'Token expirado') $('#vd-loading').textContent = 'Não foi possível carregar a vaga.';
    }
  }

  init();

})();
