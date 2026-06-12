// agenda.js — Orbit · Agenda "Sua Órbita"
// JS puro, sem framework. Backend: GET /api/agenda/me (tarefas + lembretes + entrevistas),
// CRUD em /api/tasks e /api/reminders. Entrevistas são somente leitura nesta tela
// (gestão em /pages/entrevistas.html).

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

  /* ===== HELPERS DE DATA ===== */
  function pad2(n) { return String(n).padStart(2, '0'); }
  // Chave local 'YYYY-MM-DD' (agrupa itens por dia no fuso do usuário)
  function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function keyFromISO(iso) { return dateKey(new Date(iso)); }
  // Valor para <input type="datetime-local"> (sempre horário LOCAL)
  function toInputValue(d) { return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function timeLabel(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ===== ESTADO ===== */
  const today = new Date();
  const state = {
    role: 'dev',
    tasks: [],
    reminders: [],
    interviews: [],
    viewYear: today.getFullYear(),       // mês visível no calendário
    viewMonth: today.getMonth(),
    selectedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    filters: { task: true, reminder: true, interview: true },
    editing: null,                       // { type:'task'|'reminder', id } quando em edição
    saving: false,
  };

  /* ===== MAPAS DE EXIBIÇÃO ===== */
  const PRIORITY = {
    alta:  { label: 'Alta',  cls: 'agd-chip--alta' },
    media: { label: 'Média', cls: 'agd-chip--media' },
    baixa: { label: 'Baixa', cls: 'agd-chip--baixa' },
  };
  const INT_STATUS = {
    agendada:              { label: 'Agendada',               cls: 'agd-badge--purple' },
    remarcacao_solicitada: { label: 'Remarcação solicitada',  cls: 'agd-badge--amber' },
    realizada:             { label: 'Realizada',              cls: 'agd-badge--green' },
    cancelada:             { label: 'Cancelada',              cls: 'agd-badge--red' },
  };
  const MODE_LABEL = { video: 'Vídeo chamada', presencial: 'Presencial', telefone: 'Telefone' };

  const ICONS = {
    edit:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    bell:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  };

  /* ===== AGRUPAMENTO POR DIA (respeitando filtros) ===== */
  function visibleItemsByDay() {
    const map = {}; // key -> { task, reminder, interview }
    function mark(key, type) {
      if (!map[key]) map[key] = {};
      map[key][type] = true;
    }
    if (state.filters.task)      state.tasks.forEach(t => { if (t.dueAt) mark(keyFromISO(t.dueAt), 'task'); });
    if (state.filters.reminder)  state.reminders.forEach(r => mark(keyFromISO(r.remindAt), 'reminder'));
    if (state.filters.interview) state.interviews.forEach(i => mark(keyFromISO(i.scheduledAt), 'interview'));
    return map;
  }

  function itemsForSelectedDay() {
    const key = dateKey(state.selectedDate);
    const items = [];
    if (state.filters.task) {
      state.tasks.forEach(t => { if (t.dueAt && keyFromISO(t.dueAt) === key) items.push({ type: 'task', when: new Date(t.dueAt), data: t }); });
    }
    if (state.filters.reminder) {
      state.reminders.forEach(r => { if (keyFromISO(r.remindAt) === key) items.push({ type: 'reminder', when: new Date(r.remindAt), data: r }); });
    }
    if (state.filters.interview) {
      state.interviews.forEach(i => { if (keyFromISO(i.scheduledAt) === key) items.push({ type: 'interview', when: new Date(i.scheduledAt), data: i }); });
    }
    items.sort((a, b) => a.when - b.when);
    return items;
  }

  /* ===== HERO ===== */
  function renderHero() {
    const firstName = ((currentUser && currentUser.name) || '').trim().split(/\s+/)[0];
    $('#hero-greeting').textContent = firstName ? `Olá, ${firstName}` : 'Olá';
    $('#hero-date').textContent = capitalize(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }));
  }

  function renderStats() {
    const now = new Date();
    $('#stat-tasks').textContent = state.tasks.filter(t => t.status === 'pendente').length;
    $('#stat-reminders').textContent = state.reminders.filter(r => !r.dispatchedAt).length;
    $('#stat-interviews').textContent = state.interviews.filter(i =>
      new Date(i.scheduledAt) >= now && i.status !== 'cancelada' && i.status !== 'realizada'
    ).length;
  }

  /* ===== CALENDÁRIO ===== */
  function renderCalendar() {
    const y = state.viewYear, m = state.viewMonth;
    const monthName = new Date(y, m, 1).toLocaleDateString('pt-BR', { month: 'long' });
    $('#cal-title').textContent = `${capitalize(monthName)} ${y}`;

    const byDay = visibleItemsByDay();
    const todayKey = dateKey(new Date());
    const selKey = dateKey(state.selectedDate);

    const firstDow = new Date(y, m, 1).getDay();         // 0=domingo
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    let html = '';
    for (let c = 0; c < totalCells; c++) {
      const dayNum = c - firstDow + 1;

      // Dias fora do mês (capa do mês anterior/seguinte) — apenas visuais
      if (dayNum < 1 || dayNum > daysInMonth) {
        const n = dayNum < 1 ? daysInPrev + dayNum : dayNum - daysInMonth;
        html += `<span class="agd-cal__day agd-cal__day--out" aria-hidden="true"><span class="agd-cal__num">${n}</span><span class="agd-cal__dots"></span></span>`;
        continue;
      }

      const key = `${y}-${pad2(m + 1)}-${pad2(dayNum)}`;
      const types = byDay[key] || {};
      const dots = ['task', 'reminder', 'interview']
        .filter(t => types[t])
        .map(t => `<i class="agd-dot agd-dot--${t}"></i>`)
        .join('');

      const isToday = key === todayKey;
      const isSel = key === selKey;
      const cls = `agd-cal__day${isToday ? ' agd-cal__day--today' : ''}${isSel ? ' agd-cal__day--selected' : ''}`;
      const label = `${dayNum} de ${monthName}`;

      html += `
        <button type="button" class="${cls}" role="gridcell" data-date="${key}"
          aria-selected="${isSel}" aria-label="${escapeHtml(label)}">
          <span class="agd-cal__num">${dayNum}</span>
          <span class="agd-cal__dots">${dots}</span>
        </button>`;
    }
    $('#cal-grid').innerHTML = html;
  }

  /* ===== CARDS (markup) ===== */
  function buildTaskCard(t) {
    const done = t.status === 'concluida';
    const pr = PRIORITY[t.priority] || PRIORITY.media;
    return `
      <article class="agd-card agd-card--task${done ? ' agd-card--done' : ''}" data-type="task" data-id="${escapeHtml(t.id)}">
        <button type="button" class="agd-check${done ? ' is-checked' : ''}" data-action="toggle"
          role="checkbox" aria-checked="${done}" aria-label="${done ? 'Reabrir tarefa' : 'Concluir tarefa'}">${ICONS.check}</button>
        <div class="agd-card__body">
          <div class="agd-card__top">
            <h3 class="agd-card__title">${escapeHtml(t.title)}</h3>
            <span class="agd-chip ${pr.cls}">${pr.label}</span>
          </div>
          ${t.description ? `<p class="agd-card__desc">${escapeHtml(t.description)}</p>` : ''}
        </div>
        <div class="agd-card__actions">
          <button type="button" class="agd-icon-btn" data-action="edit" aria-label="Editar tarefa" title="Editar">${ICONS.edit}</button>
          <button type="button" class="agd-icon-btn agd-icon-btn--danger" data-action="delete" aria-label="Excluir tarefa" title="Excluir">${ICONS.trash}</button>
        </div>
      </article>`;
  }

  function buildReminderCard(r) {
    const sent = !!r.dispatchedAt;
    return `
      <article class="agd-card agd-card--reminder${sent ? ' agd-card--sent' : ''}" data-type="reminder" data-id="${escapeHtml(r.id)}">
        <div class="agd-card__icon" aria-hidden="true">${ICONS.bell}</div>
        <div class="agd-card__body">
          <div class="agd-card__top">
            <h3 class="agd-card__title">${escapeHtml(r.title)}</h3>
            ${sent
              ? '<span class="agd-badge agd-badge--green">Enviado ✓</span>'
              : '<span class="agd-badge agd-badge--purple">Programado</span>'}
          </div>
          ${r.notes ? `<p class="agd-card__desc">${escapeHtml(r.notes)}</p>` : ''}
          ${sent ? '' : '<p class="agd-card__hint">Você receberá email + notificação</p>'}
        </div>
        <div class="agd-card__actions">
          <button type="button" class="agd-icon-btn" data-action="edit" aria-label="Editar lembrete" title="${sent ? 'Lembrete já enviado' : 'Editar'}" ${sent ? 'disabled' : ''}>${ICONS.edit}</button>
          <button type="button" class="agd-icon-btn agd-icon-btn--danger" data-action="delete" aria-label="Excluir lembrete" title="Excluir">${ICONS.trash}</button>
        </div>
      </article>`;
  }

  function buildInterviewCard(it) {
    const st = INT_STATUS[it.status] || { label: it.status, cls: 'agd-badge--neutral' };
    const mode = it.modeLabel || MODE_LABEL[it.mode] || it.mode || '';
    const cancelled = it.status === 'cancelada';

    // Contraparte: dev vê a empresa; empresa vê o candidato
    let whoName = '';
    let avatar = '';
    if (state.role === 'company') {
      const c = it.candidate || {};
      whoName = c.name || 'Candidato(a)';
      const init = (c.name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
      avatar = c.avatarUrl
        ? `<img src="${escapeHtml(c.avatarUrl)}" alt="${escapeHtml(whoName)}" />`
        : escapeHtml(init);
    } else {
      const c = it.company || {};
      whoName = c.name || 'Empresa';
      avatar = c.logoUrl
        ? `<img src="${escapeHtml(c.logoUrl)}" alt="${escapeHtml(whoName)}" />`
        : escapeHtml(c.logoInitials || (c.name || '?').slice(0, 2).toUpperCase());
    }
    const jobTitle = (it.job && it.job.title) || 'Entrevista';

    return `
      <article class="agd-card agd-card--interview${cancelled ? ' agd-card--muted' : ''}" data-type="interview" data-id="${escapeHtml(it.id)}">
        <div class="agd-card__avatar" aria-hidden="true">${avatar}</div>
        <div class="agd-card__body">
          <div class="agd-card__top">
            <h3 class="agd-card__title">${escapeHtml(jobTitle)}</h3>
            <span class="agd-badge ${st.cls}">${escapeHtml(st.label)}</span>
          </div>
          <p class="agd-card__who">com ${escapeHtml(whoName)}</p>
          <div class="agd-card__meta">
            <span class="agd-badge agd-badge--neutral">${escapeHtml(mode)}</span>
            <span class="agd-badge agd-badge--neutral">${timeLabel(it.scheduledAt)} · ${Number(it.durationMin) || 0} min</span>
          </div>
          <a class="agd-card__manage" href="/pages/entrevistas.html" aria-label="Gerenciar entrevistas">Gerenciar →</a>
        </div>
      </article>`;
  }

  /* ===== PAINEL DO DIA (timeline) ===== */
  function renderDay() {
    const fmt = state.selectedDate
      .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace('-feira', '');
    $('#day-title').textContent = capitalize(fmt);

    const timeline = $('#timeline');
    const items = itemsForSelectedDay();

    if (!items.length) {
      timeline.classList.remove('agd-timeline--line');
      timeline.innerHTML = `
        <div class="agd-empty">
          <div class="agd-empty__orbit" aria-hidden="true">
            <span class="agd-empty__ring agd-empty__ring--1"></span>
            <span class="agd-empty__ring agd-empty__ring--2"></span>
            <span class="agd-empty__planet"></span>
          </div>
          <p class="agd-empty__title">Nada na sua órbita neste dia.</p>
          <p class="agd-empty__text">Adicione uma tarefa ou programe um lembrete para este dia.</p>
          <div class="agd-empty__actions">
            <button type="button" class="agd-btn-primary" data-action="new-task">+ Tarefa</button>
            <button type="button" class="agd-btn-ghost" data-action="new-reminder">+ Lembrete</button>
          </div>
        </div>`;
      return;
    }

    timeline.classList.add('agd-timeline--line');
    timeline.innerHTML = items.map(item => {
      let card = '';
      if (item.type === 'task') card = buildTaskCard(item.data);
      else if (item.type === 'reminder') card = buildReminderCard(item.data);
      else card = buildInterviewCard(item.data);
      return `
        <div class="agd-titem agd-titem--${item.type}">
          <span class="agd-titem__time">${timeLabel(item.when.toISOString())}</span>
          <span class="agd-titem__node" aria-hidden="true"></span>
          ${card}
        </div>`;
    }).join('');
  }

  /* ===== TAREFAS SEM DATA ===== */
  function renderUndated() {
    const card = $('#undated-card');
    const list = state.filters.task ? state.tasks.filter(t => !t.dueAt) : [];
    if (!list.length) { card.hidden = true; return; }
    card.hidden = false;
    $('#undated-list').innerHTML = list.map(t => `<li>${buildTaskCard(t)}</li>`).join('');
  }

  function renderAll() {
    renderStats();
    renderCalendar();
    renderDay();
    renderUndated();
  }

  /* ===== MODAIS ===== */
  const taskModal = $('#task-modal');
  const remModal  = $('#rem-modal');

  function openModal(modal) {
    modal.hidden = false;
    const first = modal.querySelector('input, textarea, select');
    if (first) first.focus();
  }
  function closeModal(modal) { modal.hidden = true; state.editing = null; }

  // Prefill padrão: dia selecionado às 09:00
  function defaultDue() {
    const d = new Date(state.selectedDate);
    d.setHours(9, 0, 0, 0);
    return toInputValue(d);
  }

  function openTaskModal(task) {
    state.editing = task ? { type: 'task', id: task.id } : null;
    $('#task-modal-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
    $('#task-submit').textContent = task ? 'Salvar alterações' : 'Salvar tarefa';
    $('#task-title').value = task ? task.title : '';
    $('#task-desc').value = task ? (task.description || '') : '';
    $('#task-due').value = task
      ? (task.dueAt ? toInputValue(new Date(task.dueAt)) : '')
      : defaultDue();
    $('#task-priority').value = task ? (task.priority || 'media') : 'media';
    openModal(taskModal);
  }

  function openReminderModal(rem) {
    state.editing = rem ? { type: 'reminder', id: rem.id } : null;
    $('#rem-modal-title').textContent = rem ? 'Editar lembrete' : 'Novo lembrete';
    $('#rem-submit').textContent = rem ? 'Salvar alterações' : 'Salvar lembrete';
    $('#rem-title').value = rem ? rem.title : '';
    $('#rem-notes').value = rem ? (rem.notes || '') : '';
    $('#rem-at').value = rem ? toInputValue(new Date(rem.remindAt)) : defaultDue();
    openModal(remModal);
  }

  /* ===== MUTAÇÕES (API) ===== */
  async function reload() {
    // Re-busca tudo mantendo o dia selecionado e o mês visível (ficam no state)
    await loadData();
    renderAll();
  }

  async function submitTask(ev) {
    ev.preventDefault();
    if (state.saving) return;

    const title = $('#task-title').value.trim();
    if (!title) { toast('Informe o título da tarefa.', 'error'); return; }
    if (title.length > 140) { toast('O título deve ter no máximo 140 caracteres.', 'error'); return; }

    const payload = {
      title,
      description: $('#task-desc').value.trim(),
      priority: $('#task-priority').value,
    };
    const dueVal = $('#task-due').value;
    const editing = state.editing && state.editing.type === 'task' ? state.editing : null;
    if (dueVal) payload.dueAt = new Date(dueVal).toISOString();
    else if (editing) payload.dueAt = null; // remover a data ao editar

    state.saving = true;
    const btn = $('#task-submit');
    btn.disabled = true;
    try {
      const res = editing
        ? await api(`/api/tasks/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível salvar a tarefa.', 'error'); return; }
      closeModal(taskModal);
      toast(editing ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
      await reload();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão ao salvar a tarefa.', 'error');
    } finally {
      state.saving = false;
      btn.disabled = false;
    }
  }

  async function submitReminder(ev) {
    ev.preventDefault();
    if (state.saving) return;

    const title = $('#rem-title').value.trim();
    const atVal = $('#rem-at').value;
    if (!title) { toast('Informe o título do lembrete.', 'error'); return; }
    if (title.length > 140) { toast('O título deve ter no máximo 140 caracteres.', 'error'); return; }
    if (!atVal) { toast('Informe quando você quer ser lembrado.', 'error'); return; }

    const editing = state.editing && state.editing.type === 'reminder' ? state.editing : null;
    const newAt = new Date(atVal).toISOString();
    // só envia/valida remindAt se mudou — editar só o texto não rearma o disparo
    const dateChanged = !editing || newAt !== editing.remindAt;
    if (dateChanged && new Date(atVal) <= new Date()) { toast('O lembrete precisa de uma data futura.', 'error'); return; }

    const payload = {
      title,
      notes: $('#rem-notes').value.trim(),
    };
    if (dateChanged) payload.remindAt = newAt;

    state.saving = true;
    const btn = $('#rem-submit');
    btn.disabled = true;
    try {
      const res = editing
        ? await api(`/api/reminders/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/reminders', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível salvar o lembrete.', 'error'); return; }
      closeModal(remModal);
      toast(editing ? 'Lembrete atualizado!' : 'Lembrete programado!', 'success');
      await reload();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão ao salvar o lembrete.', 'error');
    } finally {
      state.saving = false;
      btn.disabled = false;
    }
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    try {
      const res = await api(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível atualizar a tarefa.', 'error'); return; }
      toast(newStatus === 'concluida' ? 'Tarefa concluída!' : 'Tarefa reaberta.', newStatus === 'concluida' ? 'success' : 'info');
      await reload();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão ao atualizar a tarefa.', 'error');
    }
  }

  async function deleteItem(type, id) {
    const isTask = type === 'task';
    if (!window.confirm(isTask ? 'Excluir esta tarefa?' : 'Excluir este lembrete?')) return;
    try {
      const res = await api(`/api/${isTask ? 'tasks' : 'reminders'}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível excluir.', 'error'); return; }
      toast(isTask ? 'Tarefa excluída.' : 'Lembrete excluído.', 'success');
      await reload();
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão ao excluir.', 'error');
    }
  }

  /* ===== AÇÕES NOS CARDS (delegação) ===== */
  function handleCardAction(ev) {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.getAttribute('data-action');

    // Atalhos do estado vazio
    if (action === 'new-task') { openTaskModal(null); return; }
    if (action === 'new-reminder') { openReminderModal(null); return; }

    const card = btn.closest('[data-type][data-id]');
    if (!card) return;
    const type = card.getAttribute('data-type');
    const id = card.getAttribute('data-id');

    if (type === 'task') {
      const task = state.tasks.find(t => String(t.id) === String(id));
      if (!task) return;
      if (action === 'toggle') toggleTask(task);
      else if (action === 'edit') openTaskModal(task);
      else if (action === 'delete') deleteItem('task', id);
    } else if (type === 'reminder') {
      const rem = state.reminders.find(r => String(r.id) === String(id));
      if (!rem) return;
      if (action === 'edit') openReminderModal(rem);
      else if (action === 'delete') deleteItem('reminder', id);
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    // Navegação do calendário
    $('#cal-prev').addEventListener('click', () => {
      state.viewMonth--;
      if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
      renderCalendar();
    });
    $('#cal-next').addEventListener('click', () => {
      state.viewMonth++;
      if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
      renderCalendar();
    });
    $('#cal-today').addEventListener('click', () => {
      const now = new Date();
      state.viewYear = now.getFullYear();
      state.viewMonth = now.getMonth();
      state.selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      renderCalendar();
      renderDay();
    });

    // Seleção de dia
    $('#cal-grid').addEventListener('click', (ev) => {
      const cell = ev.target.closest('[data-date]');
      if (!cell) return;
      const [y, m, d] = cell.getAttribute('data-date').split('-').map(Number);
      state.selectedDate = new Date(y, m - 1, d);
      renderCalendar();
      renderDay();
    });

    // Filtros de tipo
    document.querySelectorAll('.agd-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-filter');
        state.filters[type] = !state.filters[type];
        chip.classList.toggle('is-on', state.filters[type]);
        chip.setAttribute('aria-pressed', String(state.filters[type]));
        renderCalendar();
        renderDay();
        renderUndated();
      });
    });

    // Novo item
    $('#btn-new-task').addEventListener('click', () => openTaskModal(null));
    $('#btn-new-reminder').addEventListener('click', () => openReminderModal(null));

    // Ações nos cards (timeline + sem data)
    $('#timeline').addEventListener('click', handleCardAction);
    $('#undated-list').addEventListener('click', handleCardAction);

    // Modais: fechar por X / overlay / cancelar (data-close) e por Escape
    document.querySelectorAll('[data-close="task"]').forEach(el => el.addEventListener('click', () => closeModal(taskModal)));
    document.querySelectorAll('[data-close="rem"]').forEach(el => el.addEventListener('click', () => closeModal(remModal)));
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      // dropdown do orbit-select aberto: o Esc é dele (fecha só o painel)
      if (document.querySelector('.osel-panel:not([hidden])')) return;
      if (!taskModal.hidden) closeModal(taskModal);
      if (!remModal.hidden) closeModal(remModal);
    });

    // Submits
    $('#task-form').addEventListener('submit', submitTask);
    $('#rem-form').addEventListener('submit', submitReminder);
  }

  /* ===== CARGA DE DADOS ===== */
  async function loadData() {
    const res = await api('/api/agenda/me');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao carregar a agenda.');
    state.role = data.role || 'dev';
    state.tasks = data.tasks || [];
    state.reminders = data.reminders || [];
    state.interviews = data.interviews || [];
  }

  /* ===== INIT ===== */
  async function init() {
    renderHero();
    setupEvents();
    try {
      await loadData();
      renderAll();
    } catch (err) {
      if (err.message === 'Token expirado') return;
      renderCalendar();
      renderDay(); // exibe o título do dia; em seguida troca a timeline pela mensagem de erro
      const timeline = $('#timeline');
      timeline.classList.remove('agd-timeline--line');
      timeline.innerHTML = '<p class="agd-loading">Não foi possível carregar sua agenda. Tente novamente mais tarde.</p>';
      toast(err.message || 'Erro ao carregar a agenda.', 'error');
    }
  }

  init();

})();
