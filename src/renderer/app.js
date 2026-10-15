/* ══════════════════════════════════════════════════════════════
   Asana Clone — Complete Renderer Application (v2 — 30 features)
   Reverse-engineered from Asana Desktop v2.10.2 via REA
   16,019 graph nodes · 99 IPC channels · 398MB evidence
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── State ──
  const state = {
    tasks: [],
    projects: [],
    sections: {},
    goals: [],
    portfolios: [],
    teams: [{ id: 't1', name: 'Engineering' }, { id: 't2', name: 'Design' }, { id: 't3', name: 'Marketing' }],
    users: [
      { id: 'u1', name: 'You', initials: 'U', email: 'user@example.com', color: '#4573d2' },
      { id: 'u2', name: 'Alice Chen', initials: 'AC', email: 'alice@example.com', color: '#e8384f' },
      { id: 'u3', name: 'Bob Park', initials: 'BP', email: 'bob@example.com', color: '#62d26f' },
      { id: 'u4', name: 'Carol Dias', initials: 'CD', email: 'carol@example.com', color: '#7a6ff0' },
    ],
    inbox: [],
    statusUpdates: [],
    starred: [],
    currentView: 'home',
    currentProject: null,
    currentProjectTab: 'list',
    selectedTask: null,
    activeTab: 'list',
    sidebarCollapsed: false,
    theme: 'light',
    topbarColor: '#f06a6a',
    sidebarColor: '#1e1f21',
    compactMode: false,
    notepad: '',
    nextId: 1,
    // v2 additions
    customFields: [],
    rules: [],
    forms: [],
    messages: [],
    timeEntries: [],
    templates: { projects: [], tasks: [] },
    workspace: { name: 'My Workspace', icon: 'A', members: ['u1', 'u2', 'u3', 'u4'] },
    guests: [],
    batchSelected: [],
    undoStack: [],
    redoStack: [],
    activeTimer: null,
  };

  let timerInterval = null;

  const genId = () => `id_${state.nextId++}_${Date.now().toString(36)}`;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Persistence ──
  function saveState() {
    try {
      localStorage.setItem('asana-clone-state', JSON.stringify({
        tasks: state.tasks, projects: state.projects, sections: state.sections,
        goals: state.goals, portfolios: state.portfolios, inbox: state.inbox,
        statusUpdates: state.statusUpdates, starred: state.starred, notepad: state.notepad,
        theme: state.theme, topbarColor: state.topbarColor, sidebarColor: state.sidebarColor,
        compactMode: state.compactMode, nextId: state.nextId,
        customFields: state.customFields, rules: state.rules, forms: state.forms,
        messages: state.messages, timeEntries: state.timeEntries, templates: state.templates,
        workspace: state.workspace, guests: state.guests,
      }));
    } catch {}
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem('asana-clone-state'));
      if (!saved) return;
      Object.assign(state, saved);
      // Backward compat: projectId → projectIds
      state.tasks.forEach(t => {
        if (t.projectId !== undefined && !t.projectIds) {
          t.projectIds = t.projectId ? [t.projectId] : [];
          delete t.projectId;
        }
        if (!t.projectIds) t.projectIds = [];
        if (!t.blockedBy) t.blockedBy = [];
        if (!t.blocking) t.blocking = [];
        if (!t.attachments) t.attachments = [];
        if (!t.customFieldValues) t.customFieldValues = {};
        if (t.startDate === undefined) t.startDate = null;
        if (t.isMilestone === undefined) t.isMilestone = false;
        if (t.isApproval === undefined) t.isApproval = false;
        if (t.approvalStatus === undefined) t.approvalStatus = null;
        if (t.recurrence === undefined) t.recurrence = null;
        if (t.timeTracked === undefined) t.timeTracked = 0;
      });
      if (!state.customFields) state.customFields = [];
      if (!state.rules) state.rules = [];
      if (!state.forms) state.forms = [];
      if (!state.messages) state.messages = [];
      if (!state.timeEntries) state.timeEntries = [];
      if (!state.templates) state.templates = { projects: [], tasks: [] };
      if (!state.workspace) state.workspace = { name: 'My Workspace', icon: 'A', members: ['u1','u2','u3','u4'] };
      if (!state.guests) state.guests = [];
      if (!state.batchSelected) state.batchSelected = [];
      if (!state.undoStack) state.undoStack = [];
      if (!state.redoStack) state.redoStack = [];
    } catch {}
  }

  function getTaskProject(task) {
    const pid = task.projectIds?.[0] || task.projectId;
    return pid ? state.projects.find(p => p.id === pid) : null;
  }
  function getTaskProjectId(task) {
    return task.projectIds?.[0] || task.projectId || null;
  }
  function taskInProject(task, projectId) {
    if (task.projectIds) return task.projectIds.includes(projectId);
    return task.projectId === projectId;
  }

  // ── Date Utilities ──
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  function isOverdue(dateStr) { if (!dateStr) return false; return new Date(dateStr + 'T23:59:59') < new Date(); }
  function isToday(dateStr) { if (!dateStr) return false; return new Date(dateStr + 'T00:00:00').toDateString() === new Date().toDateString(); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function dateToX(dateStr, rangeStart, dayWidth) {
    const d = new Date(dateStr + 'T00:00:00');
    const s = new Date(rangeStart + 'T00:00:00');
    return Math.floor((d - s) / 86400000) * dayWidth;
  }
  function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function calculateNextDate(dateStr, pattern, interval) {
    const d = new Date(dateStr + 'T00:00:00');
    switch (pattern) {
      case 'daily': d.setDate(d.getDate() + interval); break;
      case 'weekly': d.setDate(d.getDate() + 7 * interval); break;
      case 'monthly': d.setMonth(d.getMonth() + interval); break;
      case 'yearly': d.setFullYear(d.getFullYear() + interval); break;
    }
    return d.toISOString().slice(0, 10);
  }

  // ── Toast ──
  function showToast(msg) {
    const c = $('#toast-container'); if (!c) return;
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.textContent = msg;
    c.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ── Celebration ──
  function celebrate() {
    const canvas = $('#celebration-canvas'); if (!canvas) return;
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#e8384f','#fd612c','#eec300','#a4cf30','#62d26f','#20aaea','#7a6ff0','#ea4e9d'];
    for (let i = 0; i < 80; i++) {
      particles.push({ x: Math.random()*canvas.width, y: -10-Math.random()*200, vx: (Math.random()-.5)*4, vy: Math.random()*4+2, size: Math.random()*6+3, color: colors[Math.floor(Math.random()*colors.length)], rotation: Math.random()*360, spin: (Math.random()-.5)*10 });
    }
    let frame = 0;
    (function animate() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=.1; p.rotation+=p.spin; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rotation*Math.PI/180); ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.4); ctx.restore(); });
      if (++frame < 120) requestAnimationFrame(animate);
      else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.classList.add('hidden'); }
    })();
  }

  // ── Undo/Redo ──
  function pushUndo(action) {
    state.undoStack.push(action);
    state.redoStack = [];
    if (state.undoStack.length > 50) state.undoStack.shift();
  }
  function undo() {
    const a = state.undoStack.pop(); if (!a) return;
    state.redoStack.push(a);
    switch (a.type) {
      case 'task-create': state.tasks = state.tasks.filter(t => t.id !== a.taskId); break;
      case 'task-delete': state.tasks.push(a.task); break;
      case 'task-update': { const t = state.tasks.find(x => x.id === a.taskId); if (t) Object.assign(t, a.before); break; }
    }
    saveState(); renderCurrentView();
  }
  function redo() {
    const a = state.redoStack.pop(); if (!a) return;
    state.undoStack.push(a);
    switch (a.type) {
      case 'task-create': state.tasks.push(a.task); break;
      case 'task-delete': state.tasks = state.tasks.filter(t => t.id !== a.taskId); break;
      case 'task-update': { const t = state.tasks.find(x => x.id === a.taskId); if (t) Object.assign(t, a.after); break; }
    }
    saveState(); renderCurrentView();
  }

  // ── Task CRUD ──
  function createTask(data) {
    const task = {
      id: genId(), name: data.name || 'New Task', description: data.description || '',
      completed: false, assignee: data.assignee || null, dueDate: data.dueDate || null,
      projectIds: data.projectIds || (data.projectId ? [data.projectId] : []),
      sectionId: data.sectionId || null, priority: data.priority || null,
      tags: data.tags || [], subtasks: [], comments: [], likes: 0, liked: false,
      dependencies: [], attachments: data.attachments || [], createdAt: Date.now(), completedAt: null,
      blockedBy: data.blockedBy || [], blocking: data.blocking || [],
      customFieldValues: data.customFieldValues || {},
      startDate: data.startDate || null,
      isMilestone: data.isMilestone || false,
      isApproval: data.isApproval || false,
      approvalStatus: data.approvalStatus || null,
      recurrence: data.recurrence || null,
      timeTracked: 0,
    };
    state.tasks.push(task);
    pushUndo({ type: 'task-create', taskId: task.id, task: { ...task } });
    executeRules('task-created', task);
    saveState();
    return task;
  }

  function deleteTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) pushUndo({ type: 'task-delete', taskId, task: { ...task } });
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    state.tasks.forEach(t => { t.blockedBy = t.blockedBy.filter(id => id !== taskId); t.blocking = t.blocking.filter(id => id !== taskId); });
    if (state.selectedTask?.id === taskId) { state.selectedTask = null; hideTaskDetail(); }
    state.batchSelected = state.batchSelected.filter(id => id !== taskId);
    saveState();
  }

  function completeTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId); if (!task) return;
    const before = { completed: task.completed, completedAt: task.completedAt };
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    pushUndo({ type: 'task-update', taskId, before, after: { completed: task.completed, completedAt: task.completedAt } });
    if (task.completed) {
      celebrate();
      executeRules('task-completed', task);
      if (task.recurrence) handleRecurringTask(task);
    }
    saveState();
  }

  // ── Recurring Tasks ──
  function handleRecurringTask(task) {
    if (!task.recurrence || !task.dueDate) return;
    const nextDate = calculateNextDate(task.dueDate, task.recurrence.pattern, task.recurrence.interval || 1);
    const newStart = task.startDate ? calculateNextDate(task.startDate, task.recurrence.pattern, task.recurrence.interval || 1) : null;
    createTask({
      name: task.name, description: task.description, assignee: task.assignee,
      dueDate: nextDate, startDate: newStart, projectIds: [...task.projectIds],
      sectionId: task.sectionId, priority: task.priority, tags: [...task.tags],
      recurrence: { ...task.recurrence }, customFieldValues: { ...task.customFieldValues },
      isMilestone: task.isMilestone, isApproval: task.isApproval,
    });
    showToast('Next occurrence created for ' + formatDate(nextDate));
  }

  // ── Rules / Automation ──
  function createRule(data) {
    const rule = { id: genId(), projectId: data.projectId, name: data.name || 'New Rule',
      trigger: data.trigger, action: data.action, enabled: true, createdAt: Date.now() };
    state.rules.push(rule);
    saveState();
    return rule;
  }

  function executeRules(event, task) {
    state.rules.filter(r => r.enabled).forEach(r => {
      const pid = getTaskProjectId(task);
      if (r.projectId && r.projectId !== pid) return;
      let match = false;
      switch (r.trigger?.type) {
        case 'task-completed': match = event === 'task-completed'; break;
        case 'task-created': match = event === 'task-created'; break;
        case 'task-moved': match = event === 'task-moved'; break;
        case 'task-assigned': match = event === 'task-assigned'; break;
      }
      if (!match) return;
      switch (r.action?.type) {
        case 'move-to-section':
          if (r.action.sectionId) task.sectionId = r.action.sectionId;
          break;
        case 'assign-to':
          if (r.action.assignee) task.assignee = r.action.assignee;
          break;
        case 'add-comment':
          task.comments.push({ id: genId(), userId: 'u1', text: r.action.text || 'Auto comment', createdAt: Date.now() });
          break;
        case 'mark-complete':
          if (!task.completed) { task.completed = true; task.completedAt = Date.now(); }
          break;
      }
    });
  }

  // ── Custom Fields ──
  function createCustomField(data) {
    const field = { id: genId(), projectId: data.projectId, name: data.name, type: data.type || 'text', options: data.options || [] };
    state.customFields.push(field);
    saveState();
    return field;
  }

  // ── Project CRUD ──
  function createProject(data) {
    const project = {
      id: genId(), name: data.name || 'New Project', color: data.color || '#6d6e6f',
      defaultView: data.defaultView || 'list', privacy: data.privacy || 'public',
      members: ['u1'], sections: data.sections || [
        { id: genId(), name: 'To Do' }, { id: genId(), name: 'In Progress' }, { id: genId(), name: 'Done' },
      ],
      starred: false, createdAt: Date.now(), statusUpdates: [], description: data.description || '',
    };
    state.projects.push(project);
    saveState();
    return project;
  }

  function createGoal(data) {
    const goal = { id: genId(), name: data.name || 'New Goal', owner: data.owner || 'u1', dueDate: data.dueDate || null, progress: 0, status: 'on-track', createdAt: Date.now() };
    state.goals.push(goal); saveState(); return goal;
  }

  // ── Render: Sidebar ──
  function renderSidebar() {
    const projectItems = $('#project-items');
    if (projectItems) {
      projectItems.innerHTML = '';
      state.projects.forEach(p => {
        const el = document.createElement('div');
        el.className = 'project-nav-item'; el.dataset.projectId = p.id;
        el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
        el.onclick = () => openProject(p.id);
        projectItems.appendChild(el);
      });
    }
    const starredItems = $('#starred-items');
    if (starredItems) {
      starredItems.innerHTML = '';
      state.projects.filter(p => p.starred).forEach(p => {
        const el = document.createElement('div');
        el.className = 'project-nav-item';
        el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
        el.onclick = () => openProject(p.id);
        starredItems.appendChild(el);
      });
    }
    const teamItems = $('#team-items');
    if (teamItems) {
      teamItems.innerHTML = '';
      state.teams.forEach(t => {
        const el = document.createElement('div'); el.className = 'project-nav-item';
        el.innerHTML = `<span class="nav-icon">&#x1F465;</span>${esc(t.name)}`;
        teamItems.appendChild(el);
      });
    }
  }

  // ── Render: Task Row ──
  function renderTaskRow(task) {
    const row = document.createElement('div');
    row.className = `task-row${task.completed ? ' completed' : ''}`;
    row.dataset.taskId = task.id;
    row.draggable = true;

    // Batch checkbox
    const batchCb = document.createElement('input');
    batchCb.type = 'checkbox';
    batchCb.className = 'batch-checkbox';
    batchCb.checked = state.batchSelected.includes(task.id);
    batchCb.onclick = (e) => { e.stopPropagation(); toggleBatchSelect(task.id); };
    row.appendChild(batchCb);

    // Checkbox (milestone=diamond, approval=shield, normal=circle)
    const checkbox = document.createElement('div');
    if (task.isMilestone) {
      checkbox.className = `milestone-checkbox${task.completed ? ' checked' : ''}`;
    } else if (task.isApproval) {
      checkbox.className = `approval-checkbox${task.completed ? ' checked' : ''}`;
    } else {
      checkbox.className = `task-checkbox${task.completed ? ' checked' : ''}`;
      checkbox.textContent = task.completed ? '✓' : '';
    }
    checkbox.onclick = (e) => { e.stopPropagation(); completeTask(task.id); renderCurrentView(); };
    row.appendChild(checkbox);

    const name = document.createElement('span');
    name.className = 'task-name'; name.textContent = task.name;
    row.appendChild(name);

    // Badges
    if (task.isMilestone) {
      const badge = document.createElement('span');
      badge.className = 'milestone-badge'; badge.textContent = '◆';
      row.appendChild(badge);
    }
    if (task.isApproval && task.approvalStatus) {
      const badge = document.createElement('span');
      badge.className = `approval-badge ${task.approvalStatus}`;
      badge.textContent = task.approvalStatus;
      row.appendChild(badge);
    }
    if (task.recurrence) {
      const badge = document.createElement('span');
      badge.className = 'recurring-badge'; badge.textContent = '↻ ' + task.recurrence.pattern;
      row.appendChild(badge);
    }
    if (task.priority) {
      const dot = document.createElement('span');
      dot.className = `task-priority-dot ${task.priority}`;
      row.appendChild(dot);
    }

    // Project tags (multi-homing)
    (task.projectIds || []).forEach(pid => {
      const project = state.projects.find(p => p.id === pid);
      if (project) {
        const tag = document.createElement('span');
        tag.className = 'task-project-tag';
        tag.style.background = project.color + '22'; tag.style.color = project.color;
        tag.textContent = project.name;
        row.appendChild(tag);
      }
    });

    if (task.dueDate) {
      const due = document.createElement('span');
      due.className = 'task-due';
      if (isOverdue(task.dueDate) && !task.completed) due.classList.add('overdue');
      if (isToday(task.dueDate)) due.classList.add('today');
      due.textContent = formatDate(task.dueDate);
      row.appendChild(due);
    }

    if (task.assignee) {
      const user = state.users.find(u => u.id === task.assignee);
      if (user) {
        const avatar = document.createElement('div');
        avatar.className = 'task-assignee-avatar';
        avatar.style.background = user.color; avatar.style.color = '#fff';
        avatar.textContent = user.initials;
        row.appendChild(avatar);
      }
    }

    row.onclick = () => openTaskDetail(task.id);
    row.ondragstart = (e) => { e.dataTransfer.setData('text/plain', task.id); row.classList.add('dragging'); };
    row.ondragend = () => row.classList.remove('dragging');
    return row;
  }

  // ── Render: Board Card ──
  function renderBoardCard(task) {
    const card = document.createElement('div');
    card.className = 'board-card'; card.dataset.taskId = task.id;
    let meta = '';
    if (task.dueDate) {
      const cls = isOverdue(task.dueDate) && !task.completed ? ' overdue' : isToday(task.dueDate) ? ' today' : '';
      meta += `<span class="task-due${cls}">${formatDate(task.dueDate)}</span>`;
    }
    if (task.assignee) {
      const user = state.users.find(u => u.id === task.assignee);
      if (user) meta += `<div class="task-assignee-avatar" style="background:${user.color};color:#fff">${user.initials}</div>`;
    }
    card.innerHTML = `<div class="board-card-title">${esc(task.name)}</div><div class="board-card-meta">${meta}</div>`;
    card.onclick = () => openTaskDetail(task.id);
    return card;
  }

  // ── Render: Home ──
  function renderHome() {
    const tasksList = $('#home-tasks-list'); if (!tasksList) return;
    tasksList.innerHTML = '';
    const myTasks = state.tasks.filter(t => (t.assignee === 'u1' || !t.assignee) && !t.completed).slice(0, 5);
    if (!myTasks.length) { tasksList.innerHTML = '<p style="color:var(--text-tertiary);font-size:12px">No tasks yet. Create one!</p>'; }
    myTasks.forEach(t => {
      const item = document.createElement('div'); item.className = 'home-task-item';
      const cb = document.createElement('div'); cb.className = 'task-checkbox';
      cb.onclick = (e) => { e.stopPropagation(); completeTask(t.id); renderHome(); };
      const name = document.createElement('span'); name.className = 'task-name'; name.textContent = t.name;
      item.appendChild(cb); item.appendChild(name);
      if (t.dueDate) {
        const due = document.createElement('span');
        due.className = `task-due${isOverdue(t.dueDate) ? ' overdue' : ''}`;
        due.textContent = formatDate(t.dueDate); item.appendChild(due);
      }
      item.onclick = () => openTaskDetail(t.id);
      tasksList.appendChild(item);
    });

    const projectsList = $('#home-projects-list'); if (projectsList) {
      projectsList.innerHTML = '';
      state.projects.slice(0, 4).forEach(p => {
        const item = document.createElement('div'); item.className = 'home-task-item';
        const count = state.tasks.filter(t => taskInProject(t, p.id) && !t.completed).length;
        item.innerHTML = `<span class="project-dot" style="background:${p.color}"></span><span class="task-name">${esc(p.name)}</span><span class="task-due">${count} tasks</span>`;
        item.onclick = () => openProject(p.id);
        projectsList.appendChild(item);
      });
    }
    const peopleList = $('#home-people-list'); if (peopleList) {
      peopleList.innerHTML = '';
      state.users.forEach(u => {
        const item = document.createElement('div'); item.className = 'home-task-item';
        item.innerHTML = `<div class="task-assignee-avatar" style="background:${u.color};color:#fff">${u.initials}</div><span class="task-name">${esc(u.name)}</span>`;
        peopleList.appendChild(item);
      });
    }
    const np = $('#private-notepad'); if (np) np.value = state.notepad;
  }

  // ── Render: My Tasks ──
  function renderMyTasks() {
    const sections = [
      { el: '#recently-assigned-tasks', filter: t => !t.completed && !isToday(t.dueDate) && !t.dueDate },
      { el: '#today-tasks', filter: t => !t.completed && isToday(t.dueDate) },
      { el: '#upcoming-tasks', filter: t => !t.completed && t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate) },
      { el: '#later-tasks', filter: t => t.completed },
    ];
    const myTasks = state.tasks.filter(t => t.assignee === 'u1' || !t.assignee);
    sections.forEach(sec => {
      const container = $(sec.el); if (!container) return;
      container.innerHTML = '';
      myTasks.filter(sec.filter).forEach(t => container.appendChild(renderTaskRow(t)));
    });
  }

  // ── Render: Board View ──
  function renderBoardView(projectId) {
    const columns = $('#board-columns'); if (!columns) return;
    columns.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId); if (!project) return;
    project.sections.forEach(section => {
      const tasks = state.tasks.filter(t => taskInProject(t, projectId) && t.sectionId === section.id && !t.completed);
      const col = document.createElement('div'); col.className = 'board-column'; col.dataset.sectionId = section.id;
      col.innerHTML = `<div class="board-column-header">${esc(section.name)} <span class="count">${tasks.length}</span></div><div class="board-column-body"></div><div class="board-add-card" data-section="${section.id}">+ Add task</div>`;
      const body = col.querySelector('.board-column-body');
      tasks.forEach(t => body.appendChild(renderBoardCard(t)));
      body.ondragover = (e) => { e.preventDefault(); body.classList.add('drag-over'); };
      body.ondragleave = () => body.classList.remove('drag-over');
      body.ondrop = (e) => { e.preventDefault(); body.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const task = state.tasks.find(t => t.id === taskId);
        if (task) { task.sectionId = section.id; executeRules('task-moved', task); saveState(); renderCurrentView(); }
      };
      col.querySelector('.board-add-card').onclick = () => { const task = createTask({ name: 'New Task', projectId, sectionId: section.id }); renderCurrentView(); openTaskDetail(task.id); };
      columns.appendChild(col);
    });
  }

  // ── Render: Calendar View ──
  function renderCalendarView() {
    const container = $('#calendar-view'); if (!container) return;
    container.innerHTML = '';
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:0 40px';
    header.innerHTML = `<button class="btn-secondary" id="cal-prev">&lt;</button><h3>${monthNames[month]} ${year}</h3><button class="btn-secondary" id="cal-next">&gt;</button>`;
    container.appendChild(header);
    const grid = document.createElement('div'); grid.className = 'calendar-grid';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { const cell = document.createElement('div'); cell.className = 'calendar-header-cell'; cell.textContent = d; grid.appendChild(cell); });
    for (let i = 0; i < firstDay; i++) { const cell = document.createElement('div'); cell.className = 'calendar-cell other-month'; cell.innerHTML = `<div class="calendar-day-num">${daysInPrev-firstDay+1+i}</div>`; grid.appendChild(cell); }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const cell = document.createElement('div'); cell.className = 'calendar-cell';
      if (day === now.getDate() && month === now.getMonth()) cell.classList.add('today');
      cell.innerHTML = `<div class="calendar-day-num">${day}</div>`;
      state.tasks.filter(t => t.dueDate === dateStr && !t.completed).forEach(t => {
        const project = getTaskProject(t);
        const el = document.createElement('div'); el.className = 'calendar-task';
        el.style.background = project ? project.color + '22' : 'var(--bg-hover)';
        el.style.color = project ? project.color : 'var(--text-primary)';
        el.textContent = t.name; el.onclick = () => openTaskDetail(t.id);
        cell.appendChild(el);
      });
      grid.appendChild(cell);
    }
    const remaining = 7 - ((firstDay + daysInMonth) % 7);
    if (remaining < 7) { for (let i = 1; i <= remaining; i++) { const cell = document.createElement('div'); cell.className = 'calendar-cell other-month'; cell.innerHTML = `<div class="calendar-day-num">${i}</div>`; grid.appendChild(cell); } }
    container.appendChild(grid);
  }

  // ── Render: Timeline / Gantt ──
  function renderTimeline(projectId) {
    const container = $('#timeline-container'); if (!container) return;
    container.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    const tasks = state.tasks.filter(t => taskInProject(t, projectId) && !t.completed && (t.startDate || t.dueDate));
    const dayWidth = 36;
    const today = todayStr();
    const rangeStart = addDays(today, -7);
    const rangeEnd = addDays(today, 30);
    const totalDays = Math.floor((new Date(rangeEnd+'T00:00:00') - new Date(rangeStart+'T00:00:00')) / 86400000);
    const labelW = 200;

    // Header
    const headerRow = document.createElement('div');
    headerRow.className = 'timeline-header';
    headerRow.style.paddingLeft = labelW + 'px';
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(new Date(rangeStart+'T00:00:00').getTime() + i*86400000);
      const cell = document.createElement('div');
      cell.className = 'timeline-date-cell';
      cell.style.minWidth = dayWidth + 'px';
      if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add('weekend');
      if (d.getDate() === 1) cell.classList.add('month-start');
      cell.textContent = d.getDate();
      headerRow.appendChild(cell);
    }
    container.appendChild(headerRow);

    // Body
    const body = document.createElement('div');
    body.className = 'timeline-body';
    body.style.position = 'relative';

    // Today line
    const todayX = labelW + dateToX(today, rangeStart, dayWidth) + dayWidth / 2;
    const todayLine = document.createElement('div');
    todayLine.className = 'timeline-today';
    todayLine.style.left = todayX + 'px';
    body.appendChild(todayLine);

    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'timeline-row';

      const label = document.createElement('div');
      label.className = 'timeline-row-label';
      label.style.width = labelW + 'px';
      label.textContent = task.name;
      label.onclick = () => openTaskDetail(task.id);
      row.appendChild(label);

      const barArea = document.createElement('div');
      barArea.className = 'timeline-bar-area';
      barArea.style.position = 'relative';
      barArea.style.width = (totalDays * dayWidth) + 'px';

      const start = task.startDate || task.dueDate;
      const end = task.dueDate || task.startDate;
      if (start && end) {
        const x = dateToX(start, rangeStart, dayWidth);
        const w = Math.max(dayWidth, dateToX(end, rangeStart, dayWidth) - x + dayWidth);
        const bar = document.createElement('div');
        bar.className = 'timeline-bar';
        if (task.isMilestone) {
          bar.style.cssText = `left:${x}px;width:${dayWidth}px;background:${project.color};border-radius:0;transform:rotate(45deg) scale(0.5);`;
        } else {
          bar.style.cssText = `left:${x}px;width:${w}px;background:${project.color};`;
        }
        bar.title = `${task.name}: ${formatDate(start)} - ${formatDate(end)}`;
        bar.onclick = () => openTaskDetail(task.id);
        barArea.appendChild(bar);
      }
      row.appendChild(barArea);
      body.appendChild(row);
    });

    container.appendChild(body);
  }

  // ── Render: Workflow ──
  function renderWorkflow(projectId) {
    const stagesEl = $('#workflow-stages'); if (!stagesEl) return;
    const ruleListEl = $('#rule-list'); if (!ruleListEl) return;
    stagesEl.innerHTML = ''; ruleListEl.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId); if (!project) return;

    project.sections.forEach((sec, i) => {
      if (i > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'workflow-arrow'; arrow.textContent = '→';
        stagesEl.appendChild(arrow);
      }
      const stage = document.createElement('div'); stage.className = 'workflow-stage';
      const taskCount = state.tasks.filter(t => taskInProject(t, projectId) && t.sectionId === sec.id && !t.completed).length;
      stage.innerHTML = `<div class="workflow-stage-header" style="background:${project.color}">${esc(sec.name)}</div><div class="workflow-stage-body">${taskCount} task${taskCount !== 1 ? 's' : ''}</div>`;
      stagesEl.appendChild(stage);
    });

    const projectRules = state.rules.filter(r => r.projectId === projectId);
    if (!projectRules.length) {
      ruleListEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px">No rules yet. Add one to automate workflows.</p>';
    }
    projectRules.forEach(r => {
      const card = document.createElement('div'); card.className = 'rule-card';
      card.innerHTML = `
        <div class="rule-icon">⚡</div>
        <div class="rule-info">
          <div class="rule-trigger">When: ${esc(r.trigger?.type || 'unknown')}</div>
          <div class="rule-action">Then: ${esc(r.action?.type || 'unknown')}</div>
        </div>
        <label class="rule-toggle"><input type="checkbox" ${r.enabled ? 'checked' : ''}><span></span></label>
      `;
      card.querySelector('input').onchange = (e) => { r.enabled = e.target.checked; saveState(); };
      ruleListEl.appendChild(card);
    });
  }

  // ── Render: Workload ──
  function renderWorkload() {
    const container = $('#workload-container'); if (!container) return;
    container.innerHTML = '';
    const dayWidth = 80; const days = 14; const today = todayStr();

    // Header
    const headerRow = document.createElement('div'); headerRow.className = 'workload-header-row';
    const headerInfo = document.createElement('div'); headerInfo.className = 'workload-user-info';
    headerInfo.innerHTML = '<strong>Team Member</strong>';
    headerRow.appendChild(headerInfo);
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const cell = document.createElement('div'); cell.className = 'workload-date-cell';
      cell.style.minWidth = dayWidth + 'px';
      cell.textContent = `${d.getMonth()+1}/${d.getDate()}`;
      headerRow.appendChild(cell);
    }
    container.appendChild(headerRow);

    state.users.forEach(user => {
      const row = document.createElement('div'); row.className = 'workload-user-row';
      const info = document.createElement('div'); info.className = 'workload-user-info';
      info.innerHTML = `<div class="workload-user-avatar" style="background:${user.color};color:#fff">${user.initials}</div><div class="workload-user-name">${esc(user.name)}</div>`;
      row.appendChild(info);
      const barContainer = document.createElement('div'); barContainer.className = 'workload-bar-container';
      for (let i = 0; i < days; i++) {
        const dateStr = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
        const cell = document.createElement('div'); cell.className = 'workload-bar-cell';
        cell.style.minWidth = dayWidth + 'px';
        const taskCount = state.tasks.filter(t => t.assignee === user.id && t.dueDate === dateStr && !t.completed).length;
        if (taskCount > 0) {
          const bar = document.createElement('div'); bar.className = 'workload-bar';
          bar.style.height = Math.min(taskCount * 12, 40) + 'px';
          if (taskCount > 3) bar.classList.add('over-capacity');
          else bar.classList.add('under-capacity');
          bar.title = `${taskCount} task${taskCount > 1 ? 's' : ''}`;
          cell.appendChild(bar);
        }
        barContainer.appendChild(cell);
      }
      row.appendChild(barContainer);
      container.appendChild(row);
    });
  }

  // ── Render: Admin ──
  function renderAdmin() {
    const stats = $('#admin-stats'); if (!stats) return;
    const content = $('#admin-panel-content'); if (!content) return;
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const activeProjects = state.projects.length;
    stats.innerHTML = [
      { label: 'Total Users', value: state.users.length },
      { label: 'Total Tasks', value: totalTasks },
      { label: 'Active Projects', value: activeProjects },
      { label: 'Completed Tasks', value: completedTasks },
    ].map(s => `<div class="admin-stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');

    content.innerHTML = '';
    const activePanel = document.querySelector('.admin-nav.active')?.dataset.admin || 'users';
    switch (activePanel) {
      case 'users':
        content.innerHTML = '<h3>Users</h3>';
        state.users.forEach(u => {
          const row = document.createElement('div'); row.className = 'admin-user-row';
          row.innerHTML = `<div class="task-assignee-avatar" style="background:${u.color};color:#fff">${u.initials}</div><span style="flex:1">${esc(u.name)}</span><span style="font-size:12px;color:var(--text-tertiary)">${u.email}</span><span class="user-role">${u.id === 'u1' ? 'Admin' : 'Member'}</span>`;
          content.appendChild(row);
        });
        if (state.guests.length) {
          const h = document.createElement('h3'); h.textContent = 'Guests'; h.style.marginTop = '16px';
          content.appendChild(h);
          state.guests.forEach(g => {
            const row = document.createElement('div'); row.className = 'admin-user-row';
            row.innerHTML = `<span style="flex:1">${esc(g.name)}</span><span style="font-size:12px;color:var(--text-tertiary)">${g.email}</span><span class="user-role">Guest (${g.accessLevel})</span>`;
            content.appendChild(row);
          });
        }
        break;
      case 'workspace':
        content.innerHTML = `<h3>Workspace Settings</h3>
          <div style="margin-top:12px"><label style="font-size:13px;color:var(--text-secondary)">Workspace Name</label><input type="text" id="admin-ws-name" value="${esc(state.workspace.name)}" style="display:block;margin-top:4px;padding:6px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);width:300px;font-size:14px"></div>`;
        content.querySelector('#admin-ws-name')?.addEventListener('change', (e) => { state.workspace.name = e.target.value; saveState(); showToast('Workspace updated'); });
        break;
      case 'security':
        content.innerHTML = '<h3>Security</h3><p style="color:var(--text-secondary);font-size:13px;margin-top:8px">Two-factor authentication, session management, and audit logs would appear here in a production app.</p>';
        break;
      case 'billing':
        content.innerHTML = '<h3>Billing</h3><p style="color:var(--text-secondary);font-size:13px;margin-top:8px">Subscription plan, payment methods, and invoices would appear here in a production app.</p>';
        break;
    }
  }

  // ── Render: Project Overview ──
  function renderOverview(projectId) {
    const el = $('#project-overview-content'); if (!el) return;
    el.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId); if (!project) return;
    const tasks = state.tasks.filter(t => taskInProject(t, projectId));
    const completed = tasks.filter(t => t.completed).length;
    const pct = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    const milestones = tasks.filter(t => t.isMilestone);

    el.innerHTML = `
      <div class="overview-section">
        <h3>Project Description</h3>
        <div class="overview-description" contenteditable="true">${esc(project.description || 'Add a description...')}</div>
        <h3 style="margin-top:20px">Key Resources</h3>
        <div class="overview-resources">
          <div class="overview-resource"><span class="overview-resource-icon" style="background:${project.color}22;color:${project.color}">&#x1F4CB;</span>Project Brief</div>
          <div class="overview-resource"><span class="overview-resource-icon" style="background:#4573d222;color:#4573d2">&#x1F517;</span>Design Files</div>
        </div>
        ${milestones.length ? `<h3 style="margin-top:20px">Milestones</h3><div class="overview-milestones">${milestones.map(m => `<div class="overview-milestone-item"><div class="overview-milestone-icon${m.completed ? ' complete' : ''}">◆</div><span>${esc(m.name)}</span>${m.dueDate ? `<span class="task-due" style="margin-left:auto">${formatDate(m.dueDate)}</span>` : ''}</div>`).join('')}</div>` : ''}
      </div>
      <div class="overview-sidebar-section">
        <h4>Status</h4>
        <canvas id="overview-donut" width="160" height="160"></canvas>
        <div style="text-align:center;margin-top:8px;font-size:13px;color:var(--text-secondary)">${pct}% complete (${completed}/${tasks.length})</div>
        <h4 style="margin-top:16px">Details</h4>
        <div class="overview-field-row"><span class="field-label-text">Created</span><span class="field-value-text">${new Date(project.createdAt).toLocaleDateString()}</span></div>
        <div class="overview-field-row"><span class="field-label-text">Members</span><span class="field-value-text">${project.members.length}</span></div>
        <div class="overview-field-row"><span class="field-label-text">Privacy</span><span class="field-value-text">${project.privacy}</span></div>
      </div>
    `;

    el.querySelector('.overview-description').onblur = function () {
      project.description = this.textContent.trim(); saveState();
    };

    // Donut chart
    const canvas = $('#overview-donut');
    if (canvas) drawDonutChart(canvas, [{ value: completed, color: '#62d26f' }, { value: tasks.length - completed, color: 'var(--border-color)' }]);
  }

  // ── Render: Dashboard Charts ──
  function renderDashboard(projectId) {
    const el = $('#project-dashboard-content'); if (!el) return;
    el.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId); if (!project) return;
    const tasks = state.tasks.filter(t => taskInProject(t, projectId));

    // Card 1: Tasks by section
    const card1 = document.createElement('div'); card1.className = 'dashboard-card';
    card1.innerHTML = '<div class="dashboard-card-header">Tasks by Section</div><div class="dashboard-card-body"><canvas id="chart-by-section" width="300" height="200"></canvas></div>';
    el.appendChild(card1);

    // Card 2: Completion donut
    const card2 = document.createElement('div'); card2.className = 'dashboard-card';
    card2.innerHTML = '<div class="dashboard-card-header">Completion Rate</div><div class="dashboard-card-body"><canvas id="chart-completion" width="200" height="200"></canvas></div>';
    el.appendChild(card2);

    // Card 3: By assignee
    const card3 = document.createElement('div'); card3.className = 'dashboard-card';
    card3.innerHTML = '<div class="dashboard-card-header">Tasks by Assignee</div><div class="dashboard-card-body"><canvas id="chart-by-assignee" width="300" height="200"></canvas></div>';
    el.appendChild(card3);

    // Card 4: Upcoming
    const card4 = document.createElement('div'); card4.className = 'dashboard-card';
    const upcoming = tasks.filter(t => !t.completed && t.dueDate && !isOverdue(t.dueDate)).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5);
    card4.innerHTML = `<div class="dashboard-card-header">Upcoming Deadlines</div><div class="dashboard-card-body" style="flex-direction:column;align-items:stretch">${upcoming.map(t => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>${esc(t.name)}</span><span style="color:var(--text-tertiary)">${formatDate(t.dueDate)}</span></div>`).join('') || '<span style="color:var(--text-tertiary);font-size:12px">No upcoming deadlines</span>'}</div>`;
    el.appendChild(card4);

    // Draw charts after DOM insertion
    requestAnimationFrame(() => {
      const bySection = project.sections.map(s => ({
        label: s.name, value: tasks.filter(t => t.sectionId === s.id).length, color: project.color
      }));
      const c1 = $('#chart-by-section');
      if (c1) drawBarChart(c1, bySection);

      const completed = tasks.filter(t => t.completed).length;
      const c2 = $('#chart-completion');
      if (c2) drawDonutChart(c2, [{ value: completed, color: '#62d26f' }, { value: tasks.length - completed, color: '#e8e8e8' }]);

      const byAssignee = state.users.map(u => ({
        label: u.initials, value: tasks.filter(t => t.assignee === u.id).length, color: u.color
      }));
      const c3 = $('#chart-by-assignee');
      if (c3) drawBarChart(c3, byAssignee);
    });
  }

  // ── Canvas Charts ──
  function drawBarChart(canvas, data) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...data.map(d => d.value));
    const barW = Math.floor(w / (data.length * 2 + 1));
    const pad = barW;
    data.forEach((d, i) => {
      const x = pad + i * (barW + pad);
      const barH = (d.value / max) * (h - 40);
      ctx.fillStyle = d.color || '#4573d2';
      ctx.fillRect(x, h - 20 - barH, barW, barH);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#6d6e6f';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 4);
      ctx.fillText(d.value, x + barW / 2, h - 24 - barH);
    });
  }

  function drawDonutChart(canvas, data) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 10, innerR = r * 0.6;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let angle = -Math.PI / 2;
    data.forEach(d => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle, angle + sliceAngle);
      ctx.arc(cx, cy, innerR, angle + sliceAngle, angle, true);
      ctx.closePath();
      ctx.fillStyle = d.color; ctx.fill();
      angle += sliceAngle;
    });
  }

  // ── Render: Messages ──
  function renderMessages(projectId) {
    const el = $('#project-messages-content'); if (!el) return;
    el.innerHTML = '';
    const projectMsgs = state.messages.filter(m => m.projectId === projectId);
    const list = document.createElement('div'); list.className = 'messages-list';
    if (!projectMsgs.length) {
      list.innerHTML = '<p style="padding:20px;color:var(--text-tertiary);font-size:13px;text-align:center">No messages yet. Start a discussion!</p>';
    }
    projectMsgs.forEach(m => {
      const user = state.users.find(u => u.id === m.userId) || state.users[0];
      const thread = document.createElement('div'); thread.className = 'message-thread';
      thread.innerHTML = `
        <div class="message-bubble">
          <div class="task-assignee-avatar" style="background:${user.color};color:#fff;width:32px;height:32px;font-size:12px;flex-shrink:0">${user.initials}</div>
          <div class="message-bubble-content">
            <span class="message-author">${esc(user.name)}<span class="message-time">${timeAgo(m.createdAt)}</span></span>
            <div class="message-text">${esc(m.text)}</div>
          </div>
        </div>
      `;
      list.appendChild(thread);
    });
    el.appendChild(list);

    const composer = document.createElement('div'); composer.className = 'message-composer';
    composer.innerHTML = `<input type="text" id="msg-input" placeholder="Write a message..." style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-size:13px"><button class="btn-primary" id="msg-send">Send</button>`;
    el.appendChild(composer);
    const sendBtn = $('#msg-send');
    if (sendBtn) sendBtn.onclick = () => {
      const input = $('#msg-input'); if (!input) return;
      const text = input.value.trim(); if (!text) return;
      state.messages.push({ id: genId(), projectId, userId: 'u1', text, createdAt: Date.now(), replies: [] });
      input.value = '';
      saveState(); renderMessages(projectId);
    };
  }

  // ── Render: Forms ──
  function renderFormBuilder(projectId) {
    const el = $('#project-forms-content'); if (!el) return;
    el.innerHTML = '';
    const projectForms = state.forms.filter(f => f.projectId === projectId);

    if (!projectForms.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px"><p style="color:var(--text-tertiary)">No forms yet</p><button class="btn-primary" id="create-form-btn">+ Create Form</button></div>`;
      const btn = $('#create-form-btn');
      if (btn) btn.onclick = () => {
        const name = prompt('Form name:');
        if (name) {
          state.forms.push({ id: genId(), projectId, name, fields: [
            { id: genId(), label: 'Name', type: 'text', required: true },
            { id: genId(), label: 'Description', type: 'textarea', required: false },
          ], submissions: [] });
          saveState(); renderFormBuilder(projectId);
        }
      };
      return;
    }

    projectForms.forEach(form => {
      const section = document.createElement('div');
      section.innerHTML = `<h3>${esc(form.name)}</h3><div class="form-fields-list">${form.fields.map(f => `<div class="form-field-row"><span class="field-drag">☰</span><span class="field-label">${esc(f.label)}</span><span class="field-type">${f.type}${f.required ? ' *' : ''}</span></div>`).join('')}</div>
        <div class="form-add-field-btn" data-form-id="${form.id}">+ Add Field</div>
        <div class="form-submissions-header">${form.submissions.length} submission${form.submissions.length !== 1 ? 's' : ''}</div>
        ${form.submissions.map(s => `<div class="form-submission-row">${Object.entries(s.data || {}).map(([k,v]) => `<span><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`).join(' · ')}</div>`).join('')}`;
      el.appendChild(section);
    });

    $$('.form-add-field-btn').forEach(btn => {
      btn.onclick = () => {
        const formId = btn.dataset.formId;
        const form = state.forms.find(f => f.id === formId);
        if (!form) return;
        const label = prompt('Field label:');
        if (label) {
          form.fields.push({ id: genId(), label, type: 'text', required: false });
          saveState(); renderFormBuilder(projectId);
        }
      };
    });
  }

  // ── Render: Project ──
  function renderProject(projectId) {
    const project = state.projects.find(p => p.id === projectId); if (!project) return;
    const nameEl = $('#project-name'); if (nameEl) nameEl.textContent = project.name;
    const iconEl = $('#project-icon'); if (iconEl) { iconEl.style.background = project.color; iconEl.textContent = project.name[0]?.toUpperCase() || 'P'; }
    const star = $('#project-star');
    if (star) { star.textContent = project.starred ? '★' : '☆'; star.className = `star-btn${project.starred ? ' starred' : ''}`; }

    // Hide all project sub-views
    ['project-overview-content','project-messages-content','project-dashboard-content','project-forms-content','project-tasks-sections','board-view','calendar-view'].forEach(id => {
      const el = $(`#${id}`); if (el) el.classList.add('hidden');
    });

    const tab = state.currentProjectTab || 'list';
    switch (tab) {
      case 'overview': renderOverview(projectId); { const el = $('#project-overview-content'); if (el) el.classList.remove('hidden'); } break;
      case 'list': renderProjectList(projectId); break;
      case 'board': renderBoardView(projectId); { const el = $('#board-view'); if (el) el.classList.remove('hidden'); } break;
      case 'timeline': renderTimeline(projectId); break;
      case 'calendar': renderCalendarView(); { const el = $('#calendar-view'); if (el) el.classList.remove('hidden'); } break;
      case 'workflow': renderWorkflow(projectId); break;
      case 'dashboard': renderDashboard(projectId); { const el = $('#project-dashboard-content'); if (el) el.classList.remove('hidden'); } break;
      case 'messages': renderMessages(projectId); { const el = $('#project-messages-content'); if (el) el.classList.remove('hidden'); } break;
      case 'forms': renderFormBuilder(projectId); { const el = $('#project-forms-content'); if (el) el.classList.remove('hidden'); } break;
      default: renderProjectList(projectId); break;
    }
  }

  function renderProjectList(projectId) {
    const project = state.projects.find(p => p.id === projectId); if (!project) return;
    const sections = $('#project-tasks-sections'); if (!sections) return;
    sections.innerHTML = ''; sections.classList.remove('hidden');

    // Custom field headers
    const projectFields = state.customFields.filter(f => f.projectId === projectId);

    project.sections.forEach(sec => {
      const tasks = state.tasks.filter(t => taskInProject(t, projectId) && t.sectionId === sec.id);
      const secEl = document.createElement('div'); secEl.className = 'task-section'; secEl.dataset.sectionId = sec.id;
      const header = document.createElement('div'); header.className = 'section-header';
      header.innerHTML = `<button class="section-collapse">&#x25BE;</button><span class="section-name" contenteditable="true">${esc(sec.name)}</span><button class="section-add-task">+ Add task</button>`;
      header.querySelector('.section-collapse').onclick = function () { this.classList.toggle('collapsed'); taskList.classList.toggle('hidden'); };
      header.querySelector('.section-name').onblur = function () { sec.name = this.textContent.trim() || sec.name; saveState(); renderSidebar(); };
      header.querySelector('.section-add-task').onclick = () => { const task = createTask({ name: 'New Task', projectId, sectionId: sec.id }); renderCurrentView(); openTaskDetail(task.id); };

      const taskList = document.createElement('div'); taskList.className = 'task-list';
      taskList.ondragover = (e) => { e.preventDefault(); };
      taskList.ondrop = (e) => { e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const task = state.tasks.find(t => t.id === taskId);
        if (task) { task.sectionId = sec.id; if (!taskInProject(task, projectId)) { task.projectIds = task.projectIds || []; task.projectIds.push(projectId); } executeRules('task-moved', task); saveState(); renderCurrentView(); }
      };
      tasks.forEach(t => taskList.appendChild(renderTaskRow(t)));
      secEl.appendChild(header); secEl.appendChild(taskList);
      sections.appendChild(secEl);
    });
  }

  // ── Render: Inbox ──
  function renderInbox() {
    const list = $('#inbox-list'); if (!list) return;
    list.innerHTML = '';
    if (!state.inbox.length) { list.classList.add('hidden'); const empty = $('#inbox-empty'); if (empty) empty.classList.remove('hidden'); return; }
    list.classList.remove('hidden'); const empty = $('#inbox-empty'); if (empty) empty.classList.add('hidden');
    state.inbox.forEach(item => {
      const el = document.createElement('div');
      el.className = `inbox-item${item.read ? '' : ' unread'}`;
      const sender = state.users.find(u => u.id === item.senderId) || state.users[0];
      el.innerHTML = `<div class="inbox-avatar" style="background:${sender.color};color:#fff">${sender.initials}</div><div class="inbox-body"><div class="inbox-sender">${esc(sender.name)}</div><div class="inbox-subject">${esc(item.message)}</div></div><span class="inbox-time">${timeAgo(item.createdAt)}</span>`;
      el.onclick = () => { item.read = true; saveState(); renderInbox(); updateBadges(); };
      list.appendChild(el);
    });
  }

  // ── Render: Reporting ──
  function renderReporting() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pct = total ? Math.round(completed / total * 100) : 0;
    const cc = $('#chart-completed'); if (cc) cc.innerHTML = `<div style="text-align:center"><div style="font-size:36px;font-weight:700;color:var(--accent)">${completed}</div><div style="font-size:12px;color:var(--text-secondary)">${pct}% of ${total}</div><div style="margin-top:8px;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--success);border-radius:4px"></div></div></div>`;
    const sc = $('#chart-status'); if (sc) {
      const statuses = { 'To Do': state.tasks.filter(t => !t.completed && !t.sectionId).length, 'In Progress': state.tasks.filter(t => !t.completed && t.sectionId).length, 'Done': completed };
      sc.innerHTML = Object.entries(statuses).map(([k,v]) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="flex:1;font-size:12px">${k}</div><div style="font-weight:600">${v}</div></div>`).join('');
    }
    const dc = $('#chart-deadlines'); if (dc) {
      const upcoming = state.tasks.filter(t => !t.completed && t.dueDate && !isOverdue(t.dueDate)).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5);
      dc.innerHTML = upcoming.length ? upcoming.map(t => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px"><span>${esc(t.name)}</span><span style="margin-left:auto;color:var(--text-tertiary)">${formatDate(t.dueDate)}</span></div>`).join('') : '<span style="font-size:12px;color:var(--text-tertiary)">No upcoming deadlines</span>';
    }
  }

  function renderGoals() {
    const list = $('#goals-list'); if (!list) return;
    list.innerHTML = '';
    if (!state.goals.length) { list.innerHTML = '<div class="empty-state"><p>No goals yet</p></div>'; return; }
    state.goals.forEach(g => {
      const el = document.createElement('div'); el.className = 'goal-item';
      const owner = state.users.find(u => u.id === g.owner);
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><span class="status-dot ${g.status.replace(' ','-')}"></span><strong>${esc(g.name)}</strong>${g.dueDate ? `<span class="task-due" style="margin-left:auto">${formatDate(g.dueDate)}</span>` : ''}</div><div class="goal-progress"><div class="goal-progress-bar" style="width:${g.progress}%"></div></div><div style="display:flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;color:var(--text-tertiary)">${owner ? `<div class="task-assignee-avatar" style="background:${owner.color};color:#fff;width:18px;height:18px;font-size:9px">${owner.initials}</div>` : ''}<span>${g.progress}%</span></div>`;
      list.appendChild(el);
    });
  }

  function renderPortfolios() {
    const list = $('#portfolio-list'); if (!list) return;
    list.innerHTML = '';
    if (!state.portfolios.length) { list.innerHTML = '<div class="empty-state"><p>No portfolios yet</p></div>'; return; }
    state.portfolios.forEach(p => { const el = document.createElement('div'); el.className = 'portfolio-card'; el.innerHTML = `<strong>${esc(p.name)}</strong><span style="margin-left:auto;color:var(--text-tertiary)">${p.projects?.length || 0} projects</span>`; list.appendChild(el); });
  }

  function renderStatusUpdates() {
    const list = $('#status-updates-list'); if (!list) return;
    list.innerHTML = '';
    if (!state.statusUpdates.length) { list.innerHTML = '<div class="empty-state"><p>No status updates</p></div>'; return; }
    state.statusUpdates.forEach(s => {
      const el = document.createElement('div'); el.className = 'status-item';
      el.innerHTML = `<div class="status-header"><span class="status-dot ${s.status}"></span><strong>${esc(s.title)}</strong><span style="margin-left:auto;font-size:11px;color:var(--text-tertiary)">${timeAgo(s.createdAt)}</span></div><p style="font-size:13px;color:var(--text-secondary)">${esc(s.text)}</p>`;
      list.appendChild(el);
    });
  }

  // ── Task Detail Panel ──
  function openTaskDetail(taskId) {
    const task = state.tasks.find(t => t.id === taskId); if (!task) return;
    state.selectedTask = task;
    const panel = $('#task-detail-panel'); if (panel) panel.classList.remove('hidden');

    const nameEl = $('#task-detail-name');
    if (nameEl) { nameEl.textContent = task.name; nameEl.onblur = () => { task.name = nameEl.textContent.trim() || task.name; saveState(); renderCurrentView(); }; }

    const completeBtn = $('#task-mark-complete');
    if (completeBtn) { completeBtn.className = `complete-btn${task.completed ? ' completed' : ''}`; completeBtn.onclick = () => { completeTask(task.id); completeBtn.className = `complete-btn${task.completed ? ' completed' : ''}`; renderCurrentView(); }; }

    // Assignee
    const assignee = state.users.find(u => u.id === task.assignee);
    const aEl = $('#task-assignee'); if (aEl) { aEl.textContent = assignee ? assignee.name : 'Unassigned'; aEl.onclick = () => showPickerMenu(aEl, [{ id: null, name: 'Unassigned' }, ...state.users], (u) => { task.assignee = u.id; executeRules('task-assigned', task); saveState(); openTaskDetail(task.id); renderCurrentView(); }); }

    // Due date
    const ddEl = $('#task-due-date'); if (ddEl) { ddEl.value = task.dueDate || ''; ddEl.onchange = () => { task.dueDate = ddEl.value || null; saveState(); renderCurrentView(); }; }

    // Priority
    const prEl = $('#task-priority'); if (prEl) { prEl.value = task.priority || ''; prEl.onchange = () => { task.priority = prEl.value || null; saveState(); renderCurrentView(); }; }

    // Projects (multi-homing)
    const projEl = $('#task-projects');
    if (projEl) {
      const pNames = (task.projectIds || []).map(pid => state.projects.find(p => p.id === pid)?.name).filter(Boolean);
      projEl.textContent = pNames.length ? pNames.join(', ') : 'None';
      projEl.onclick = () => showPickerMenu(projEl, [{ id: null, name: '(Remove all)' }, ...state.projects], (p) => {
        if (!p.id) { task.projectIds = []; } else if (task.projectIds.includes(p.id)) { task.projectIds = task.projectIds.filter(x => x !== p.id); }
        else { task.projectIds.push(p.id); }
        saveState(); openTaskDetail(task.id); renderCurrentView();
      });
    }

    // Tags
    const tagsEl = $('#task-tags'); if (tagsEl) tagsEl.textContent = task.tags.length ? task.tags.join(', ') : 'Add tags';

    // Description
    const descEl = $('#task-description'); if (descEl) { descEl.innerHTML = task.description || ''; descEl.onblur = () => { task.description = descEl.innerHTML; saveState(); }; }

    // Subtasks
    renderSubtasks(task);
    // Comments
    renderActivity(task);

    // Custom fields
    renderTaskCustomFields(task);
    // Dependencies
    renderDependencies(task);
    // Time tracking
    renderTimeTracking(task);
    // Attachments
    renderAttachments(task);

    // Approval controls
    const approvalEl = $('#task-approval-controls');
    if (approvalEl) {
      approvalEl.classList.toggle('hidden', !task.isApproval);
      const approveBtn = $('#task-approve');
      const rejectBtn = $('#task-reject');
      if (approveBtn) approveBtn.onclick = () => { task.approvalStatus = 'approved'; task.completed = true; task.completedAt = Date.now(); saveState(); openTaskDetail(task.id); renderCurrentView(); showToast('Approved'); };
      if (rejectBtn) rejectBtn.onclick = () => { task.approvalStatus = 'rejected'; saveState(); openTaskDetail(task.id); renderCurrentView(); showToast('Rejected'); };
    }

    // Milestone badge
    const mBadge = $('#task-milestone-badge'); if (mBadge) mBadge.classList.toggle('hidden', !task.isMilestone);

    // Recurrence badge
    const rBadge = $('#task-recurrence-badge'); if (rBadge) { rBadge.classList.toggle('hidden', !task.recurrence); const rText = $('#recurrence-text'); if (rText && task.recurrence) rText.textContent = `${task.recurrence.pattern} (every ${task.recurrence.interval || 1})`; }

    // Like
    const likeEl = $('#task-like'); if (likeEl) { likeEl.textContent = task.liked ? '\u{1F44D}\u{FE0F}' : '\u{1F44D}'; likeEl.onclick = () => { task.liked = !task.liked; task.likes += task.liked ? 1 : -1; saveState(); openTaskDetail(task.id); }; }

    // Copy link
    const copyEl = $('#task-copy-link'); if (copyEl) copyEl.onclick = () => { navigator.clipboard?.writeText(`asana-clone://task/${task.id}`); showToast('Link copied'); };

    // More actions
    const moreEl = $('#task-more');
    if (moreEl) moreEl.onclick = (e) => {
      showContextMenu(e, [
        { label: 'Duplicate task', fn: () => { createTask({ ...task, name: task.name + ' (copy)', projectIds: [...task.projectIds] }); renderCurrentView(); } },
        { label: 'Save as template', fn: () => { state.templates.tasks.push({ id: genId(), name: task.name, data: { ...task, id: null } }); saveState(); showToast('Task template saved'); } },
        { label: task.isMilestone ? 'Remove milestone' : 'Mark as milestone', fn: () => { task.isMilestone = !task.isMilestone; saveState(); openTaskDetail(task.id); renderCurrentView(); } },
        { label: task.isApproval ? 'Remove approval' : 'Mark as approval', fn: () => { task.isApproval = !task.isApproval; if (task.isApproval) task.approvalStatus = 'pending'; saveState(); openTaskDetail(task.id); renderCurrentView(); } },
        { label: 'Set recurrence...', fn: () => openModal('recurring-modal') },
        { type: 'separator' },
        { label: 'Delete task', danger: true, fn: () => { deleteTask(task.id); renderCurrentView(); } },
      ]);
    };
  }

  function hideTaskDetail() { const p = $('#task-detail-panel'); if (p) p.classList.add('hidden'); state.selectedTask = null; }

  // ── Task Custom Fields ──
  function renderTaskCustomFields(task) {
    const el = $('#task-custom-fields-section'); if (!el) return;
    el.innerHTML = '';
    const pid = getTaskProjectId(task);
    const fields = state.customFields.filter(f => f.projectId === pid);
    if (!fields.length) return;
    fields.forEach(field => {
      const row = document.createElement('div'); row.className = 'task-fields'; row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
      const label = document.createElement('span'); label.style.cssText = 'font-size:12px;color:var(--text-secondary);width:120px'; label.textContent = field.name;
      row.appendChild(label);
      const val = task.customFieldValues[field.id];
      let input;
      switch (field.type) {
        case 'checkbox':
          input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!val;
          input.onchange = () => { task.customFieldValues[field.id] = input.checked; saveState(); };
          break;
        case 'dropdown':
          input = document.createElement('select');
          input.innerHTML = '<option value="">-</option>' + (field.options || []).map(o => `<option value="${esc(o)}"${val === o ? ' selected' : ''}>${esc(o)}</option>`).join('');
          input.style.cssText = 'padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-size:12px';
          input.onchange = () => { task.customFieldValues[field.id] = input.value; saveState(); };
          break;
        case 'number':
          input = document.createElement('input'); input.type = 'number'; input.value = val || '';
          input.style.cssText = 'width:80px;padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-size:12px';
          input.onchange = () => { task.customFieldValues[field.id] = parseFloat(input.value) || 0; saveState(); };
          break;
        case 'date':
          input = document.createElement('input'); input.type = 'date'; input.value = val || '';
          input.style.cssText = 'padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-size:12px';
          input.onchange = () => { task.customFieldValues[field.id] = input.value; saveState(); };
          break;
        default:
          input = document.createElement('input'); input.type = 'text'; input.value = val || ''; input.placeholder = 'Enter value...';
          input.style.cssText = 'flex:1;padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-size:12px';
          input.onchange = () => { task.customFieldValues[field.id] = input.value; saveState(); };
      }
      row.appendChild(input);
      el.appendChild(row);
    });
  }

  // ── Task Dependencies ──
  function renderDependencies(task) {
    const blockedByEl = $('#task-blocked-by'); if (!blockedByEl) return;
    const blockingEl = $('#task-blocking'); if (!blockingEl) return;
    blockedByEl.innerHTML = ''; blockingEl.innerHTML = '';

    task.blockedBy.forEach(depId => {
      const dep = state.tasks.find(t => t.id === depId);
      if (!dep) return;
      const tag = document.createElement('span'); tag.className = 'dependency-tag-item dep-blocked';
      tag.innerHTML = `${esc(dep.name)} <span class="dep-remove">&times;</span>`;
      tag.querySelector('.dep-remove').onclick = () => { task.blockedBy = task.blockedBy.filter(id => id !== depId); dep.blocking = dep.blocking.filter(id => id !== task.id); saveState(); renderDependencies(task); };
      blockedByEl.appendChild(tag);
    });

    task.blocking.forEach(depId => {
      const dep = state.tasks.find(t => t.id === depId);
      if (!dep) return;
      const tag = document.createElement('span'); tag.className = 'dependency-tag-item dep-blocking';
      tag.innerHTML = `${esc(dep.name)} <span class="dep-remove">&times;</span>`;
      tag.querySelector('.dep-remove').onclick = () => { task.blocking = task.blocking.filter(id => id !== depId); dep.blockedBy = dep.blockedBy.filter(id => id !== task.id); saveState(); renderDependencies(task); };
      blockingEl.appendChild(tag);
    });

    const addBlocked = $('#add-blocked-by');
    if (addBlocked) addBlocked.onclick = () => {
      const others = state.tasks.filter(t => t.id !== task.id && !task.blockedBy.includes(t.id));
      showPickerMenu(addBlocked, others, (dep) => {
        task.blockedBy.push(dep.id); dep.blocking = dep.blocking || []; dep.blocking.push(task.id);
        saveState(); renderDependencies(task);
      });
    };
    const addBlocking = $('#add-blocking');
    if (addBlocking) addBlocking.onclick = () => {
      const others = state.tasks.filter(t => t.id !== task.id && !task.blocking.includes(t.id));
      showPickerMenu(addBlocking, others, (dep) => {
        task.blocking.push(dep.id); dep.blockedBy = dep.blockedBy || []; dep.blockedBy.push(task.id);
        saveState(); renderDependencies(task);
      });
    };
  }

  // ── Time Tracking ──
  function renderTimeTracking(task) {
    const toggleBtn = $('#task-timer-toggle'); if (!toggleBtn) return;
    const display = $('#task-timer-display');
    const totalEl = $('#task-total-time');
    const isRunning = state.activeTimer?.taskId === task.id;
    toggleBtn.textContent = isRunning ? 'Stop' : 'Start Timer';
    toggleBtn.className = isRunning ? 'timer-btn-stop' : 'timer-btn-start';
    if (display) display.textContent = isRunning ? formatDuration(Math.floor((Date.now() - state.activeTimer.startTime) / 1000)) : '0:00:00';
    if (totalEl) totalEl.textContent = `Total: ${Math.round(task.timeTracked / 3600 * 10) / 10}h`;

    toggleBtn.onclick = () => {
      if (isRunning) { stopTimer(); } else { startTimer(task.id); }
      renderTimeTracking(task);
    };

    const logBtn = $('#task-log-time');
    if (logBtn) logBtn.onclick = () => {
      const hours = prompt('Hours to log:', '1');
      if (hours && !isNaN(hours)) {
        task.timeTracked += parseFloat(hours) * 3600;
        state.timeEntries.push({ id: genId(), taskId: task.id, userId: 'u1', start: Date.now(), end: Date.now(), duration: parseFloat(hours) * 3600 });
        saveState(); renderTimeTracking(task);
        showToast(`${hours}h logged`);
      }
    };
  }

  function startTimer(taskId) {
    if (state.activeTimer) stopTimer();
    state.activeTimer = { taskId, startTime: Date.now() };
    const topbarTimer = $('#topbar-timer'); if (topbarTimer) topbarTimer.classList.remove('hidden');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const display = $('#task-timer-display');
      if (display && state.activeTimer) display.textContent = formatDuration(Math.floor((Date.now() - state.activeTimer.startTime) / 1000));
    }, 1000);
  }

  function stopTimer() {
    if (!state.activeTimer) return;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const duration = Math.floor((Date.now() - state.activeTimer.startTime) / 1000);
    const task = state.tasks.find(t => t.id === state.activeTimer.taskId);
    if (task) {
      task.timeTracked += duration;
      state.timeEntries.push({ id: genId(), taskId: task.id, userId: 'u1', start: state.activeTimer.startTime, end: Date.now(), duration });
    }
    state.activeTimer = null;
    const topbarTimer = $('#topbar-timer'); if (topbarTimer) topbarTimer.classList.add('hidden');
    saveState();
  }

  // ── Attachments ──
  function renderAttachments(task) {
    const list = $('#task-attachments-list'); if (!list) return;
    list.innerHTML = '';
    (task.attachments || []).forEach(a => {
      const item = document.createElement('div'); item.className = 'attachment-item';
      const iconMap = { pdf: '\u{1F4C4}', image: '\u{1F5BC}', doc: '\u{1F4DD}' };
      const icon = a.type?.startsWith('image') ? iconMap.image : a.type?.includes('pdf') ? iconMap.pdf : iconMap.doc;
      item.innerHTML = `<div class="attachment-icon">${icon}</div><span class="attachment-name">${esc(a.name)}</span><span class="attachment-size">${a.size ? Math.round(a.size/1024)+'KB' : ''}</span><span class="attachment-remove">&times;</span>`;
      item.querySelector('.attachment-remove').onclick = () => { task.attachments = task.attachments.filter(x => x.id !== a.id); saveState(); renderAttachments(task); };
      list.appendChild(item);
    });

    const attachBtn = $('#task-attach-file');
    if (attachBtn) attachBtn.onclick = () => {
      if (window.electronInjectedApi?.openFileAttachment) {
        window.electronInjectedApi.openFileAttachment().then(files => {
          if (files) files.forEach(f => task.attachments.push({ id: genId(), name: f.name, size: f.size, type: f.type || 'file', createdAt: Date.now() }));
          saveState(); renderAttachments(task);
        });
      } else {
        const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
        input.onchange = () => {
          Array.from(input.files).forEach(f => task.attachments.push({ id: genId(), name: f.name, size: f.size, type: f.type, createdAt: Date.now() }));
          saveState(); renderAttachments(task);
        };
        input.click();
      }
    };
  }

  function renderSubtasks(task) {
    const list = $('#task-subtasks-list'); if (!list) return;
    list.innerHTML = '';
    task.subtasks.forEach(st => {
      const row = document.createElement('div'); row.className = 'subtask-row';
      const cb = document.createElement('div'); cb.className = `task-checkbox${st.completed ? ' checked' : ''}`; cb.textContent = st.completed ? '✓' : '';
      cb.onclick = () => { st.completed = !st.completed; saveState(); renderSubtasks(task); };
      const name = document.createElement('span'); name.className = 'task-name'; name.contentEditable = true; name.textContent = st.name;
      name.style.textDecoration = st.completed ? 'line-through' : 'none';
      name.onblur = () => { st.name = name.textContent.trim() || st.name; saveState(); };
      row.appendChild(cb); row.appendChild(name);
      list.appendChild(row);
    });
    const addBtn = $('#add-subtask-btn');
    if (addBtn) addBtn.onclick = () => { task.subtasks.push({ id: genId(), name: 'New subtask', completed: false }); saveState(); renderSubtasks(task); const last = list.lastElementChild?.querySelector('.task-name'); if (last) { last.focus(); selectAll(last); } };
  }

  function renderActivity(task) {
    const list = $('#task-activity-list'); if (!list) return;
    list.innerHTML = '';
    task.comments.forEach(c => {
      const user = state.users.find(u => u.id === c.userId) || state.users[0];
      const el = document.createElement('div'); el.className = 'activity-item';
      el.innerHTML = `<div class="activity-avatar" style="background:${user.color};color:#fff">${user.initials}</div><div class="activity-content"><span class="activity-author">${esc(user.name)}<span class="activity-time">${timeAgo(c.createdAt)}</span></span><div class="activity-text">${esc(c.text)}</div></div>`;
      list.appendChild(el);
    });
    const sendBtn = $('#send-comment');
    if (sendBtn) sendBtn.onclick = () => {
      const editor = $('#comment-editor'); if (!editor) return;
      const text = editor.textContent.trim(); if (!text) return;
      task.comments.push({ id: genId(), userId: 'u1', text, createdAt: Date.now() });
      editor.textContent = ''; saveState(); renderActivity(task);
    };
  }

  // ── Batch Operations ──
  function toggleBatchSelect(taskId) {
    if (state.batchSelected.includes(taskId)) { state.batchSelected = state.batchSelected.filter(id => id !== taskId); }
    else { state.batchSelected.push(taskId); }
    updateBatchToolbar();
  }

  function updateBatchToolbar() {
    const toolbar = $('#batch-toolbar'); if (!toolbar) return;
    const count = state.batchSelected.length;
    toolbar.classList.toggle('hidden', count === 0);
    const countEl = $('#batch-count-num'); if (countEl) countEl.textContent = count;
  }

  function initBatchOps() {
    const actions = {
      'batch-complete': () => { state.batchSelected.forEach(id => { const t = state.tasks.find(x => x.id === id); if (t && !t.completed) { t.completed = true; t.completedAt = Date.now(); } }); },
      'batch-delete': () => { if (confirm(`Delete ${state.batchSelected.length} tasks?`)) state.tasks = state.tasks.filter(t => !state.batchSelected.includes(t.id)); },
      'batch-cancel': () => {},
    };
    Object.entries(actions).forEach(([id, fn]) => {
      const el = $(`#${id}`); if (el) el.onclick = () => { fn(); state.batchSelected = []; saveState(); renderCurrentView(); updateBatchToolbar(); };
    });
    const assignBtn = $('#batch-assign');
    if (assignBtn) assignBtn.onclick = () => {
      showPickerMenu(assignBtn, state.users, (u) => {
        state.batchSelected.forEach(id => { const t = state.tasks.find(x => x.id === id); if (t) t.assignee = u.id; });
        state.batchSelected = []; saveState(); renderCurrentView(); updateBatchToolbar();
      });
    };
    const dateBtn = $('#batch-date');
    if (dateBtn) dateBtn.onclick = () => {
      const date = prompt('Due date (YYYY-MM-DD):');
      if (date) { state.batchSelected.forEach(id => { const t = state.tasks.find(x => x.id === id); if (t) t.dueDate = date; }); state.batchSelected = []; saveState(); renderCurrentView(); updateBatchToolbar(); }
    };
    const moveBtn = $('#batch-move');
    if (moveBtn) moveBtn.onclick = () => {
      showPickerMenu(moveBtn, state.projects, (p) => {
        state.batchSelected.forEach(id => { const t = state.tasks.find(x => x.id === id); if (t) { t.projectIds = [p.id]; t.sectionId = p.sections?.[0]?.id || null; } });
        state.batchSelected = []; saveState(); renderCurrentView(); updateBatchToolbar();
      });
    };
  }

  // ── View Navigation ──
  function switchView(viewName) {
    state.currentView = viewName;
    $$('.view').forEach(v => v.classList.remove('active'));
    const viewEl = $(`#view-${viewName}`);
    if (viewEl) viewEl.classList.add('active');
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = $(`.nav-item[data-view="${viewName}"]`);
    if (navItem) navItem.classList.add('active');
    hideTaskDetail();
    renderCurrentView();
    updateBreadcrumb();
  }

  function renderCurrentView() {
    switch (state.currentView) {
      case 'home': renderHome(); break;
      case 'my-tasks': renderMyTasks(); break;
      case 'inbox': renderInbox(); break;
      case 'project': renderProject(state.currentProject); break;
      case 'reporting': renderReporting(); break;
      case 'portfolios': renderPortfolios(); break;
      case 'goals': renderGoals(); break;
      case 'status-updates': renderStatusUpdates(); break;
      case 'timeline': if (state.currentProject) renderTimeline(state.currentProject); break;
      case 'workflow': if (state.currentProject) renderWorkflow(state.currentProject); break;
      case 'workload': renderWorkload(); break;
      case 'admin': renderAdmin(); break;
    }
  }

  function openProject(projectId) {
    state.currentProject = projectId;
    state.currentView = 'project';
    state.currentProjectTab = 'list';
    $$('.view').forEach(v => v.classList.remove('active'));
    const ve = $('#view-project'); if (ve) ve.classList.add('active');
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    renderProject(projectId);
    updateBreadcrumb();
  }

  function updateBreadcrumb() {
    const bc = $('#breadcrumb'); if (!bc) return;
    if (state.currentView === 'project' && state.currentProject) {
      const p = state.projects.find(pr => pr.id === state.currentProject);
      bc.textContent = p ? p.name : '';
    } else {
      const names = { home:'Home', 'my-tasks':'My Tasks', inbox:'Inbox', reporting:'Reporting', portfolios:'Portfolios', goals:'Goals', 'status-updates':'Status Updates', workload:'Workload', admin:'Admin', timeline:'Timeline', workflow:'Workflow' };
      bc.textContent = names[state.currentView] || '';
    }
  }

  function updateBadges() {
    const unread = state.inbox.filter(i => !i.read).length;
    const badge = $('#notification-badge');
    const inboxBadge = $('#inbox-badge');
    if (badge) { badge.classList.toggle('hidden', unread === 0); badge.textContent = unread; }
    if (inboxBadge) { inboxBadge.classList.toggle('hidden', unread === 0); inboxBadge.textContent = unread; }
  }

  // ── Tabs (Electron) ──
  function renderTabs(tabsData) {
    const container = $('#tabs-container'); if (!container) return;
    container.innerHTML = '';
    tabsData.forEach(tab => {
      const el = document.createElement('div'); el.className = `tab${tab.active ? ' active' : ''}`;
      el.innerHTML = `<span class="tab-title">${esc(tab.title)}</span><button class="tab-close" data-tab-id="${tab.id}">&times;</button>`;
      el.onclick = () => window.electronInjectedApi?.switchToTab(tab.id);
      el.querySelector('.tab-close').onclick = (e) => { e.stopPropagation(); window.electronInjectedApi?.closeTab(tab.id); };
      container.appendChild(el);
    });
  }

  // ── Theme ──
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const tb = $('#topbar'); if (tb) tb.style.background = state.topbarColor;
    const sb = $('#sidebar'); if (sb) sb.style.background = state.sidebarColor;
  }

  // ── Modals ──
  function openModal(id) { const m = $(`#${id}`); if (m) m.classList.remove('hidden'); }
  function closeModal(id) { const m = $(`#${id}`); if (m) m.classList.add('hidden'); }

  function initModals() {
    $$('.modal-close').forEach(btn => { btn.onclick = () => btn.closest('.modal')?.classList.add('hidden'); });
    $$('.modal-overlay').forEach(overlay => { overlay.onclick = () => overlay.closest('.modal')?.classList.add('hidden'); });
  }

  // ── Helper: Picker Menu ──
  function showPickerMenu(anchor, items, onSelect) {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;background:var(--bg-modal);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:9999;padding:4px;min-width:160px;max-height:240px;overflow-y:auto';
    const rect = anchor.getBoundingClientRect();
    menu.style.left = rect.left + 'px'; menu.style.top = rect.bottom + 4 + 'px';
    items.forEach(item => {
      const opt = document.createElement('div');
      opt.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;border-radius:var(--radius-sm)';
      opt.textContent = item.name;
      opt.onmouseenter = () => opt.style.background = 'var(--bg-hover)';
      opt.onmouseleave = () => opt.style.background = '';
      opt.onclick = () => { menu.remove(); onSelect(item); };
      menu.appendChild(opt);
    });
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function showContextMenu(e, actions) {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;background:var(--bg-modal);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:9999;padding:4px;min-width:160px';
    menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
    actions.forEach(a => {
      if (a.type === 'separator') { const hr = document.createElement('hr'); hr.style.cssText = 'border:none;border-top:1px solid var(--border-color);margin:4px 0'; menu.appendChild(hr); return; }
      const opt = document.createElement('div');
      opt.style.cssText = `padding:6px 12px;cursor:pointer;font-size:13px;border-radius:var(--radius-sm);${a.danger ? 'color:var(--danger)' : ''}`;
      opt.textContent = a.label;
      opt.onmouseenter = () => opt.style.background = 'var(--bg-hover)';
      opt.onmouseleave = () => opt.style.background = '';
      opt.onclick = () => { menu.remove(); a.fn(); };
      menu.appendChild(opt);
    });
    document.body.appendChild(menu);
    const close = (e2) => { if (!menu.contains(e2.target)) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  // ── Rich Text ──
  function initRichText() {
    $$('.rich-toolbar').forEach(toolbar => {
      toolbar.querySelectorAll('.rich-btn').forEach(btn => {
        btn.onmousedown = (e) => e.preventDefault();
        btn.onclick = () => {
          const cmd = btn.dataset.cmd;
          const val = btn.dataset.val || null;
          document.execCommand(cmd, false, val);
          toolbar.querySelectorAll('.rich-btn').forEach(b => {
            if (b.dataset.cmd && !['formatBlock','insertUnorderedList','insertOrderedList'].includes(b.dataset.cmd)) {
              b.classList.toggle('active', document.queryCommandState(b.dataset.cmd));
            }
          });
        };
      });
    });
  }

  // ── @Mentions ──
  function initMentions() {
    const dropdown = $('#mention-dropdown'); if (!dropdown) return;
    let mentionTarget = null;
    let mentionStart = -1;
    let selectedIdx = 0;

    document.addEventListener('input', (e) => {
      if (!e.target.closest('[contenteditable]')) return;
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const text = range.startContainer.textContent || '';
      const pos = range.startOffset;
      const before = text.slice(0, pos);
      const atIdx = before.lastIndexOf('@');
      if (atIdx >= 0 && (atIdx === 0 || before[atIdx - 1] === ' ')) {
        const query = before.slice(atIdx + 1).toLowerCase();
        const matches = state.users.filter(u => u.name.toLowerCase().includes(query));
        if (matches.length) {
          mentionTarget = e.target;
          mentionStart = atIdx;
          selectedIdx = 0;
          dropdown.innerHTML = '';
          matches.forEach((u, i) => {
            const item = document.createElement('div'); item.className = 'mention-item' + (i === 0 ? ' selected' : '');
            item.innerHTML = `<div class="task-assignee-avatar" style="background:${u.color};color:#fff;width:24px;height:24px;font-size:10px">${u.initials}</div><span>${esc(u.name)}</span>`;
            item.onclick = () => insertMention(u);
            dropdown.appendChild(item);
          });
          const rect = e.target.getBoundingClientRect();
          dropdown.style.display = 'block';
          dropdown.style.left = rect.left + 'px';
          dropdown.style.top = rect.bottom + 4 + 'px';
          return;
        }
      }
      dropdown.style.display = 'none';
    });

    function insertMention(user) {
      if (!mentionTarget) return;
      const sel = window.getSelection();
      const range = sel.getRangeAt(0);
      const text = range.startContainer.textContent;
      range.startContainer.textContent = text.slice(0, mentionStart) + text.slice(range.startOffset);
      const span = document.createElement('span');
      span.className = 'mention-highlight';
      span.contentEditable = false;
      span.textContent = `@${user.name}`;
      range.setStart(range.startContainer, mentionStart);
      range.deleteContents();
      range.insertNode(span);
      const space = document.createTextNode(' ');
      span.after(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
      dropdown.style.display = 'none';
    }

    document.addEventListener('keydown', (e) => {
      if (dropdown.style.display !== 'block') return;
      const items = dropdown.querySelectorAll('.mention-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = (selectedIdx + 1) % items.length; items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = (selectedIdx - 1 + items.length) % items.length; items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx)); }
      else if (e.key === 'Enter') { e.preventDefault(); items[selectedIdx]?.click(); }
      else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
    });
  }

  // ── Export/Import ──
  function exportCSV(projectId) {
    const tasks = projectId ? state.tasks.filter(t => taskInProject(t, projectId)) : state.tasks;
    const headers = ['Name','Assignee','Due Date','Priority','Completed','Section','Description'];
    const rows = tasks.map(t => {
      const user = state.users.find(u => u.id === t.assignee);
      return [t.name, user?.name || '', t.dueDate || '', t.priority || '', t.completed ? 'Yes' : 'No', t.sectionId || '', t.description.replace(/\n/g, ' ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(csv, 'tasks-export.csv', 'text/csv');
    showToast('Exported as CSV');
  }

  function exportJSON(projectId) {
    const tasks = projectId ? state.tasks.filter(t => taskInProject(t, projectId)) : state.tasks;
    const json = JSON.stringify(tasks, null, 2);
    downloadBlob(json, 'tasks-export.json', 'application/json');
    showToast('Exported as JSON');
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function importCSV(csvText) {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
      const name = vals[headers.indexOf('Name')] || `Task ${i}`;
      createTask({ name, dueDate: vals[headers.indexOf('Due Date')] || null, priority: vals[headers.indexOf('Priority')] || null, description: vals[headers.indexOf('Description')] || '' });
    }
    showToast(`Imported ${lines.length - 1} tasks`);
    renderCurrentView();
  }

  function initExportModal() {
    let selectedFormat = 'csv';
    const exportOptions = $$('.export-option');
    exportOptions.forEach(opt => {
      opt.onclick = () => { exportOptions.forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); selectedFormat = opt.dataset.format; };
    });
    const openExportBtn = $('#project-export-btn'); if (openExportBtn) openExportBtn.onclick = () => openModal('export-modal');
    const exportBtn = $('#export-btn');
    if (exportBtn) exportBtn.onclick = () => {
      if (selectedFormat === 'csv') exportCSV(state.currentProject);
      else exportJSON(state.currentProject);
      closeModal('export-modal');
    };
  }

  // ── Init: Create Task Modal ──
  function initCreateTaskModal() {
    const populateSelects = () => {
      const aSel = $('#new-task-assignee'); if (aSel) { aSel.innerHTML = '<option value="">Unassigned</option>'; state.users.forEach(u => { aSel.innerHTML += `<option value="${u.id}">${esc(u.name)}</option>`; }); }
      const pSel = $('#new-task-project'); if (pSel) { pSel.innerHTML = '<option value="">None</option>'; state.projects.forEach(p => { pSel.innerHTML += `<option value="${p.id}">${esc(p.name)}</option>`; }); }
      if (pSel) pSel.onchange = () => { const pid = pSel.value; const sSel = $('#new-task-section'); if (sSel) { sSel.innerHTML = '<option value="">Default</option>'; if (pid) { const project = state.projects.find(p => p.id === pid); project?.sections.forEach(s => { sSel.innerHTML += `<option value="${s.id}">${esc(s.name)}</option>`; }); } } };
    };
    const createBtn = $('#btn-create'); if (createBtn) createBtn.onclick = () => { populateSelects(); openModal('create-task-modal'); const n = $('#new-task-name'); if (n) n.focus(); };
    const submitBtn = $('#create-task-submit');
    if (submitBtn) submitBtn.onclick = () => {
      const nameEl = $('#new-task-name'); if (!nameEl) return;
      const name = nameEl.value.trim(); if (!name) { nameEl.focus(); return; }
      createTask({
        name, description: $('#new-task-description')?.textContent || '',
        assignee: $('#new-task-assignee')?.value || null,
        dueDate: $('#new-task-due')?.value || null,
        projectId: $('#new-task-project')?.value || null,
        sectionId: $('#new-task-section')?.value || null,
        priority: $('#new-task-priority')?.value || null,
      });
      closeModal('create-task-modal'); nameEl.value = '';
      renderCurrentView(); showToast(`Task "${name}" created`);
    };
  }

  function initCreateProjectModal() {
    let selectedColor = '#6d6e6f';
    const addBtn = $('#add-project-sidebar'); if (addBtn) addBtn.onclick = () => openModal('create-project-modal');
    $$('#color-picker .color-swatch').forEach(sw => { sw.onclick = () => { $$('#color-picker .color-swatch').forEach(s => s.classList.remove('selected')); sw.classList.add('selected'); selectedColor = sw.dataset.color; }; });
    const submitBtn = $('#create-project-submit');
    if (submitBtn) submitBtn.onclick = () => {
      const nameEl = $('#new-project-name'); if (!nameEl) return;
      const name = nameEl.value.trim(); if (!name) return;
      createProject({ name, color: selectedColor, defaultView: $('#new-project-view')?.value, privacy: $('#new-project-privacy')?.value });
      closeModal('create-project-modal'); nameEl.value = '';
      renderSidebar(); showToast(`Project "${name}" created`);
    };
  }

  function initSettingsModal() {
    const avatar = $('#user-avatar'); if (avatar) avatar.onclick = () => openModal('settings-modal');
    $$('.settings-nav').forEach(nav => { nav.onclick = () => { $$('.settings-nav').forEach(n => n.classList.remove('active')); nav.classList.add('active'); $$('.settings-panel').forEach(p => p.classList.remove('active')); const p = $(`#settings-${nav.dataset.settings}`); if (p) p.classList.add('active'); }; });
    $$('input[name="theme"]').forEach(radio => { radio.onchange = () => { state.theme = radio.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : radio.value; saveState(); applyTheme(); }; });
    $$('#sidebar-color-picker .color-swatch').forEach(sw => { sw.onclick = () => { $$('#sidebar-color-picker .color-swatch').forEach(s => s.classList.remove('selected')); sw.classList.add('selected'); state.sidebarColor = sw.dataset.color; saveState(); applyTheme(); }; });
    $$('#topbar-color-picker .color-swatch').forEach(sw => { sw.onclick = () => { $$('#topbar-color-picker .color-swatch').forEach(s => s.classList.remove('selected')); sw.classList.add('selected'); state.topbarColor = sw.dataset.color; saveState(); applyTheme(); window.electronInjectedApi?.sendColorThemeProps({ theme: state.theme, topbarColor: state.topbarColor }); }; });
    const compact = $('#compact-mode'); if (compact) compact.onchange = () => { state.compactMode = compact.checked; document.body.classList.toggle('compact', state.compactMode); saveState(); };
  }

  function initShareModal() {
    $('#share-project')?.addEventListener('click', () => { openModal('share-modal'); renderShareMembers(); });
    const copyLink = $('#copy-project-link'); if (copyLink) copyLink.onclick = () => { navigator.clipboard?.writeText(`asana-clone://project/${state.currentProject}`); showToast('Link copied'); };
    const inviteBtn = $('#share-invite-btn');
    if (inviteBtn) inviteBtn.onclick = () => {
      const emailEl = $('#share-email'); if (!emailEl) return;
      const email = emailEl.value.trim(); if (!email) return;
      state.guests.push({ id: genId(), name: email.split('@')[0], email, accessLevel: 'edit' });
      saveState(); showToast(`Invite sent to ${email}`); emailEl.value = '';
    };
  }

  function renderShareMembers() {
    const list = $('#share-members-list'); if (!list) return; list.innerHTML = '';
    if (!state.currentProject) return;
    const project = state.projects.find(p => p.id === state.currentProject); if (!project) return;
    project.members.forEach(uid => {
      const user = state.users.find(u => u.id === uid); if (!user) return;
      const el = document.createElement('div'); el.className = 'member-item';
      el.innerHTML = `<div class="task-assignee-avatar" style="background:${user.color};color:#fff">${user.initials}</div><span style="flex:1;font-size:13px">${esc(user.name)}</span><span style="font-size:11px;color:var(--text-tertiary)">Can edit</span>`;
      list.appendChild(el);
    });
  }

  function initGoals() { const btn = $('#create-goal'); if (btn) btn.onclick = () => { const name = prompt('Goal name:'); if (name) { createGoal({ name }); renderGoals(); showToast(`Goal "${name}" created`); } }; }
  function initPortfolios() { const btn = $('#create-portfolio'); if (btn) btn.onclick = () => { const name = prompt('Portfolio name:'); if (name) { state.portfolios.push({ id: genId(), name, projects: [] }); saveState(); renderPortfolios(); showToast(`Portfolio "${name}" created`); } }; }

  function initSections() {
    const myBtn = $('#add-section-my-tasks'); if (myBtn) myBtn.onclick = () => { const name = prompt('Section name:'); if (name) showToast(`Section "${name}" added`); };
    const projBtn = $('#add-section-project');
    if (projBtn) projBtn.onclick = () => {
      if (!state.currentProject) return;
      const project = state.projects.find(p => p.id === state.currentProject); if (!project) return;
      const name = prompt('Section name:'); if (!name) return;
      project.sections.push({ id: genId(), name });
      saveState(); renderProject(state.currentProject); showToast(`Section "${name}" added`);
    };
  }

  function initSectionAddTask() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-add-task')) {
        const section = e.target.closest('.task-section');
        const sectionId = section?.dataset.sectionId;
        const task = createTask({ name: 'New Task', sectionId: sectionId || null, projectId: state.currentProject || null, assignee: state.currentView === 'my-tasks' ? 'u1' : null });
        renderCurrentView(); openTaskDetail(task.id);
      }
    });
  }

  function initProjectStar() {
    const btn = $('#project-star'); if (!btn) return;
    btn.onclick = () => {
      if (!state.currentProject) return;
      const project = state.projects.find(p => p.id === state.currentProject); if (!project) return;
      project.starred = !project.starred; saveState(); renderSidebar(); renderProject(state.currentProject);
      showToast(project.starred ? 'Project starred' : 'Project unstarred');
    };
  }

  // ── View Tab Switching ──
  function initViewTabs() {
    document.addEventListener('click', (e) => {
      if (!e.target.classList.contains('view-tab')) return;
      const parent = e.target.closest('.view-header');
      parent?.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const tab = e.target.dataset.tab;

      if (state.currentView === 'my-tasks') {
        const listView = $('#my-tasks-sections');
        const boardView = $('#board-view');
        const calView = $('#calendar-view');
        if (listView) listView.classList.toggle('hidden', tab !== 'list');
        if (boardView) boardView.classList.toggle('hidden', tab !== 'board');
        if (calView) calView.classList.toggle('hidden', tab !== 'calendar');
        if (tab === 'board') {
          const cols = $('#board-columns'); if (cols) {
            cols.innerHTML = '';
            ['To Do','In Progress','Done'].forEach(name => {
              const col = document.createElement('div'); col.className = 'board-column';
              const tasks = name === 'Done' ? state.tasks.filter(t => t.completed && (!t.assignee || t.assignee === 'u1')) : name === 'In Progress' ? state.tasks.filter(t => !t.completed && t.dueDate && (!t.assignee || t.assignee === 'u1')) : state.tasks.filter(t => !t.completed && !t.dueDate && (!t.assignee || t.assignee === 'u1'));
              col.innerHTML = `<div class="board-column-header">${name} <span class="count">${tasks.length}</span></div><div class="board-column-body"></div>`;
              tasks.forEach(t => col.querySelector('.board-column-body').appendChild(renderBoardCard(t)));
              cols.appendChild(col);
            });
          }
        }
        if (tab === 'calendar') renderCalendarView();
      } else if (state.currentView === 'project' && state.currentProject) {
        state.currentProjectTab = tab;
        renderProject(state.currentProject);
      }
    });
  }

  // ── Keyboard Shortcuts ──
  function initKeyboardShortcuts() {
    let tabPressed = false;
    document.addEventListener('keydown', (e) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !e.target.closest('[contenteditable],input,textarea')) { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && !e.target.closest('[contenteditable],input,textarea')) { e.preventDefault(); redo(); return; }

      if (e.key === 'Tab' && !e.target.closest('[contenteditable],input,textarea,select')) { e.preventDefault(); tabPressed = true; setTimeout(() => tabPressed = false, 500); return; }
      if (tabPressed) {
        switch (e.key.toLowerCase()) {
          case 'n': e.preventDefault(); openModal('create-task-modal'); break;
          case 'h': e.preventDefault(); switchView('home'); break;
          case 'z': e.preventDefault(); switchView('my-tasks'); break;
          case 'i': e.preventDefault(); switchView('inbox'); break;
          case 'b': e.preventDefault(); window.electronInjectedApi?.maybeCloseQuickAddTaskWindow(); break;
          case 'x': e.preventDefault(); toggleSidebar(); break;
          case 'e': e.preventDefault(); openModal('export-modal'); break;
        }
        tabPressed = false; return;
      }
      if (e.key === '/' && !e.target.closest('[contenteditable],input,textarea')) { e.preventDefault(); const s = $('#global-search'); if (s) s.focus(); }
      if (e.key === 'Escape') { $$('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); hideTaskDetail(); const md = $('#mention-dropdown'); if (md) md.style.display = 'none'; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); const s = $('#global-search'); if (s) s.focus(); }
    });
  }

  // ── Global Search ──
  function initSearch() {
    const input = $('#global-search'); if (!input) return;
    let searchResults = null;
    input.onfocus = () => {
      if (!searchResults) {
        searchResults = document.createElement('div');
        searchResults.style.cssText = 'position:fixed;background:var(--bg-modal);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:9999;width:500px;max-height:400px;overflow-y:auto;display:none;padding:8px';
        document.body.appendChild(searchResults);
      }
    };
    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      if (!q || !searchResults) { if (searchResults) searchResults.style.display = 'none'; return; }
      const rect = input.getBoundingClientRect();
      searchResults.style.left = rect.left + 'px'; searchResults.style.top = rect.bottom + 4 + 'px';
      searchResults.style.display = 'block'; searchResults.innerHTML = '';

      const matchedProjects = state.projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 4);
      const matchedTasks = state.tasks.filter(t => t.name.toLowerCase().includes(q)).slice(0, 8);
      const matchedMsgs = state.messages.filter(m => m.text.toLowerCase().includes(q)).slice(0, 4);

      if (matchedProjects.length) {
        searchResults.innerHTML += '<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;text-transform:uppercase">Projects</div>';
        matchedProjects.forEach(p => {
          const el = document.createElement('div'); el.style.cssText = 'padding:8px;cursor:pointer;border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:center;gap:8px';
          el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
          el.onmouseenter = () => el.style.background = 'var(--bg-hover)'; el.onmouseleave = () => el.style.background = '';
          el.onclick = () => { openProject(p.id); searchResults.style.display = 'none'; input.value = ''; input.blur(); };
          searchResults.appendChild(el);
        });
      }
      if (matchedTasks.length) {
        searchResults.innerHTML += '<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;text-transform:uppercase;margin-top:8px">Tasks</div>';
        matchedTasks.forEach(t => {
          const el = document.createElement('div'); el.style.cssText = 'padding:8px;cursor:pointer;border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:center;gap:8px';
          el.innerHTML = `<div class="task-checkbox${t.completed ? ' checked' : ''}" style="width:14px;height:14px;font-size:8px">${t.completed ? '✓' : ''}</div>${esc(t.name)}`;
          el.onmouseenter = () => el.style.background = 'var(--bg-hover)'; el.onmouseleave = () => el.style.background = '';
          el.onclick = () => { openTaskDetail(t.id); searchResults.style.display = 'none'; input.value = ''; input.blur(); };
          searchResults.appendChild(el);
        });
      }
      if (matchedMsgs.length) {
        searchResults.innerHTML += '<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;text-transform:uppercase;margin-top:8px">Messages</div>';
        matchedMsgs.forEach(m => {
          const el = document.createElement('div'); el.style.cssText = 'padding:8px;cursor:pointer;border-radius:var(--radius-sm);font-size:13px';
          el.textContent = m.text.slice(0, 80) + (m.text.length > 80 ? '...' : '');
          el.onmouseenter = () => el.style.background = 'var(--bg-hover)'; el.onmouseleave = () => el.style.background = '';
          searchResults.appendChild(el);
        });
      }
      if (!matchedProjects.length && !matchedTasks.length && !matchedMsgs.length) {
        searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px">No results</div>';
      }
    };
    input.onblur = () => { setTimeout(() => { if (searchResults) searchResults.style.display = 'none'; }, 200); };
  }

  function toggleSidebar() { state.sidebarCollapsed = !state.sidebarCollapsed; const sb = $('#sidebar'); if (sb) sb.classList.toggle('collapsed', state.sidebarCollapsed); }

  function initInbox() {
    const archiveBtn = $('#inbox-archive-all'); if (archiveBtn) archiveBtn.onclick = () => { state.inbox = []; saveState(); renderInbox(); updateBadges(); showToast('Inbox cleared'); };
    const filter = $('#inbox-filter'); if (filter) filter.onchange = () => renderInbox();
  }

  function initDetailPanel() {
    const closeBtn = $('#task-close'); if (closeBtn) closeBtn.onclick = () => hideTaskDetail();
    const fsBtn = $('#task-fullscreen'); if (fsBtn) fsBtn.onclick = () => { const p = $('#task-detail-panel'); if (p) p.style.width = p.style.width === '100%' ? '' : '100%'; };
    const attachBtn = $('#task-attach'); if (attachBtn) attachBtn.onclick = () => { if (state.selectedTask) { const el = $('#task-attach-file'); if (el) el.click(); } };
    const subBtn = $('#task-subtask'); if (subBtn) subBtn.onclick = () => { if (state.selectedTask) { state.selectedTask.subtasks.push({ id: genId(), name: 'New subtask', completed: false }); saveState(); renderSubtasks(state.selectedTask); } };
  }

  function initNotepad() { const np = $('#private-notepad'); if (np) np.oninput = () => { state.notepad = np.value; saveState(); }; }

  function initNavigation() {
    $$('.nav-item[data-view]').forEach(item => { item.onclick = () => switchView(item.dataset.view); });
    $$('.widget-link[data-view]').forEach(link => { link.onclick = () => switchView(link.dataset.view); });
    $$('.sidebar-action[data-view]').forEach(btn => { btn.onclick = () => switchView(btn.dataset.view); });
    const sideToggle = $('#sidebar-toggle'); if (sideToggle) sideToggle.onclick = () => toggleSidebar();
    const inviteBtn = $('#invite-btn'); if (inviteBtn) inviteBtn.onclick = () => openModal('share-modal');
  }

  function initSectionCollapse() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-collapse')) { e.target.classList.toggle('collapsed'); const taskList = e.target.closest('.section-header')?.nextElementSibling; if (taskList) taskList.classList.toggle('hidden'); }
      if (e.target.classList.contains('section-toggle')) { const items = e.target.closest('.nav-section')?.querySelector('.nav-section-items'); if (items) items.classList.toggle('hidden'); e.target.textContent = items?.classList.contains('hidden') ? '▸' : '▾'; }
    });
  }

  // ── Custom Field Modal ──
  function initCustomFieldModal() {
    const typeOptions = $$('#cf-type-select .custom-field-type-option');
    typeOptions.forEach(opt => {
      opt.onclick = () => {
        typeOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const optField = $('#cf-options-field');
        if (optField) optField.classList.toggle('hidden', opt.dataset.type !== 'dropdown');
      };
    });
    const openBtn = $('#project-custom-fields-btn'); if (openBtn) openBtn.onclick = () => openModal('custom-field-modal');
    const saveBtn = $('#cf-save');
    if (saveBtn) saveBtn.onclick = () => {
      const nameEl = $('#cf-name'); if (!nameEl) return;
      const name = nameEl.value.trim(); if (!name) return;
      const selectedType = $('#cf-type-select .custom-field-type-option.selected');
      const type = selectedType?.dataset.type || 'text';
      const optionsText = $('#cf-options')?.value || '';
      const options = type === 'dropdown' ? optionsText.split('\n').map(s => s.trim()).filter(Boolean) : [];
      createCustomField({ projectId: state.currentProject, name, type, options });
      closeModal('custom-field-modal'); nameEl.value = '';
      showToast(`Custom field "${name}" created`);
    };
  }

  // ── Rule Builder Modal ──
  function initRuleBuilderModal() {
    $$('#rule-trigger-options .rule-option').forEach(opt => {
      opt.onclick = () => { $$('#rule-trigger-options .rule-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); };
    });
    $$('#rule-action-options .rule-option').forEach(opt => {
      opt.onclick = () => { $$('#rule-action-options .rule-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); };
    });
    const saveBtn = $('#rule-save');
    if (saveBtn) saveBtn.onclick = () => {
      const name = $('#rule-name')?.value.trim() || 'New Rule';
      const triggerOpt = $('#rule-trigger-options .rule-option.selected');
      const actionOpt = $('#rule-action-options .rule-option.selected');
      const triggerType = triggerOpt?.dataset.trigger || 'task-completed';
      const actionType = actionOpt?.dataset.action || 'move-to-section';
      const project = state.projects.find(p => p.id === state.currentProject);
      const lastSection = project?.sections[project.sections.length - 1];
      createRule({
        projectId: state.currentProject, name,
        trigger: { type: triggerType },
        action: { type: actionType, sectionId: lastSection?.id, assignee: 'u1', text: 'Auto-generated comment' },
      });
      closeModal('rule-builder-modal');
      showToast(`Rule "${name}" created`);
      if (state.currentView === 'project' || state.currentView === 'workflow') renderCurrentView();
    };
    const addRuleBtn = $('#add-workflow-rule'); if (addRuleBtn) addRuleBtn.onclick = () => openModal('rule-builder-modal');
    const ruleAddBtn = $('#rule-add-btn'); if (ruleAddBtn) ruleAddBtn.onclick = () => openModal('rule-builder-modal');
  }

  // ── Template Modal ──
  function initTemplateModal() {
    const openBtn = $('#open-templates'); if (openBtn) openBtn.onclick = () => { renderTemplateGallery(); openModal('template-modal'); };
    const saveBtn = $('#save-as-template');
    if (saveBtn) saveBtn.onclick = () => {
      if (!state.currentProject) return;
      const project = state.projects.find(p => p.id === state.currentProject); if (!project) return;
      state.templates.projects.push({
        id: genId(), name: project.name + ' Template', color: project.color,
        sections: project.sections.map(s => ({ name: s.name })),
        description: 'Template from ' + project.name,
      });
      saveState(); renderTemplateGallery();
      showToast('Template saved');
    };
  }

  function renderTemplateGallery() {
    const gallery = $('#template-gallery'); if (!gallery) return;
    gallery.innerHTML = '';
    const all = state.templates.projects;
    if (!all.length) { gallery.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;grid-column:1/-1;text-align:center">No templates yet. Save a project as template.</p>'; return; }
    all.forEach(tmpl => {
      const card = document.createElement('div'); card.className = 'template-card';
      card.innerHTML = `<div class="template-card-header" style="background:${tmpl.color}22;color:${tmpl.color}">${tmpl.name[0]?.toUpperCase() || 'T'}</div><div class="template-card-body"><div class="template-card-title">${esc(tmpl.name)}</div><div class="template-card-desc">${tmpl.sections?.length || 0} sections</div></div>`;
      card.onclick = () => {
        const project = createProject({
          name: tmpl.name.replace(' Template', ''),
          color: tmpl.color,
          sections: tmpl.sections.map(s => ({ id: genId(), name: s.name })),
        });
        closeModal('template-modal');
        renderSidebar(); openProject(project.id);
        showToast(`Project created from template`);
      };
      gallery.appendChild(card);
    });
  }

  // ── Recurring Modal ──
  function initRecurringModal() {
    const saveBtn = $('#recur-save');
    if (saveBtn) saveBtn.onclick = () => {
      if (!state.selectedTask) return;
      const pattern = $('#recur-pattern')?.value || 'weekly';
      const interval = parseInt($('#recur-interval')?.value) || 1;
      state.selectedTask.recurrence = { pattern, interval };
      saveState(); closeModal('recurring-modal');
      openTaskDetail(state.selectedTask.id); renderCurrentView();
      showToast('Recurrence set');
    };
    const removeBtn = $('#recur-remove');
    if (removeBtn) removeBtn.onclick = () => {
      if (state.selectedTask) { state.selectedTask.recurrence = null; saveState(); closeModal('recurring-modal'); openTaskDetail(state.selectedTask.id); renderCurrentView(); showToast('Recurrence removed'); }
    };
    const summary = $('#recur-summary');
    const updateSummary = () => {
      const pattern = $('#recur-pattern')?.value || 'weekly';
      const interval = parseInt($('#recur-interval')?.value) || 1;
      if (summary) summary.textContent = `Repeats every ${interval > 1 ? interval + ' ' : ''}${pattern.replace('ly', interval > 1 ? 's' : '')}`;
    };
    const patternEl = $('#recur-pattern'); if (patternEl) patternEl.onchange = updateSummary;
    const intervalEl = $('#recur-interval'); if (intervalEl) intervalEl.oninput = updateSummary;
  }

  // ── Team Modal ──
  function initTeamModal() {
    const addBtn = $('#team-add-btn');
    if (addBtn) addBtn.onclick = () => {
      const emailEl = $('#team-add-member'); if (!emailEl) return;
      const email = emailEl.value.trim(); if (!email) return;
      showToast(`Invited ${email}`); emailEl.value = '';
    };
  }

  // ── Workspace Modal ──
  function initWorkspaceModal() {
    const wsSelector = $('#workspace-selector'); if (wsSelector) wsSelector.onclick = () => openModal('workspace-modal');
    const inviteBtn = $('#ws-invite-btn');
    if (inviteBtn) inviteBtn.onclick = () => {
      const emailEl = $('#ws-invite-email'); if (!emailEl) return;
      const email = emailEl.value.trim(); if (!email) return;
      state.guests.push({ id: genId(), name: email.split('@')[0], email, accessLevel: 'edit' });
      saveState(); showToast(`Invited ${email}`); emailEl.value = '';
    };
    const wsSave = $('#ws-save');
    if (wsSave) wsSave.onclick = () => {
      const name = $('#ws-name')?.value.trim(); if (name) state.workspace.name = name;
      const icon = $('#ws-icon')?.value.trim(); if (icon) state.workspace.icon = icon;
      const wsNameEl = $('#workspace-name'); if (wsNameEl) wsNameEl.textContent = state.workspace.name;
      const wsIconEl = $('#workspace-icon'); if (wsIconEl) wsIconEl.textContent = state.workspace.icon;
      saveState(); closeModal('workspace-modal'); showToast('Workspace updated');
    };
  }

  // ── Admin Navigation ──
  function initAdminNavigation() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('admin-nav')) {
        $$('.admin-nav').forEach(n => n.classList.remove('active'));
        e.target.classList.add('active');
        if (state.currentView === 'admin') renderAdmin();
      }
    });
  }

  // ── Electron IPC ──
  function initElectronIPC() {
    const api = window.electronInjectedApi; if (!api) return;
    if (api.registerUpdateTabsHandler) api.registerUpdateTabsHandler((tabs) => renderTabs(tabs));
    if (api.registerFullScreenHandler) api.registerFullScreenHandler((isFs) => document.body.classList.toggle('fullscreen', isFs));
    if (api.registerMenuBarPreferencesHandler) api.registerMenuBarPreferencesHandler(() => openModal('settings-modal'));
    if (api.registerNavigateToTaskHandler) api.registerNavigateToTaskHandler((taskId) => { const task = state.tasks.find(t => t.id === taskId); if (task) openTaskDetail(task.id); });
    if (api.registerNavigateToMeetingsPageHandler) api.registerNavigateToMeetingsPageHandler(() => showToast('Meetings'));
    if (api.registerNavigateToSettingsHandler) api.registerNavigateToSettingsHandler(() => openModal('settings-modal'));
    if (api.registerNavigationHandler) api.registerNavigationHandler((route) => { if (route === '/keyboard-shortcuts') openModal('shortcuts-modal'); });
    if (api.registerUpdateColorThemeHandler) api.registerUpdateColorThemeHandler((props) => { if (props.topbarColor) state.topbarColor = props.topbarColor; applyTheme(); });
    if (api.registerMetaFHandler) api.registerMetaFHandler(() => { const s = $('#global-search'); if (s) s.focus(); });
    if (api.getTabs) api.getTabs().then(tabs => renderTabs(tabs));
    // Deep links
    if (api.registerDeepLinkHandler) api.registerDeepLinkHandler((url) => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'task' && parts[1]) { const t = state.tasks.find(x => x.id === parts[1]); if (t) openTaskDetail(t.id); }
        else if (parts[0] === 'project' && parts[1]) { const p = state.projects.find(x => x.id === parts[1]); if (p) openProject(p.id); }
      } catch {}
    });
  }

  function initWindowControls() {
    const min = $('#btn-minimize'); if (min) min.onclick = () => window.electronInjectedApi?.minimizeWindow();
    const max = $('#btn-maximize'); if (max) max.onclick = () => window.electronInjectedApi?.toggleMaximizeWindow();
    const close = $('#btn-close'); if (close) close.onclick = () => window.electronInjectedApi?.closeWindow();
    const newTab = $('#new-tab-btn'); if (newTab) newTab.onclick = () => window.electronInjectedApi?.createNewTab();
  }

  function initNotifications() {
    const notifBtn = $('#btn-notifications'); if (notifBtn) notifBtn.onclick = () => switchView('inbox');
    const helpBtn = $('#btn-help'); if (helpBtn) helpBtn.onclick = () => openModal('shortcuts-modal');
  }

  // ── Session Restore ──
  function initSessionRestore() {
    const api = window.electronInjectedApi; if (!api) return;
    if (api.shouldShowSessionRestoreBanner) {
      api.shouldShowSessionRestoreBanner().then(show => {
        if (show) showToast('Session restored');
      }).catch(() => {});
    }
  }

  // ── Seed Data ──
  function seedIfEmpty() {
    if (state.tasks.length > 0 || state.projects.length > 0) return;

    const p1 = createProject({ name: 'Product Launch', color: '#e8384f' });
    const p2 = createProject({ name: 'Website Redesign', color: '#4573d2' });
    const p3 = createProject({ name: 'Marketing Campaign', color: '#62d26f' });

    const today = todayStr();
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);
    const yesterday = addDays(today, -1);
    const in3days = addDays(today, 3);
    const in5days = addDays(today, 5);

    createTask({ name: 'Define product requirements', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u1', dueDate: today, startDate: addDays(today, -3), priority: 'high' });
    createTask({ name: 'Design mockups for landing page', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u2', dueDate: tomorrow, startDate: today, priority: 'medium' });
    createTask({ name: 'Set up CI/CD pipeline', projectId: p1.id, sectionId: p1.sections[1].id, assignee: 'u3', dueDate: nextWeek, startDate: in3days, priority: 'high' });
    createTask({ name: 'Write API documentation', projectId: p1.id, sectionId: p1.sections[1].id, assignee: 'u1', dueDate: nextWeek, startDate: in5days, priority: 'low' });
    createTask({ name: 'Finalize pricing strategy', projectId: p1.id, sectionId: p1.sections[2].id, assignee: 'u4', dueDate: yesterday, priority: 'high' });

    // Milestone
    createTask({ name: 'Beta Release', projectId: p1.id, sectionId: p1.sections[1].id, assignee: 'u1', dueDate: nextWeek, startDate: nextWeek, isMilestone: true });

    // Approval
    createTask({ name: 'Approve marketing budget', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u1', dueDate: tomorrow, isApproval: true, approvalStatus: 'pending' });

    // Recurring
    createTask({ name: 'Weekly standup notes', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u1', dueDate: today, recurrence: { pattern: 'weekly', interval: 1 } });

    createTask({ name: 'Audit current site performance', projectId: p2.id, sectionId: p2.sections[0].id, assignee: 'u1', dueDate: today, startDate: addDays(today, -2) });
    createTask({ name: 'Create wireframes', projectId: p2.id, sectionId: p2.sections[0].id, assignee: 'u2', dueDate: tomorrow, startDate: today, priority: 'medium' });
    createTask({ name: 'Implement responsive navigation', projectId: p2.id, sectionId: p2.sections[1].id, assignee: 'u3', dueDate: nextWeek, startDate: in3days });
    createTask({ name: 'User testing session', projectId: p2.id, sectionId: p2.sections[1].id, assignee: 'u4', dueDate: nextWeek, startDate: in5days, priority: 'medium' });

    createTask({ name: 'Draft social media calendar', projectId: p3.id, sectionId: p3.sections[0].id, assignee: 'u1', dueDate: tomorrow, startDate: today, priority: 'medium' });
    createTask({ name: 'Design email templates', projectId: p3.id, sectionId: p3.sections[0].id, assignee: 'u2', dueDate: nextWeek, startDate: in3days });
    createTask({ name: 'Prepare press release', projectId: p3.id, sectionId: p3.sections[1].id, assignee: 'u4', dueDate: nextWeek, startDate: in5days, priority: 'high' });
    createTask({ name: 'A/B test landing pages', projectId: p3.id, sectionId: p3.sections[1].id, assignee: 'u3', startDate: today, dueDate: nextWeek });

    createTask({ name: 'Review quarterly OKRs', assignee: 'u1', dueDate: today, priority: 'high' });
    createTask({ name: 'Update onboarding docs', assignee: 'u1', dueDate: nextWeek });
    createTask({ name: 'Schedule team retro', assignee: 'u1', dueDate: tomorrow, priority: 'low' });

    createGoal({ name: 'Launch v2.0 by Q4', dueDate: '2026-12-31' });
    createGoal({ name: 'Achieve 1000 signups', dueDate: '2026-11-30' });

    // Custom fields
    createCustomField({ projectId: p1.id, name: 'Priority Level', type: 'dropdown', options: ['P0','P1','P2','P3'] });
    createCustomField({ projectId: p1.id, name: 'Story Points', type: 'number' });
    createCustomField({ projectId: p1.id, name: 'Approved', type: 'checkbox' });

    // Rules
    createRule({ projectId: p1.id, name: 'Move completed to Done', trigger: { type: 'task-completed' }, action: { type: 'move-to-section', sectionId: p1.sections[2].id } });
    createRule({ projectId: p1.id, name: 'Welcome comment on assign', trigger: { type: 'task-assigned' }, action: { type: 'add-comment', text: 'Welcome! This task has been assigned to you.' } });

    // Messages
    state.messages.push(
      { id: genId(), projectId: p1.id, userId: 'u2', text: 'Hey team, I just finished the initial mockups. Can everyone review and leave feedback?', createdAt: Date.now() - 7200000, replies: [] },
      { id: genId(), projectId: p1.id, userId: 'u1', text: 'Looks great! I have a few minor comments on the navigation layout.', createdAt: Date.now() - 3600000, replies: [] },
    );

    state.inbox = [
      { id: genId(), senderId: 'u2', message: 'assigned you "Design mockups for landing page"', read: false, createdAt: Date.now() - 3600000 },
      { id: genId(), senderId: 'u3', message: 'completed "Set up CI/CD pipeline"', read: false, createdAt: Date.now() - 7200000 },
      { id: genId(), senderId: 'u4', message: 'commented on "Finalize pricing strategy"', read: true, createdAt: Date.now() - 86400000 },
    ];

    state.statusUpdates = [
      { id: genId(), title: 'Product Launch', status: 'on-track', text: 'All milestones on schedule. Beta testing begins next week.', createdAt: Date.now() - 86400000 },
      { id: genId(), title: 'Website Redesign', status: 'at-risk', text: 'Design feedback pending. May need to extend timeline.', createdAt: Date.now() - 172800000 },
    ];

    // Built-in templates
    state.templates.projects = [
      { id: genId(), name: 'Product Launch', color: '#e8384f', sections: [{ name: 'Planning' }, { name: 'Development' }, { name: 'Testing' }, { name: 'Launch' }], description: 'Template for product launches' },
      { id: genId(), name: 'Sprint Planning', color: '#4573d2', sections: [{ name: 'Backlog' }, { name: 'Sprint' }, { name: 'In Review' }, { name: 'Done' }], description: 'Agile sprint template' },
      { id: genId(), name: 'Marketing Campaign', color: '#62d26f', sections: [{ name: 'Strategy' }, { name: 'Content Creation' }, { name: 'Review' }, { name: 'Published' }], description: 'Marketing campaign workflow' },
      { id: genId(), name: 'Event Planning', color: '#ea4e9d', sections: [{ name: 'Venue & Logistics' }, { name: 'Invitations' }, { name: 'Day-of Tasks' }, { name: 'Post-Event' }], description: 'Event planning checklist' },
    ];

    saveState();
  }

  // ── HTML Escape ──
  function esc(str) { const el = document.createElement('span'); el.textContent = str; return el.innerHTML; }
  function selectAll(el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }

  // ── Init ──
  function init() {
    loadState();
    seedIfEmpty();
    applyTheme();
    renderSidebar();
    switchView('home');
    updateBadges();

    initModals();
    initCreateTaskModal();
    initCreateProjectModal();
    initSettingsModal();
    initShareModal();
    initGoals();
    initPortfolios();
    initSections();
    initSectionAddTask();
    initProjectStar();
    initViewTabs();
    initKeyboardShortcuts();
    initSearch();
    initInbox();
    initDetailPanel();
    initNotepad();
    initNavigation();
    initSectionCollapse();
    initElectronIPC();
    initWindowControls();
    initNotifications();
    // v2
    initRichText();
    initMentions();
    initBatchOps();
    initCustomFieldModal();
    initRuleBuilderModal();
    initTemplateModal();
    initRecurringModal();
    initTeamModal();
    initWorkspaceModal();
    initExportModal();
    initAdminNavigation();
    initSessionRestore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
