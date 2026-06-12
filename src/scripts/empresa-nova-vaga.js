// empresa-nova-vaga.js — Orbit · Publicar/Editar Oportunidade (empresa)
// JS puro. Backend: POST /api/jobs, PATCH /api/jobs/:id, GET /api/jobs/:id, GET /api/talents.
// Sem ?id na URL → criação; com ?id=<jobId> → edição (rascunho ou vaga publicada).

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
  // Guard de papel: a tela é exclusiva de empresas (dev cai no próprio dashboard)
  if (currentUser.type !== 'company') {
    window.location.href = '/pages/dashboard.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const jobId  = params.get('id');
  const isEdit = !!jobId;

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
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

  /* ===== CONSTANTES / ESTADO ===== */
  const MAX_SKILLS  = 15;
  const SUGGESTIONS = ['Next.js', 'Redux', 'Jest', 'GraphQL', 'TypeScript', 'Docker', 'Node.js', 'Tailwind CSS', 'React', 'Python', 'Git / GitHub', 'Figma'];

  let skills        = [];     // habilidades adicionadas (chips)
  let saving        = false;  // guard anti duplo-clique nos botões de salvar
  let previewing    = false;  // textarea ↔ preview da descrição
  let editStatus    = null;   // status da vaga em edição ('draft', 'active', 'paused'...)
  let savedLocation = '';     // localização digitada antes de travar em "Remoto"

  function renderIdentity() {
    $('#sidebar-company-name').textContent = currentUser.name || 'Empresa';
  }

  /* =========================================================
     MARKDOWN PARSER — cópia do feed.js, ESTENDIDA com listas
     Suporta: code block ```...```, inline `code`, **bold**, *italic*,
     [text](url) e linhas "- item" consecutivas → <ul><li>…</li></ul>
  ========================================================= */

  // Converte um trecho JÁ ESCAPADO e SEM code blocks em parágrafos + listas.
  // Linhas consecutivas iniciadas em "- " viram <ul>; o resto segue a regra do
  // feed (blocos separados por linha em branco → <p>, \n simples → <br>).
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

    // 1. Escapa todo HTML primeiro (segurança)
    let html = escapeHtml(text);

    // 2. Code block (```...```) — TEM que vir antes de inline code
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
    );

    // 3. Inline code (`...`)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 4. Bold (**...**)
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    // 5. Italic (*...*) — depois do bold
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    // 6. Link [text](url) — só http(s)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // 7. Listas + parágrafos FORA dos <pre> (code blocks ficam intactos)
    const parts  = html.split(/<pre>[\s\S]*?<\/pre>/g);
    const blocks = html.match(/<pre>[\s\S]*?<\/pre>/g) || [];
    let result = '';
    parts.forEach((part, i) => {
      result += renderBlocks(part);
      if (blocks[i]) result += blocks[i];
    });

    return result;
  }

  /* =========================================================
     FORMATAÇÃO — envolve a seleção do textarea com marcadores markdown
     (mesmo padrão do composer do feed; 'list' prefixa as linhas com "- ")
  ========================================================= */
  function formatTextarea(ta, fmt) {
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.substring(start, end);
    let wrapped, cursorOffset;
    switch (fmt) {
      case 'bold':   wrapped = `**${sel || 'texto em negrito'}**`; cursorOffset = sel ? wrapped.length : 2 + 'texto em negrito'.length; break;
      case 'italic': wrapped = `*${sel || 'texto em itálico'}*`;   cursorOffset = sel ? wrapped.length : 1 + 'texto em itálico'.length; break;
      case 'link':   wrapped = `[${sel || 'texto'}](https://)`;     cursorOffset = sel ? wrapped.length : 1 + 'texto'.length; break;
      case 'list':
        // insere "- " no início de cada linha selecionada (ou um item de exemplo)
        wrapped = sel
          ? sel.split('\n').map(l => (l.trim() && !/^\s*-\s/.test(l) ? `- ${l}` : l)).join('\n')
          : '- item';
        cursorOffset = wrapped.length;
        break;
      default: return;
    }
    ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
    ta.focus();
    const newPos = start + cursorOffset;
    ta.setSelectionRange(newPos, newPos);
  }

  /* ===== PREVIEW DA DESCRIÇÃO (textarea ↔ render) ===== */
  function setToolbarEnabled(on) {
    document.querySelectorAll('.nv-toolbar__btn').forEach(b => { b.disabled = !on; });
  }
  function showEditor() {
    if (!previewing) return;
    previewing = false;
    $('#nv-preview').hidden = true;
    $('#nv-desc').hidden = false;
    $('#nv-preview-toggle').textContent = 'Pré-visualizar';
    setToolbarEnabled(true);
    $('#nv-desc').focus();
  }
  function showPreview() {
    if (previewing) return;
    previewing = true;
    const md = $('#nv-desc').value;
    $('#nv-preview').innerHTML = md.trim()
      ? parseMarkdown(md)
      : '<p class="nv-preview__empty">Nada para pré-visualizar ainda. Escreva a descrição da vaga.</p>';
    $('#nv-desc').hidden = true;
    $('#nv-preview').hidden = false;
    $('#nv-preview-toggle').textContent = 'Editar';
    setToolbarEnabled(false);
  }

  /* ===== MODALIDADE (radio-cards) + trava da localização ===== */
  function syncModality() {
    const checked = document.querySelector('input[name="nv-modality"]:checked');
    document.querySelectorAll('.nv-card').forEach(card => {
      const input = card.querySelector('.nv-card__input');
      card.classList.toggle('nv-card--checked', !!(input && input.checked));
    });
    const loc  = $('#nv-location');
    const hint = $('#nv-location-hint');
    if (checked && checked.value === 'Remoto') {
      if (!loc.disabled) savedLocation = loc.value; // guarda só na transição
      loc.value = 'Remoto';
      loc.disabled = true;
      hint.hidden = false;
    } else if (loc.disabled) {
      loc.disabled = false;
      loc.value = savedLocation === 'Remoto' ? '' : savedLocation;
      hint.hidden = true;
    }
  }

  /* ===== HABILIDADES (chips + sugestões) ===== */
  function hasSkill(name) {
    const low = name.toLowerCase();
    return skills.some(s => s.toLowerCase() === low);
  }

  function addSkill(raw) {
    const name = String(raw == null ? '' : raw).trim().slice(0, 30);
    if (!name) return;
    if (hasSkill(name)) { toast('Essa habilidade já foi adicionada.', 'info'); return; }
    if (skills.length >= MAX_SKILLS) { toast(`Máximo de ${MAX_SKILLS} habilidades por vaga.`, 'info'); return; }
    skills.push(name);
    renderChips();
    renderSuggestions();
  }

  function renderChips() {
    const box = $('#nv-chips');
    if (!skills.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = skills.map((s, i) => `
      <span class="nv-chip">${escapeHtml(s)}
        <button type="button" class="nv-chip__x" data-remove="${i}" aria-label="Remover ${escapeHtml(s)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>`).join('');
  }

  function renderSuggestions() {
    const box = $('#nv-suggest-list');
    const remaining = SUGGESTIONS.filter(s => !hasSkill(s));
    if (!remaining.length) {
      box.innerHTML = '<span class="nv-suggest__empty">Todas as sugestões já estão na vaga.</span>';
      return;
    }
    box.innerHTML = remaining.map(s =>
      `<button type="button" class="nv-suggest__chip" data-skill="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join('');
  }

  /* ===== CONTADOR DE VISIBILIDADE (rodapé) ===== */
  async function loadVisibility() {
    const box = $('#nv-visibility');
    const fallback = 'Sua vaga ficará visível para <strong>todos os desenvolvedores</strong> na Orbit';
    try {
      const res = await api('/api/talents');
      if (!res.ok) { box.innerHTML = fallback; return; }
      const list = await res.json();
      const n = Array.isArray(list) ? list.length : 0;
      box.innerHTML = n > 0
        ? `Sua vaga ficará visível para <strong>${n} desenvolvedor${n === 1 ? '' : 'es'}</strong> na Orbit`
        : fallback;
    } catch (err) {
      if (err.message !== 'Token expirado') box.innerHTML = fallback;
    }
  }

  /* ===== PAYLOAD + SALVAR ===== */
  function collectPayload() {
    const checked  = document.querySelector('input[name="nv-modality"]:checked');
    const modality = checked ? checked.value : 'Remoto';
    return {
      title:        $('#nv-title').value.trim(),
      description:  $('#nv-desc').value.trim(),
      modality,
      skills:       skills.slice(),
      level:        $('#nv-level').value,
      contractType: $('#nv-contract').value,
      location:     modality === 'Remoto' ? 'Remoto' : $('#nv-location').value.trim(),
      salaryRange:  buildSalaryRange(),
      responsibilities: collectResponsibilities(),
      benefits:         collectBenefits(),
    };
  }

  /* ===== FAIXA SALARIAL (máscara monetária + "A combinar") ===== */
  // Máscara monetária pt-BR sem centavos (salário): "50000" → "R$ 50.000".
  function maskMoney(raw) {
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return '';
    return 'R$ ' + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  // Valor numérico de um campo monetário (0 se vazio)
  function moneyValue(el) {
    return parseInt(String(el.value).replace(/\D/g, '') || '0', 10);
  }
  // Liga a máscara a um input enquanto o usuário digita (caret ao fim)
  function wireMoneyInput(el) {
    el.addEventListener('input', () => {
      el.value = maskMoney(el.value);
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }
  // "A combinar" desabilita os dois campos de valor
  function syncSalaryTbd() {
    const tbd = $('#nv-salary-tbd').checked;
    $('#nv-salary-min').disabled = tbd;
    $('#nv-salary-max').disabled = tbd;
  }
  // Monta o salaryRange salvo (mesmo formato exibido nas vagas)
  function buildSalaryRange() {
    if ($('#nv-salary-tbd').checked) return 'A combinar';
    const min = $('#nv-salary-min').value.trim();
    const max = $('#nv-salary-max').value.trim();
    if (min && max) return `${min} - ${max}`;
    if (min) return `A partir de ${min}`;
    if (max) return `Até ${max}`;
    return '';
  }
  // Reconverte um salaryRange salvo para os dois campos / checkbox (modo edição)
  function fillSalary(str) {
    const txt = String(str || '').trim();
    if (!txt) return;
    if (/a combinar/i.test(txt)) { $('#nv-salary-tbd').checked = true; syncSalaryTbd(); return; }
    const valores = txt.match(/R\$\s*[\d.]+/g) || [];
    if (/a partir de/i.test(txt)) {
      if (valores[0]) $('#nv-salary-min').value = maskMoney(valores[0]);
    } else if (/^at[ée]/i.test(txt)) {
      if (valores[0]) $('#nv-salary-max').value = maskMoney(valores[0]);
    } else {
      if (valores[0]) $('#nv-salary-min').value = maskMoney(valores[0]);
      if (valores[1]) $('#nv-salary-max').value = maskMoney(valores[1]);
    }
  }

  /* ===== RESPONSABILIDADES (lista de linhas) ===== */
  const MAX_RESP = 20, MAX_BENEFITS = 12;
  const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function addRespRow(value, focus) {
    const list = $('#nv-resp-list');
    if (list.children.length >= MAX_RESP) { toast(`Máximo de ${MAX_RESP} responsabilidades.`, 'info'); return; }
    const row = document.createElement('div');
    row.className = 'nv-list-row';
    row.innerHTML =
      '<input type="text" class="nv-input" maxlength="200" placeholder="Ex: Desenvolver novas funcionalidades voltadas para o usuário final." />' +
      `<button type="button" class="nv-row-remove" aria-label="Remover responsabilidade">${ICON_X}</button>`;
    row.querySelector('input').value = value || '';
    list.appendChild(row);
    if (focus) row.querySelector('input').focus();
  }

  /* ===== BENEFÍCIOS (título + descrição) ===== */
  function addBenefitRow(title, desc, focus) {
    const list = $('#nv-benefit-list');
    if (list.children.length >= MAX_BENEFITS) { toast(`Máximo de ${MAX_BENEFITS} benefícios.`, 'info'); return; }
    const row = document.createElement('div');
    row.className = 'nv-benefit-row';
    row.innerHTML =
      '<input type="text" class="nv-input nv-benefit-title" maxlength="60" placeholder="Título (ex: Vale Refeição)" aria-label="Título do benefício" />' +
      '<input type="text" class="nv-input nv-benefit-desc" maxlength="200" placeholder="Descrição (ex: Cartão multibenefícios com valor acima da média)" aria-label="Descrição do benefício" />' +
      `<button type="button" class="nv-row-remove" aria-label="Remover benefício">${ICON_X}</button>`;
    row.querySelector('.nv-benefit-title').value = title || '';
    row.querySelector('.nv-benefit-desc').value  = desc || '';
    list.appendChild(row);
    if (focus) row.querySelector('input').focus();
  }

  // Lê as linhas (DOM como fonte da verdade) → arrays para o payload
  function collectResponsibilities() {
    return Array.prototype.map.call($('#nv-resp-list').querySelectorAll('input'), i => i.value.trim()).filter(Boolean);
  }
  function collectBenefits() {
    return Array.prototype.map.call($('#nv-benefit-list').querySelectorAll('.nv-benefit-row'), row => ({
      title:       row.querySelector('.nv-benefit-title').value.trim(),
      description: row.querySelector('.nv-benefit-desc').value.trim(),
    })).filter(b => b.title); // título obrigatório (espelha o backend)
  }

  function setSaving(on) {
    saving = on;
    $('#nv-draft').disabled = on;
    $('#nv-publish').disabled = on;
  }

  // kind: 'publish' | 'draft'
  async function save(kind) {
    if (saving) return;
    const body = collectPayload();

    // Validação client-side (espelha as regras do backend)
    if (!body.title) {
      toast('Dê um título para a vaga.', 'error');
      $('#nv-title').focus();
      return;
    }
    // Faixa salarial coerente: mínimo não pode ser maior que o máximo
    if (!$('#nv-salary-tbd').checked) {
      const min = moneyValue($('#nv-salary-min'));
      const max = moneyValue($('#nv-salary-max'));
      if (min && max && min > max) {
        toast('O salário mínimo não pode ser maior que o máximo.', 'error');
        $('#nv-salary-min').focus();
        return;
      }
    }
    if (kind === 'publish') {
      if (!body.description) {
        toast('Descreva a vaga antes de publicar (requisitos, responsabilidades, benefícios).', 'error');
        showEditor();
        $('#nv-desc').focus();
        return;
      }
      if (!skills.length && !window.confirm('Publicar sem habilidades técnicas?')) return;
    }

    // Criação → POST com status; edição → PATCH (rascunho mantém/promove o
    // status, vaga já publicada salva alterações SEM mexer no status).
    const method = isEdit ? 'PATCH' : 'POST';
    const path   = isEdit ? `/api/jobs/${jobId}` : '/api/jobs';
    if (!isEdit || editStatus === 'draft') {
      body.status = kind === 'publish' ? 'active' : 'draft';
    }

    setSaving(true);
    try {
      const res  = await api(path, { method, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'Não foi possível salvar a vaga.';
        toast(msg, 'error');
        // Empresa sem perfil completo: leva para a tela de completar o perfil
        if (res.status === 403 && /perfil/i.test(msg)) {
          setTimeout(() => { window.location.href = '/pages/completar-perfil-empresa.html'; }, 1600);
          return; // mantém os botões travados durante o redirect
        }
        setSaving(false);
        return;
      }
      const okMsg = (isEdit && editStatus !== 'draft')
        ? 'Alterações salvas!'
        : (kind === 'publish' ? 'Vaga publicada!' : 'Rascunho salvo.');
      toast(okMsg, 'success');
      setTimeout(() => { window.location.href = '/pages/empresa-vagas.html'; }, 1000);
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
      setSaving(false);
    }
  }

  /* ===== MODO EDIÇÃO (?id=<jobId>) ===== */
  async function loadJob() {
    setSaving(true); // trava os botões enquanto carrega
    try {
      const res  = await api(`/api/jobs/${jobId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.isOwner) {
        toast(data.error || 'Você só pode editar vagas da sua empresa.', 'error');
        setTimeout(() => { window.location.href = '/pages/empresa-vagas.html'; }, 1200);
        return;
      }
      editStatus = data.status || 'active';

      // Textos da tela viram "Editar Vaga"
      document.title = 'Editar Vaga — Orbit';
      $('#nv-crumb-current').textContent = 'Editar Vaga';
      $('#nv-page-title').textContent = 'Editar Vaga';

      // Preenche os campos
      $('#nv-title').value    = data.title || '';
      $('#nv-desc').value     = data.description || '';
      $('#nv-level').value    = data.level || 'Júnior';
      $('#nv-contract').value = data.contractType || 'CLT';
      fillSalary(data.salaryRange);
      // Ordem importa: o radio + syncModality vêm ANTES da localização — a
      // transição Remoto→outra restaura savedLocation e apagaria o valor carregado
      const radio = document.querySelector(`input[name="nv-modality"][value="${data.modality || 'Remoto'}"]`)
                 || document.querySelector('input[name="nv-modality"][value="Remoto"]');
      if (radio) radio.checked = true;
      savedLocation = data.location || '';
      syncModality();
      if (!$('#nv-location').disabled) $('#nv-location').value = data.location || '';
      skills = (data.skills || []).map(s => String(s)).slice(0, MAX_SKILLS);
      renderChips();
      renderSuggestions();

      // Responsabilidades e benefícios (uma linha em branco se a vaga não tiver)
      $('#nv-resp-list').innerHTML = '';
      const resp = (data.responsibilities || []).filter(Boolean);
      if (resp.length) resp.forEach(r => addRespRow(r));
      else addRespRow();
      $('#nv-benefit-list').innerHTML = '';
      const benefits = (data.benefits || []).filter(b => b && (b.title || b.description));
      if (benefits.length) benefits.forEach(b => addBenefitRow(b.title, b.description));
      else addBenefitRow();

      // Botões conforme o status: rascunho mantém o par "Rascunho/Publicar";
      // vaga já publicada esconde o rascunho e o primário vira "Salvar alterações".
      if (editStatus !== 'draft') {
        $('#nv-draft').hidden = true;
        $('#nv-publish').textContent = 'Salvar alterações';
      }
      setSaving(false);
    } catch (err) {
      if (err.message !== 'Token expirado') {
        toast('Não foi possível carregar a vaga.', 'error');
        setTimeout(() => { window.location.href = '/pages/empresa-vagas.html'; }, 1200);
      }
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#nv-form').addEventListener('submit', (ev) => ev.preventDefault());

    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });

    // Toolbar markdown + alternância de preview
    $('#nv-toolbar').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-fmt]');
      if (btn && !btn.disabled) { formatTextarea($('#nv-desc'), btn.getAttribute('data-fmt')); return; }
      if (ev.target.closest('#nv-preview-toggle')) { previewing ? showEditor() : showPreview(); }
    });

    // Radio-cards de modalidade
    document.querySelectorAll('input[name="nv-modality"]').forEach(r => {
      r.addEventListener('change', syncModality);
    });

    // Habilidades: Enter/vírgula adiciona; vírgula colada também
    const skillInput = $('#nv-skill-input');
    skillInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ',') {
        ev.preventDefault();
        addSkill(skillInput.value);
        skillInput.value = '';
      }
    });
    skillInput.addEventListener('input', () => {
      if (skillInput.value.includes(',')) {
        skillInput.value.split(',').forEach(p => addSkill(p));
        skillInput.value = '';
      }
    });
    $('#nv-chips').addEventListener('click', (ev) => {
      const x = ev.target.closest('[data-remove]');
      if (!x) return;
      skills.splice(Number(x.getAttribute('data-remove')), 1);
      renderChips();
      renderSuggestions();
    });
    $('#nv-suggest-list').addEventListener('click', (ev) => {
      const chip = ev.target.closest('[data-skill]');
      if (chip) addSkill(chip.getAttribute('data-skill'));
    });

    // Faixa salarial: máscara monetária ao digitar + "A combinar"
    wireMoneyInput($('#nv-salary-min'));
    wireMoneyInput($('#nv-salary-max'));
    $('#nv-salary-tbd').addEventListener('change', syncSalaryTbd);

    // Responsabilidades: adicionar / remover linha (Enter no fim adiciona outra)
    $('#nv-resp-add').addEventListener('click', () => addRespRow('', true));
    $('#nv-resp-list').addEventListener('click', (ev) => {
      const rm = ev.target.closest('.nv-row-remove');
      if (rm) rm.closest('.nv-list-row').remove();
    });
    $('#nv-resp-list').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addRespRow('', true); }
    });

    // Benefícios: adicionar / remover linha
    $('#nv-benefit-add').addEventListener('click', () => addBenefitRow('', '', true));
    $('#nv-benefit-list').addEventListener('click', (ev) => {
      const rm = ev.target.closest('.nv-row-remove');
      if (rm) rm.closest('.nv-benefit-row').remove();
    });

    // Ações do rodapé
    $('#nv-draft').addEventListener('click', () => save('draft'));
    $('#nv-publish').addEventListener('click', () => save('publish'));
  }

  // Sem perfil de empresa o POST retornaria 403 só no fim — verifica logo na
  // entrada para o usuário não preencher o formulário à toa (cobre deep-links)
  async function checkCompanyProfile() {
    try {
      const res  = await api('/api/companies/me');
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.company) {
        toast('Complete o perfil da sua empresa antes de publicar vagas.', 'info');
        setTimeout(() => { window.location.href = '/pages/completar-perfil-empresa.html'; }, 1200);
      }
    } catch (err) { /* silencioso — o submit ainda valida no backend */ }
  }

  /* ===== INIT ===== */
  function init() {
    renderIdentity();
    setupEvents();
    syncModality();      // aplica o estado inicial (Remoto selecionado)
    renderChips();
    renderSuggestions();
    loadVisibility();
    if (isEdit) {
      loadJob();
    } else {
      // criação: já mostra uma linha em branco de cada para guiar o preenchimento
      addRespRow();
      addBenefitRow();
      checkCompanyProfile();
    }
  }
  init();

})();
