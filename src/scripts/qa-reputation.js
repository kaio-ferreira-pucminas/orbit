// qa-reputation.js — Orbit · Card de "Reputação em respostas" (Q&A)
// Componente transversal e autossuficiente (injeta o próprio CSS).
// Consome o objeto `qa` retornado por GET /api/users/:id/profile.
// Uso: window.OrbitQaRep.render(containerEl, qa)
// JS puro, sem framework.

(function () {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('qarep-style')) return;
    const css =
      '.qarep{background:var(--card-bg,#fff);border:1px solid var(--border-light,#e2e7ff);border-radius:var(--radius,12px);padding:20px;margin-bottom:20px;}' +
      '.qarep__head{margin-bottom:14px;}' +
      ".qarep__title{display:flex;align-items:center;gap:8px;font-family:'Manrope','Inter',sans-serif;font-weight:800;font-size:15px;color:var(--text-dark,#131b2e);margin:0;}" +
      '.qarep__title svg{color:#f59e0b;}' +
      '.qarep__sub{display:block;font-size:12px;color:var(--text-muted,#565e74);margin-top:3px;}' +
      '.qarep__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}' +
      '.qarep__stat{background:var(--light-purple,#f3f1ff);border-radius:10px;padding:14px 10px;text-align:center;}' +
      '.qarep__stat--main{background:rgba(70,72,212,0.1);}' +
      ".qarep__num{display:block;font-family:'Manrope','Inter',sans-serif;font-weight:800;font-size:20px;color:var(--primary,#4648d4);}" +
      '.qarep__lbl{display:block;font-size:11px;font-weight:600;color:var(--text-muted,#565e74);margin-top:4px;}' +
      '@media(max-width:560px){.qarep__grid{grid-template-columns:repeat(2,1fr);}}';
    const st = document.createElement('style');
    st.id = 'qarep-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.9 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>';

  function render(container, qa) {
    if (!container) return;
    qa = qa || {};
    ensureStyles();
    const nota = qa.ratingAvg > 0 ? Number(qa.ratingAvg).toFixed(1) : '—';
    const cnt  = qa.ratingsCount ? ' (' + qa.ratingsCount + ')' : '';
    container.innerHTML =
      '<div class="qarep">' +
        '<div class="qarep__head"><h3 class="qarep__title">' + STAR + 'Reputação em respostas</h3>' +
        '<span class="qarep__sub">Avaliações recebidas nas suas respostas a dúvidas da comunidade</span></div>' +
        '<div class="qarep__grid">' +
          '<div class="qarep__stat qarep__stat--main"><span class="qarep__num">' + nota + '</span><span class="qarep__lbl">Nota média' + cnt + '</span></div>' +
          '<div class="qarep__stat"><span class="qarep__num">' + (qa.answersCount || 0) + '</span><span class="qarep__lbl">Respostas dadas</span></div>' +
          '<div class="qarep__stat"><span class="qarep__num">🏅 ' + (qa.bestAnswersCount || 0) + '</span><span class="qarep__lbl">Melhores respostas</span></div>' +
          '<div class="qarep__stat"><span class="qarep__num">👍 ' + (qa.helpfulReceived || 0) + '</span><span class="qarep__lbl">Úteis recebidos</span></div>' +
        '</div>' +
      '</div>';
  }

  window.OrbitQaRep = { render };
})();
