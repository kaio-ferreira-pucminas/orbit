// job-prefs.js — Orbit · Modal de "Filtros Avançados" de vagas (componente compartilhado)
// Usado no dashboard do dev e na tela de oportunidades. As preferências são
// salvas no servidor (PUT /api/preferences/me) e influenciam as recomendações
// nas duas telas. Autossuficiente: injeta o próprio CSS + markup.
// API: window.OrbitJobPrefs.open(onSaved)  /  window.OrbitJobPrefs.load()
(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';
  const MODALITIES = ['Remoto', 'Híbrido', 'Presencial'];
  const LEVELS     = ['Júnior', 'Pleno', 'Sênior'];
  const CONTRACTS  = ['CLT', 'Freelance'];

  function token() { return localStorage.getItem('orbit_token'); }
  function escapeHtml(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => map[c]);
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, (options && options.headers) || {}),
    }));
    if (res.status === 401) {
      localStorage.removeItem('orbit_token'); localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  function maskMoney(raw) {
    const d = String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
    return d ? 'R$ ' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  }
  function moneyValue(str) { return parseInt(String(str).replace(/\D/g, '') || '0', 10); }

  /* ===== ESTADO ===== */
  let prefs = { modalities: [], levels: [], contractTypes: [], skills: [], minSalary: 0 };
  let skills = [];
  let onSavedCb = null;
  let built = false;

  /* ===== CSS ===== */
  function ensureStyles() {
    if (document.getElementById('ojp-style')) return;
    const css =
      '.ojp-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;}' +
      ".ojp-modal[hidden]{display:none !important;}" +
      '.ojp-modal__overlay{position:absolute;inset:0;background:rgba(19,27,46,.45);backdrop-filter:blur(2px);}' +
      ".ojp-modal__dialog{position:relative;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;background:#fff;border-radius:14px;box-shadow:0 25px 50px -12px rgba(19,27,46,.35);padding:24px;margin:16px;font-family:'Inter',-apple-system,sans-serif;}" +
      '.ojp-modal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px;}' +
      ".ojp-modal__title{font-family:'Manrope','Inter',sans-serif;font-weight:800;font-size:20px;color:#131b2e;}" +
      '.ojp-modal__sub{font-size:13px;color:#565e74;margin:2px 0 18px;}' +
      '.ojp-close{width:32px;height:32px;border-radius:8px;border:none;background:#f2f3ff;color:#565e74;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,color .15s;}' +
      '.ojp-close:hover{background:#e2e7ff;color:#131b2e;}' +
      '.ojp-group{margin-bottom:18px;}' +
      '.ojp-group__label{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#565e74;margin-bottom:10px;}' +
      '.ojp-chips{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.ojp-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1.5px solid #e2e7ff;background:#fff;color:#565e74;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;user-select:none;}' +
      '.ojp-chip:hover{border-color:#4648d4;color:#4648d4;}' +
      '.ojp-chip--on{background:#4648d4;border-color:#4648d4;color:#fff;}' +
      '.ojp-input{width:100%;padding:11px 14px;background:#f2f3ff;border:1px solid transparent;border-radius:10px;font:inherit;font-size:14px;color:#131b2e;}' +
      '.ojp-input:focus{outline:none;border-color:#4648d4;background:#fff;box-shadow:0 0 0 3px rgba(70,72,212,.1);}' +
      '.ojp-skillchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}' +
      '.ojp-skillchip{display:inline-flex;align-items:center;gap:6px;background:#f2f3ff;color:#4648d4;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;}' +
      '.ojp-skillchip button{border:none;background:none;color:#4648d4;cursor:pointer;font-size:14px;line-height:1;padding:0;}' +
      '.ojp-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;}' +
      '.ojp-clear{border:none;background:none;color:#565e74;font-size:13px;font-weight:700;cursor:pointer;}' +
      '.ojp-clear:hover{color:#c0392b;}' +
      '.ojp-actions{display:flex;gap:10px;}' +
      '.ojp-btn-ghost{padding:10px 18px;border-radius:10px;border:none;background:#f2f3ff;color:#4648d4;font-weight:700;font-size:14px;cursor:pointer;}' +
      '.ojp-btn-primary{padding:10px 20px;border-radius:10px;border:none;background:#4648d4;color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 10px 15px -3px rgba(70,72,212,.2);}' +
      '.ojp-btn-primary:hover{background:#3537b8;}' +
      '.ojp-btn-primary:disabled{opacity:.6;cursor:not-allowed;}';
    const st = document.createElement('style');
    st.id = 'ojp-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ===== MARKUP ===== */
  function chipRow(items, group) {
    return items.map(v => `<button type="button" class="ojp-chip" data-group="${group}" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
  }
  function build() {
    if (built) return;
    ensureStyles();
    const host = document.createElement('div');
    host.className = 'ojp-modal';
    host.id = 'ojp-modal';
    host.hidden = true;
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.innerHTML =
      '<div class="ojp-modal__overlay" data-ojp-close></div>' +
      '<div class="ojp-modal__dialog">' +
        '<div class="ojp-modal__head">' +
          '<div><h2 class="ojp-modal__title">Filtros Avançados</h2></div>' +
          '<button type="button" class="ojp-close" data-ojp-close aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '<p class="ojp-modal__sub">Suas preferências valem no Dashboard e em Oportunidades.</p>' +
        `<div class="ojp-group"><span class="ojp-group__label">Modalidade</span><div class="ojp-chips">${chipRow(MODALITIES, 'modalities')}</div></div>` +
        `<div class="ojp-group"><span class="ojp-group__label">Nível</span><div class="ojp-chips">${chipRow(LEVELS, 'levels')}</div></div>` +
        `<div class="ojp-group"><span class="ojp-group__label">Contrato</span><div class="ojp-chips">${chipRow(CONTRACTS, 'contractTypes')}</div></div>` +
        '<div class="ojp-group"><span class="ojp-group__label">Salário mínimo</span><input type="text" class="ojp-input" id="ojp-salary" inputmode="numeric" maxlength="14" placeholder="Ex: R$ 4.000" /></div>' +
        '<div class="ojp-group"><span class="ojp-group__label">Habilidades desejadas</span><input type="text" class="ojp-input" id="ojp-skill" maxlength="30" placeholder="Digite e Enter (ex: React)" /><div class="ojp-skillchips" id="ojp-skillchips"></div></div>' +
        '<div class="ojp-foot"><button type="button" class="ojp-clear" id="ojp-clear">Limpar filtros</button><div class="ojp-actions"><button type="button" class="ojp-btn-ghost" data-ojp-close>Cancelar</button><button type="button" class="ojp-btn-primary" id="ojp-save">Salvar filtros</button></div></div>' +
      '</div>';
    document.body.appendChild(host);
    wire(host);
    built = true;
  }

  function renderSkillChips() {
    const box = document.getElementById('ojp-skillchips');
    box.innerHTML = skills.map((s, i) => `<span class="ojp-skillchip">${escapeHtml(s)}<button type="button" data-rm="${i}" aria-label="Remover">×</button></span>`).join('');
  }
  function syncChips(host) {
    host.querySelectorAll('.ojp-chip').forEach(ch => {
      const g = ch.getAttribute('data-group');
      const v = ch.getAttribute('data-val');
      ch.classList.toggle('ojp-chip--on', (prefs[g] || []).includes(v));
    });
    document.getElementById('ojp-salary').value = prefs.minSalary ? maskMoney(prefs.minSalary) : '';
    renderSkillChips();
  }

  function wire(host) {
    host.addEventListener('click', (ev) => { if (ev.target.closest('[data-ojp-close]')) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !host.hidden) close(); });

    host.querySelectorAll('.ojp-chip').forEach(ch => ch.addEventListener('click', () => {
      const g = ch.getAttribute('data-group');
      const v = ch.getAttribute('data-val');
      const arr = prefs[g] || (prefs[g] = []);
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      ch.classList.toggle('ojp-chip--on');
    }));

    const salary = document.getElementById('ojp-salary');
    salary.addEventListener('input', () => { salary.value = maskMoney(salary.value); const e = salary.value.length; salary.setSelectionRange(e, e); });

    const skillInput = document.getElementById('ojp-skill');
    skillInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ',') {
        ev.preventDefault();
        const v = skillInput.value.trim();
        if (v && skills.length < 20 && !skills.some(s => s.toLowerCase() === v.toLowerCase())) { skills.push(v); renderSkillChips(); }
        skillInput.value = '';
      }
    });
    document.getElementById('ojp-skillchips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-rm]'); if (!b) return;
      skills.splice(Number(b.getAttribute('data-rm')), 1); renderSkillChips();
    });

    document.getElementById('ojp-clear').addEventListener('click', () => {
      prefs = { modalities: [], levels: [], contractTypes: [], skills: [], minSalary: 0 };
      skills = [];
      syncChips(host);
    });
    document.getElementById('ojp-save').addEventListener('click', save);
  }

  async function load() {
    try {
      const res = await api('/api/preferences/me');
      const data = await res.json();
      return data.preferences || { modalities: [], levels: [], contractTypes: [], skills: [], minSalary: 0 };
    } catch (e) { return { modalities: [], levels: [], contractTypes: [], skills: [], minSalary: 0 }; }
  }

  async function save() {
    const btn = document.getElementById('ojp-save');
    btn.disabled = true;
    const payload = {
      modalities: prefs.modalities || [],
      levels: prefs.levels || [],
      contractTypes: prefs.contractTypes || [],
      skills: skills.slice(),
      minSalary: moneyValue(document.getElementById('ojp-salary').value),
    };
    try {
      const res = await api('/api/preferences/me', { method: 'PUT', body: JSON.stringify({ preferences: payload }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível salvar os filtros.', 'error'); btn.disabled = false; return; }
      toast('Filtros salvos!', 'success');
      close();
      if (typeof onSavedCb === 'function') onSavedCb(data.preferences);
    } catch (e) {
      if (e.message !== 'Token expirado') { toast('Erro ao salvar os filtros.', 'error'); btn.disabled = false; }
    }
  }

  function close() { const h = document.getElementById('ojp-modal'); if (h) h.hidden = true; }

  async function open(onSaved) {
    build();
    onSavedCb = onSaved || null;
    document.getElementById('ojp-save').disabled = false;
    prefs = await load();
    skills = (prefs.skills || []).slice();
    syncChips(document.getElementById('ojp-modal'));
    document.getElementById('ojp-modal').hidden = false;
  }

  window.OrbitJobPrefs = { open, load };
})();
