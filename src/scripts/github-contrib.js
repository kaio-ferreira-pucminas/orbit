// github-contrib.js — Orbit · Mini-gráfico de contribuições do GitHub (quadradinhos verdes)
// Componente transversal e autossuficiente (injeta o próprio CSS). Consome o endpoint
// /api/github/contributions?username=... (GraphQL c/ token; senão HTML público).
// Uso: window.OrbitContrib.mount(containerEl, githubUsername)
// JS puro, sem framework.

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  function ensureStyles() {
    if (document.getElementById('gc-style')) return;
    const css =
      '.gc{background:var(--card-bg,#fff);border:1px solid var(--border-light,#eceaf5);border-radius:var(--radius,12px);padding:20px;}' +
      '.gc__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;}' +
      '.gc__title{display:flex;align-items:center;gap:8px;font-family:"Manrope","Inter",sans-serif;font-weight:800;font-size:15px;color:var(--text-dark,#131b2e);}' +
      '.gc__title svg{color:var(--text-muted,#565e74);}' +
      '.gc__total{font-size:12px;color:var(--text-muted,#565e74);font-weight:600;}' +
      '.gc__scroll{overflow-x:auto;padding-bottom:4px;}' +
      '.gc__grid{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,11px);grid-auto-columns:11px;gap:3px;width:max-content;}' +
      '.gc__cell{width:11px;height:11px;border-radius:2px;background:#ebedf0;}' +
      '.gc__cell--pad{background:transparent;}' +
      '.gc__cell[data-level="1"]{background:#9be9a8;}' +
      '.gc__cell[data-level="2"]{background:#40c463;}' +
      '.gc__cell[data-level="3"]{background:#30a14e;}' +
      '.gc__cell[data-level="4"]{background:#216e39;}' +
      '.gc__legend{display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:10px;font-size:11px;color:var(--text-muted,#565e74);}' +
      '.gc__legend .gc__cell{width:10px;height:10px;}' +
      '.gc__empty{font-size:13px;color:var(--text-muted,#565e74);}';
    const st = document.createElement('style');
    st.id = 'gc-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }

  const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d.getTime())) return iso;
    return d.getUTCDate() + ' de ' + MES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
  }
  function cellsHtml(days) {
    if (!days || !days.length) return '';
    const first = new Date(days[0].date + 'T00:00:00Z');
    const pad = isNaN(first.getTime()) ? 0 : first.getUTCDay(); // 0 = domingo
    let html = '';
    for (let i = 0; i < pad; i++) html += '<span class="gc__cell gc__cell--pad"></span>';
    days.forEach(d => {
      const n = d.count;
      const qtd = (n == null) ? 'Atividade'
        : (n === 0 ? 'Nenhuma contribuição' : (n + (n === 1 ? ' contribuição' : ' contribuições')));
      const tip = qtd + ' no dia ' + fmtDate(d.date);
      html += `<span class="gc__cell" data-level="${d.level || 0}" title="${esc(tip)}"></span>`;
    });
    return html;
  }

  const GH_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.8c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>';

  async function mount(container, username) {
    if (!container || !username) return;
    ensureStyles();
    const token = localStorage.getItem('orbit_token');
    container.innerHTML =
      '<div class="gc"><div class="gc__head"><span class="gc__title">' + GH_SVG + 'Contribuições no GitHub</span>' +
      '<span class="gc__total"></span></div><div class="gc__loading gc__empty">Carregando…</div></div>';
    try {
      const r = await fetch(`${API_URL}/api/github/contributions?username=${encodeURIComponent(username)}`, {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      });
      if (!r.ok) throw new Error('contrib ' + r.status);
      const data = await r.json();
      const days = (data && data.days) || [];
      const card = container.querySelector('.gc');
      if (!days.length) {
        card.innerHTML = '<div class="gc__head"><span class="gc__title">' + GH_SVG + 'Contribuições no GitHub</span></div><span class="gc__empty">Não foi possível carregar as contribuições agora.</span>';
        return;
      }
      card.innerHTML =
        '<div class="gc__head"><span class="gc__title">' + GH_SVG + 'Contribuições no GitHub</span>' +
        '<span class="gc__total">' + (data.totalLastYear != null ? esc(data.totalLastYear) + ' no último ano' : '') + '</span></div>' +
        '<div class="gc__scroll"><div class="gc__grid">' + cellsHtml(days) + '</div></div>' +
        '<div class="gc__legend">Menos <span class="gc__cell" data-level="0"></span><span class="gc__cell" data-level="1"></span><span class="gc__cell" data-level="2"></span><span class="gc__cell" data-level="3"></span><span class="gc__cell" data-level="4"></span> Mais</div>';
    } catch (e) {
      // falha silenciosa: remove o card para não poluir o perfil
      container.innerHTML = '';
    }
  }

  window.OrbitContrib = { mount };
})();
