// orbit-select.js — Orbit · Padroniza o dropdown (lista aberta) de TODAS as combo boxes.
// Abordagem não-invasiva: mantém o <select> nativo (valor do form + estilo fechado da
// página) e apenas SUBSTITUI a lista aberta por um painel padronizado, posicionado sobre
// o select. Preserva o evento `change` (filtros continuam funcionando) e monta as opções
// na hora da abertura (cobre selects preenchidos dinamicamente). JS puro, autossuficiente.

(function () {
  'use strict';

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }

  /* ===== CSS (injetado uma vez) ===== */
  function ensureStyles() {
    if (document.getElementById('orbit-select-style')) return;
    const css = `
      .osel-panel{position:absolute;z-index:9998;background:#fff;border:1px solid #e2e7ff;border-radius:12px;box-shadow:0 12px 32px rgba(19,27,46,.18);padding:6px;max-height:300px;overflow-y:auto;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;animation:osel-in .12s ease;}
      @keyframes osel-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      .osel-panel__option{padding:10px 12px;border-radius:8px;font-size:14px;color:#131b2e;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .1s,color .1s;}
      .osel-panel__option:hover{background:#f2f3ff;color:#4648d4;}
      .osel-panel__option--selected{background:#4648d4;color:#fff;font-weight:600;}
      .osel-panel__option--selected:hover{background:#4648d4;color:#fff;}
      .osel-panel__option[data-disabled]{color:#b8b8c4;cursor:default;}
      .osel-panel__option[data-disabled]:hover{background:transparent;color:#b8b8c4;}
    `;
    const style = document.createElement('style');
    style.id = 'orbit-select-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== Painel compartilhado (um aberto por vez) ===== */
  let activeSelect = null;
  let panelEl = null;

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.className = 'osel-panel';
    panelEl.setAttribute('role', 'listbox');
    panelEl.hidden = true;
    document.body.appendChild(panelEl);
    panelEl.addEventListener('mousedown', (e) => e.preventDefault()); // não tira o foco do select
    panelEl.addEventListener('click', (e) => {
      const opt = e.target.closest('.osel-panel__option');
      if (!opt || opt.hasAttribute('data-disabled') || !activeSelect) return;
      activeSelect.selectedIndex = Number(opt.getAttribute('data-idx'));
      activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      closePanel();
    });
    return panelEl;
  }

  function buildOptions() {
    if (!activeSelect) return;
    panelEl.innerHTML = Array.from(activeSelect.options).map((o, i) =>
      `<div class="osel-panel__option${o.selected ? ' osel-panel__option--selected' : ''}" data-idx="${i}"${o.disabled ? ' data-disabled="1"' : ''} role="option" aria-selected="${o.selected}">${escapeHtml(o.textContent)}</div>`
    ).join('');
  }

  function position() {
    if (!activeSelect || !panelEl || panelEl.hidden) return;
    const r = activeSelect.getBoundingClientRect();
    panelEl.style.left  = (r.left + window.scrollX) + 'px';
    panelEl.style.top   = (r.bottom + window.scrollY + 6) + 'px';
    panelEl.style.width = r.width + 'px';
  }

  function openPanel(select) {
    ensurePanel();
    if (activeSelect === select && !panelEl.hidden) { closePanel(); return; }
    activeSelect = select;
    buildOptions();
    panelEl.hidden = false;
    position();
  }
  function closePanel() {
    if (panelEl) panelEl.hidden = true;
    activeSelect = null;
  }

  /* ===== Listeners globais ===== */
  document.addEventListener('click', (e) => {
    if (activeSelect && e.target !== activeSelect && panelEl && !panelEl.contains(e.target)) closePanel();
  });
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);

  /* ===== Enhance de cada <select> ===== */
  function enhance(select) {
    if (select.dataset.oselDone || select.hasAttribute('data-no-orbit-select') || select.multiple) return;
    select.dataset.oselDone = '1';

    // Suprime a lista nativa no clique e abre o painel padronizado
    select.addEventListener('mousedown', (e) => { e.preventDefault(); select.focus(); openPanel(select); });

    // Teclado: abre/navega/seleciona pelo painel
    select.addEventListener('keydown', (e) => {
      const open = panelEl && !panelEl.hidden && activeSelect === select;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { openPanel(select); return; }
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let i = select.selectedIndex + dir;
        while (select.options[i] && select.options[i].disabled) i += dir;
        if (select.options[i]) { select.selectedIndex = i; select.dispatchEvent(new Event('change', { bubbles: true })); buildOptions(); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open ? closePanel() : openPanel(select);
      } else if (e.key === 'Escape') {
        closePanel();
      }
    });

    // Se a página mudar o valor por código, fecha o painel (mantém consistência)
    select.addEventListener('change', () => { if (activeSelect === select && panelEl && !panelEl.hidden) buildOptions(); });
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('select').forEach(enhance);
  }

  /* ===== INIT ===== */
  function init() { ensureStyles(); enhanceAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // exposto p/ re-escanear selects criados dinamicamente
  window.OrbitSelect = { refresh: enhanceAll };

})();
