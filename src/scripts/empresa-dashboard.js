// empresa-dashboard.js — Orbit · Dashboard da Empresa (#7 — Kaio)
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
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `Há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Há ${h}h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'Ontem' : `Há ${d} dias`;
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  /* ===== RENDER: header / identidade ===== */
  function renderIdentity() {
    const name = currentUser.name || 'Empresa';
    $('#sidebar-company-name').textContent = name;
    $('#welcome-company').textContent = name;
    $('#emp-initials').textContent = initials(name);
    if (currentUser.avatarUrl) {
      $('#emp-avatar').innerHTML = `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="${escapeHtml(name)}" />`;
    }
  }

  /* ===== MÉTRICAS + ATIVIDADES ===== */
  async function loadDashboard() {
    try {
      // Só as vagas DA EMPRESA logada (antes usava /api/jobs e agregava a
      // plataforma inteira — métricas de outras empresas vazavam para cá)
      const resJobs = await api('/api/jobs/mine');
      const mine = await resJobs.json();
      const jobs = mine.jobs || [];
      const activeJobs = jobs.filter(j => j.status === 'active');

      // Para cada vaga própria, busca candidatos (em paralelo)
      const details = await Promise.all(
        jobs.map(j => api(`/api/jobs/${j.id}/applications`).then(r => r.json()).catch(() => null))
      );
      const valid = details.filter(Boolean).filter(d => d.job);

      const totalCandidates = valid.reduce((acc, d) => acc + d.funnel.total, 0);
      const totalInterviews = valid.reduce((acc, d) => acc + d.funnel.entrevista, 0);

      // Stats
      $('#stat-jobs').textContent = activeJobs.length;
      $('#stat-candidates').textContent = totalCandidates.toLocaleString('pt-BR');
      const conversion = totalCandidates ? Math.round((totalInterviews / totalCandidates) * 100) : 0;
      $('#stat-conversion').textContent = conversion + '%';

      // Vaga em destaque: a com mais candidatos
      const featured = valid.slice().sort((a, b) => b.funnel.total - a.funnel.total)[0];
      if (featured) {
        $('#featured-title').textContent = featured.job.title;
        $('#featured-meta').textContent = `${featured.job.companyName} • ${featured.job.modality}`;
        $('#featured-candidates').textContent = featured.funnel.total;
        $('#featured-interviews').textContent = featured.funnel.entrevista;
      }

      // Atividades recentes: candidaturas mais novas, agregadas de todas as vagas
      const activities = [];
      valid.forEach(d => {
        d.applicants.forEach(a => {
          activities.push({
            name: a.candidate ? a.candidate.name : 'Candidato',
            avatarUrl: a.candidate ? a.candidate.avatarUrl : null,
            jobTitle: d.job.title,
            appliedAt: a.appliedAt,
            status: a.status,
          });
        });
      });
      activities.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
      renderActivities(activities.slice(0, 4));

    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#activity-list').innerHTML = `<li class="emp-loading">Não foi possível carregar o dashboard.</li>`;
      }
    }
  }

  function renderActivities(list) {
    const ul = $('#activity-list');
    if (!list.length) {
      ul.innerHTML = `<li class="emp-loading">Nenhuma atividade recente.</li>`;
      return;
    }
    ul.innerHTML = list.map(a => {
      const avatar = a.avatarUrl
        ? `<img src="${escapeHtml(a.avatarUrl)}" alt="${escapeHtml(a.name)}" />`
        : `<span>${initials(a.name)}</span>`;
      return `
        <li class="emp-activity">
          <div class="emp-activity__avatar">${avatar}</div>
          <div class="emp-activity__body">
            <p class="emp-activity__text"><strong>${escapeHtml(a.name)}</strong> se candidatou para <span class="accent">${escapeHtml(a.jobTitle)}</span></p>
            <p class="emp-activity__meta">${escapeHtml(timeAgo(a.appliedAt))}</p>
          </div>
        </li>`;
    }).join('');
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
    $('#btn-novo-job').addEventListener('click', () => {
      window.location.href = '/pages/empresa-nova-vaga.html';
    });
    // O sino de notificações é controlado pelo notifications.js (markup #orbit-notif).
  }

  /* ===== INIT ===== */
  function init() {
    renderIdentity();
    setupEvents();
    loadDashboard();
  }

  init();

})();
