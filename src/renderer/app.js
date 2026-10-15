/* ══════════════════════════════════════════════════════════════
   Asana Clone — Complete Renderer Application
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
    selectedTask: null,
    activeTab: 'list',
    sidebarCollapsed: false,
    theme: 'light',
    topbarColor: '#f06a6a',
    sidebarColor: '#1e1f21',
    compactMode: false,
    notepad: '',
    nextId: 1,
  };

  const genId = () => `id_${state.nextId++}_${Date.now().toString(36)}`;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Persistence ──
  function saveState() {
    try {
      localStorage.setItem('asana-clone-state', JSON.stringify({
        tasks: state.tasks,
        projects: state.projects,
        sections: state.sections,
        goals: state.goals,
        portfolios: state.portfolios,
        inbox: state.inbox,
        statusUpdates: state.statusUpdates,
        starred: state.starred,
        notepad: state.notepad,
        theme: state.theme,
        topbarColor: state.topbarColor,
        sidebarColor: state.sidebarColor,
        compactMode: state.compactMode,
        nextId: state.nextId,
      }));
    } catch {}
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem('asana-clone-state'));
      if (saved) Object.assign(state, saved);
    } catch {}
  }

  // ── Date Utilities ──
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + 'T23:59:59') < new Date();
  }

  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  // ── Toast ──
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    $('#toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ── Celebration ──
  function celebrate() {
    const canvas = $('#celebration-canvas');
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#e8384f', '#fd612c', '#eec300', '#a4cf30', '#62d26f', '#20aaea', '#7a6ff0', '#ea4e9d'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        vx: (Math.random() - .5) * 4,
        vy: Math.random() * 4 + 2,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - .5) * 10,
      });
    }
    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += .1;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .4);
        ctx.restore();
      });
      frame++;
      if (frame < 120) requestAnimationFrame(animate);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.classList.add('hidden'); }
    }
    animate();
  }

  // ── Task CRUD ──
  function createTask(data) {
    const task = {
      id: genId(),
      name: data.name || 'New Task',
      description: data.description || '',
      completed: false,
      assignee: data.assignee || null,
      dueDate: data.dueDate || null,
      projectId: data.projectId || null,
      sectionId: data.sectionId || null,
      priority: data.priority || null,
      tags: data.tags || [],
      subtasks: [],
      comments: [],
      likes: 0,
      liked: false,
      dependencies: [],
      attachments: [],
      createdAt: Date.now(),
      completedAt: null,
    };
    state.tasks.push(task);
    saveState();
    return task;
  }

  function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    if (state.selectedTask?.id === taskId) {
      state.selectedTask = null;
      hideTaskDetail();
    }
    saveState();
  }

  function completeTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    if (task.completed) celebrate();
    saveState();
  }

  // ── Project CRUD ──
  function createProject(data) {
    const project = {
      id: genId(),
      name: data.name || 'New Project',
      color: data.color || '#6d6e6f',
      defaultView: data.defaultView || 'list',
      privacy: data.privacy || 'public',
      members: ['u1'],
      sections: [
        { id: genId(), name: 'To Do' },
        { id: genId(), name: 'In Progress' },
        { id: genId(), name: 'Done' },
      ],
      starred: false,
      createdAt: Date.now(),
      statusUpdates: [],
    };
    state.projects.push(project);
    saveState();
    return project;
  }

  // ── Goal CRUD ──
  function createGoal(data) {
    const goal = {
      id: genId(),
      name: data.name || 'New Goal',
      owner: data.owner || 'u1',
      dueDate: data.dueDate || null,
      progress: 0,
      status: 'on-track',
      createdAt: Date.now(),
    };
    state.goals.push(goal);
    saveState();
    return goal;
  }

  // ── Render: Sidebar ──
  function renderSidebar() {
    const projectItems = $('#project-items');
    projectItems.innerHTML = '';
    state.projects.forEach(p => {
      const el = document.createElement('div');
      el.className = 'project-nav-item';
      el.dataset.projectId = p.id;
      el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
      el.onclick = () => openProject(p.id);
      projectItems.appendChild(el);
    });

    const starredItems = $('#starred-items');
    starredItems.innerHTML = '';
    state.projects.filter(p => p.starred).forEach(p => {
      const el = document.createElement('div');
      el.className = 'project-nav-item';
      el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
      el.onclick = () => openProject(p.id);
      starredItems.appendChild(el);
    });

    const teamItems = $('#team-items');
    teamItems.innerHTML = '';
    state.teams.forEach(t => {
      const el = document.createElement('div');
      el.className = 'project-nav-item';
      el.innerHTML = `<span class="nav-icon">&#x1F465;</span>${esc(t.name)}`;
      teamItems.appendChild(el);
    });
  }

  // ── Render: Task Row ──
  function renderTaskRow(task) {
    const row = document.createElement('div');
    row.className = `task-row${task.completed ? ' completed' : ''}`;
    row.dataset.taskId = task.id;
    row.draggable = true;

    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox${task.completed ? ' checked' : ''}`;
    checkbox.textContent = task.completed ? '✓' : '';
    checkbox.onclick = (e) => { e.stopPropagation(); completeTask(task.id); renderCurrentView(); };

    const name = document.createElement('span');
    name.className = 'task-name';
    name.textContent = task.name;

    row.appendChild(checkbox);
    row.appendChild(name);

    if (task.priority) {
      const dot = document.createElement('span');
      dot.className = `task-priority-dot ${task.priority}`;
      row.appendChild(dot);
    }

    if (task.projectId) {
      const project = state.projects.find(p => p.id === task.projectId);
      if (project) {
        const tag = document.createElement('span');
        tag.className = 'task-project-tag';
        tag.style.background = project.color + '22';
        tag.style.color = project.color;
        tag.textContent = project.name;
        row.appendChild(tag);
      }
    }

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
        avatar.style.background = user.color;
        avatar.style.color = '#fff';
        avatar.textContent = user.initials;
        row.appendChild(avatar);
      }
    }

    row.onclick = () => openTaskDetail(task.id);

    row.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      row.classList.add('dragging');
    };
    row.ondragend = () => row.classList.remove('dragging');

    return row;
  }

  // ── Render: Board Card ──
  function renderBoardCard(task) {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.dataset.taskId = task.id;

    let meta = '';
    if (task.dueDate) {
      const cls = isOverdue(task.dueDate) && !task.completed ? ' overdue' : isToday(task.dueDate) ? ' today' : '';
      meta += `<span class="task-due${cls}">${formatDate(task.dueDate)}</span>`;
    }
    if (task.assignee) {
      const user = state.users.find(u => u.id === task.assignee);
      if (user) meta += `<div class="task-assignee-avatar" style="background:${user.color};color:#fff">${user.initials}</div>`;
    }

    card.innerHTML = `
      <div class="board-card-title">${esc(task.name)}</div>
      <div class="board-card-meta">${meta}</div>
    `;
    card.onclick = () => openTaskDetail(task.id);
    return card;
  }

  // ── Render: Home ──
  function renderHome() {
    const tasksList = $('#home-tasks-list');
    tasksList.innerHTML = '';
    const myTasks = state.tasks.filter(t => (t.assignee === 'u1' || !t.assignee) && !t.completed).slice(0, 5);
    if (myTasks.length === 0) {
      tasksList.innerHTML = '<p style="color:var(--text-tertiary);font-size:12px">No tasks yet. Create one!</p>';
    }
    myTasks.forEach(t => {
      const item = document.createElement('div');
      item.className = 'home-task-item';
      const cb = document.createElement('div');
      cb.className = 'task-checkbox';
      cb.onclick = (e) => { e.stopPropagation(); completeTask(t.id); renderHome(); };
      const name = document.createElement('span');
      name.className = 'task-name';
      name.textContent = t.name;
      item.appendChild(cb);
      item.appendChild(name);
      if (t.dueDate) {
        const due = document.createElement('span');
        due.className = `task-due${isOverdue(t.dueDate) ? ' overdue' : ''}`;
        due.textContent = formatDate(t.dueDate);
        item.appendChild(due);
      }
      item.onclick = () => openTaskDetail(t.id);
      tasksList.appendChild(item);
    });

    const projectsList = $('#home-projects-list');
    projectsList.innerHTML = '';
    state.projects.slice(0, 4).forEach(p => {
      const item = document.createElement('div');
      item.className = 'home-task-item';
      item.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>
        <span class="task-name">${esc(p.name)}</span>
        <span class="task-due">${state.tasks.filter(t => t.projectId === p.id && !t.completed).length} tasks</span>`;
      item.onclick = () => openProject(p.id);
      projectsList.appendChild(item);
    });

    const peopleList = $('#home-people-list');
    peopleList.innerHTML = '';
    state.users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'home-task-item';
      item.innerHTML = `<div class="task-assignee-avatar" style="background:${u.color};color:#fff">${u.initials}</div>
        <span class="task-name">${esc(u.name)}</span>`;
      peopleList.appendChild(item);
    });

    $('#private-notepad').value = state.notepad;
  }

  // ── Render: My Tasks ──
  function renderMyTasks() {
    const sections = [
      { id: 'recently-assigned', el: '#recently-assigned-tasks', filter: t => !t.completed && !isToday(t.dueDate) && !t.dueDate },
      { id: 'today', el: '#today-tasks', filter: t => !t.completed && isToday(t.dueDate) },
      { id: 'upcoming', el: '#upcoming-tasks', filter: t => !t.completed && t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate) },
      { id: 'later', el: '#later-tasks', filter: t => t.completed },
    ];

    const myTasks = state.tasks.filter(t => t.assignee === 'u1' || !t.assignee);

    sections.forEach(sec => {
      const container = $(sec.el);
      container.innerHTML = '';
      myTasks.filter(sec.filter).forEach(t => container.appendChild(renderTaskRow(t)));
    });
  }

  // ── Render: Board View ──
  function renderBoardView(projectId) {
    const columns = $('#board-columns');
    columns.innerHTML = '';
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    project.sections.forEach(section => {
      const tasks = state.tasks.filter(t => t.projectId === projectId && t.sectionId === section.id && !t.completed);
      const col = document.createElement('div');
      col.className = 'board-column';
      col.dataset.sectionId = section.id;
      col.innerHTML = `
        <div class="board-column-header">${esc(section.name)} <span class="count">${tasks.length}</span></div>
        <div class="board-column-body"></div>
        <div class="board-add-card" data-section="${section.id}">+ Add task</div>
      `;
      const body = col.querySelector('.board-column-body');
      tasks.forEach(t => body.appendChild(renderBoardCard(t)));

      body.ondragover = (e) => { e.preventDefault(); body.classList.add('drag-over'); };
      body.ondragleave = () => body.classList.remove('drag-over');
      body.ondrop = (e) => {
        e.preventDefault();
        body.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const task = state.tasks.find(t => t.id === taskId);
        if (task) { task.sectionId = section.id; saveState(); renderCurrentView(); }
      };

      col.querySelector('.board-add-card').onclick = () => {
        const task = createTask({ name: 'New Task', projectId, sectionId: section.id });
        renderCurrentView();
        openTaskDetail(task.id);
      };

      columns.appendChild(col);
    });
  }

  // ── Render: Calendar View ──
  function renderCalendarView() {
    const container = $('#calendar-view');
    container.innerHTML = '';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:0 40px';
    header.innerHTML = `
      <button class="btn-secondary" id="cal-prev">&lt;</button>
      <h3>${monthNames[month]} ${year}</h3>
      <button class="btn-secondary" id="cal-next">&gt;</button>
    `;
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => {
      const cell = document.createElement('div');
      cell.className = 'calendar-header-cell';
      cell.textContent = d;
      grid.appendChild(cell);
    });

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell other-month';
      cell.innerHTML = `<div class="calendar-day-num">${daysInPrevMonth - firstDay + 1 + i}</div>`;
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      if (day === now.getDate() && month === now.getMonth()) cell.classList.add('today');
      cell.innerHTML = `<div class="calendar-day-num">${day}</div>`;

      const dayTasks = state.tasks.filter(t => t.dueDate === dateStr && !t.completed);
      dayTasks.forEach(t => {
        const project = state.projects.find(p => p.id === t.projectId);
        const el = document.createElement('div');
        el.className = 'calendar-task';
        el.style.background = project ? project.color + '22' : 'var(--bg-hover)';
        el.style.color = project ? project.color : 'var(--text-primary)';
        el.textContent = t.name;
        el.onclick = () => openTaskDetail(t.id);
        cell.appendChild(el);
      });

      grid.appendChild(cell);
    }

    const remaining = 7 - ((firstDay + daysInMonth) % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<div class="calendar-day-num">${i}</div>`;
        grid.appendChild(cell);
      }
    }

    container.appendChild(grid);
  }

  // ── Render: Project ──
  function renderProject(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    $('#project-name').textContent = project.name;
    $('#project-icon').style.background = project.color;
    $('#project-icon').textContent = project.name[0]?.toUpperCase() || 'P';
    const star = $('#project-star');
    star.textContent = project.starred ? '★' : '☆';
    star.className = `star-btn${project.starred ? ' starred' : ''}`;

    const sections = $('#project-tasks-sections');
    sections.innerHTML = '';

    project.sections.forEach(sec => {
      const tasks = state.tasks.filter(t => t.projectId === projectId && t.sectionId === sec.id);
      const secEl = document.createElement('div');
      secEl.className = 'task-section';
      secEl.dataset.sectionId = sec.id;

      const header = document.createElement('div');
      header.className = 'section-header';
      header.innerHTML = `
        <button class="section-collapse">&#x25BE;</button>
        <span class="section-name" contenteditable="true">${esc(sec.name)}</span>
        <button class="section-add-task">+ Add task</button>
      `;

      header.querySelector('.section-collapse').onclick = function () {
        this.classList.toggle('collapsed');
        taskList.classList.toggle('hidden');
      };

      header.querySelector('.section-name').onblur = function () {
        sec.name = this.textContent.trim() || sec.name;
        saveState();
        renderSidebar();
      };

      header.querySelector('.section-add-task').onclick = () => {
        const task = createTask({ name: 'New Task', projectId, sectionId: sec.id });
        renderCurrentView();
        openTaskDetail(task.id);
      };

      const taskList = document.createElement('div');
      taskList.className = 'task-list';

      taskList.ondragover = (e) => { e.preventDefault(); };
      taskList.ondrop = (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const task = state.tasks.find(t => t.id === taskId);
        if (task) { task.sectionId = sec.id; task.projectId = projectId; saveState(); renderCurrentView(); }
      };

      tasks.forEach(t => taskList.appendChild(renderTaskRow(t)));

      secEl.appendChild(header);
      secEl.appendChild(taskList);
      sections.appendChild(secEl);
    });
  }

  // ── Render: Inbox ──
  function renderInbox() {
    const list = $('#inbox-list');
    list.innerHTML = '';

    if (state.inbox.length === 0) {
      list.classList.add('hidden');
      $('#inbox-empty').classList.remove('hidden');
      return;
    }
    list.classList.remove('hidden');
    $('#inbox-empty').classList.add('hidden');

    state.inbox.forEach(item => {
      const el = document.createElement('div');
      el.className = `inbox-item${item.read ? '' : ' unread'}`;
      const sender = state.users.find(u => u.id === item.senderId) || state.users[0];
      el.innerHTML = `
        <div class="inbox-avatar" style="background:${sender.color};color:#fff">${sender.initials}</div>
        <div class="inbox-body">
          <div class="inbox-sender">${esc(sender.name)}</div>
          <div class="inbox-subject">${esc(item.message)}</div>
        </div>
        <span class="inbox-time">${timeAgo(item.createdAt)}</span>
        <div class="inbox-actions">
          <button title="Archive" onclick="this.closest('.inbox-item').remove()">&#x1F4E6;</button>
        </div>
      `;
      el.onclick = () => {
        item.read = true;
        saveState();
        renderInbox();
        updateBadges();
      };
      list.appendChild(el);
    });
  }

  // ── Render: Reporting ──
  function renderReporting() {
    const completedChart = $('#chart-completed');
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pct = total ? Math.round(completed / total * 100) : 0;
    completedChart.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:36px;font-weight:700;color:var(--accent)">${completed}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${pct}% of ${total} tasks</div>
        <div style="margin-top:8px;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--success);border-radius:4px"></div>
        </div>
      </div>`;

    const statusChart = $('#chart-status');
    const statuses = {
      'To Do': state.tasks.filter(t => !t.completed && !t.sectionId).length,
      'In Progress': state.tasks.filter(t => !t.completed && t.sectionId).length,
      'Done': completed,
    };
    statusChart.innerHTML = Object.entries(statuses).map(([k, v]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="flex:1;font-size:12px">${k}</div>
        <div style="font-weight:600">${v}</div>
      </div>`).join('');

    const deadlineChart = $('#chart-deadlines');
    const upcoming = state.tasks.filter(t => !t.completed && t.dueDate && !isOverdue(t.dueDate))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    deadlineChart.innerHTML = upcoming.length ? upcoming.map(t => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px">
        <span>${esc(t.name)}</span>
        <span style="margin-left:auto;color:var(--text-tertiary)">${formatDate(t.dueDate)}</span>
      </div>`).join('') : '<span style="font-size:12px;color:var(--text-tertiary)">No upcoming deadlines</span>';
  }

  // ── Render: Goals ──
  function renderGoals() {
    const list = $('#goals-list');
    list.innerHTML = '';
    if (state.goals.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No goals yet</p><p class="empty-subtitle">Set goals to track what matters most</p></div>';
      return;
    }
    state.goals.forEach(g => {
      const el = document.createElement('div');
      el.className = 'goal-item';
      const owner = state.users.find(u => u.id === g.owner);
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span class="status-dot ${g.status.replace(' ', '-')}"></span>
          <strong>${esc(g.name)}</strong>
          ${g.dueDate ? `<span class="task-due" style="margin-left:auto">${formatDate(g.dueDate)}</span>` : ''}
        </div>
        <div class="goal-progress"><div class="goal-progress-bar" style="width:${g.progress}%"></div></div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;color:var(--text-tertiary)">
          ${owner ? `<div class="task-assignee-avatar" style="background:${owner.color};color:#fff;width:18px;height:18px;font-size:9px">${owner.initials}</div>` : ''}
          <span>${g.progress}% complete</span>
        </div>
      `;
      list.appendChild(el);
    });
  }

  // ── Render: Portfolios ──
  function renderPortfolios() {
    const list = $('#portfolio-list');
    list.innerHTML = '';
    if (state.portfolios.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No portfolios yet</p><p class="empty-subtitle">Monitor a collection of projects in one place</p></div>';
      return;
    }
    state.portfolios.forEach(p => {
      const el = document.createElement('div');
      el.className = 'portfolio-card';
      el.innerHTML = `<strong>${esc(p.name)}</strong><span style="margin-left:auto;color:var(--text-tertiary)">${p.projects?.length || 0} projects</span>`;
      list.appendChild(el);
    });
  }

  // ── Render: Status Updates ──
  function renderStatusUpdates() {
    const list = $('#status-updates-list');
    list.innerHTML = '';
    if (state.statusUpdates.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No status updates</p></div>';
      return;
    }
    state.statusUpdates.forEach(s => {
      const el = document.createElement('div');
      el.className = 'status-item';
      el.innerHTML = `
        <div class="status-header">
          <span class="status-dot ${s.status}"></span>
          <strong>${esc(s.title)}</strong>
          <span style="margin-left:auto;font-size:11px;color:var(--text-tertiary)">${timeAgo(s.createdAt)}</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary)">${esc(s.text)}</p>
      `;
      list.appendChild(el);
    });
  }

  // ── Task Detail Panel ──
  function openTaskDetail(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    state.selectedTask = task;

    const panel = $('#task-detail-panel');
    panel.classList.remove('hidden');

    $('#task-detail-name').textContent = task.name;
    $('#task-detail-name').onblur = () => {
      task.name = $('#task-detail-name').textContent.trim() || task.name;
      saveState();
      renderCurrentView();
    };

    const completeBtn = $('#task-mark-complete');
    completeBtn.className = `complete-btn${task.completed ? ' completed' : ''}`;
    completeBtn.onclick = () => {
      completeTask(task.id);
      completeBtn.className = `complete-btn${task.completed ? ' completed' : ''}`;
      renderCurrentView();
    };

    // Assignee
    const assignee = state.users.find(u => u.id === task.assignee);
    $('#task-assignee').textContent = assignee ? assignee.name : 'Unassigned';
    $('#task-assignee').onclick = () => {
      const menu = document.createElement('div');
      menu.style.cssText = 'position:fixed;background:var(--bg-modal);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:9999;padding:4px;min-width:160px';
      const rect = $('#task-assignee').getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = rect.bottom + 4 + 'px';

      [{ id: null, name: 'Unassigned' }, ...state.users].forEach(u => {
        const opt = document.createElement('div');
        opt.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;border-radius:var(--radius-sm)';
        opt.textContent = u.name;
        opt.onmouseenter = () => opt.style.background = 'var(--bg-hover)';
        opt.onmouseleave = () => opt.style.background = '';
        opt.onclick = () => { task.assignee = u.id; saveState(); menu.remove(); openTaskDetail(task.id); renderCurrentView(); };
        menu.appendChild(opt);
      });

      document.body.appendChild(menu);
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
      setTimeout(() => document.addEventListener('click', close), 0);
    };

    // Due date
    $('#task-due-date').value = task.dueDate || '';
    $('#task-due-date').onchange = () => {
      task.dueDate = $('#task-due-date').value || null;
      saveState();
      renderCurrentView();
    };

    // Priority
    $('#task-priority').value = task.priority || '';
    $('#task-priority').onchange = () => {
      task.priority = $('#task-priority').value || null;
      saveState();
      renderCurrentView();
    };

    // Projects
    const project = state.projects.find(p => p.id === task.projectId);
    $('#task-projects').textContent = project ? project.name : 'None';

    // Tags
    $('#task-tags').textContent = task.tags.length ? task.tags.join(', ') : 'Add tags';

    // Description
    $('#task-description').textContent = task.description;
    $('#task-description').onblur = () => {
      task.description = $('#task-description').textContent;
      saveState();
    };

    // Subtasks
    renderSubtasks(task);

    // Comments/Activity
    renderActivity(task);

    // Like
    $('#task-like').textContent = task.liked ? '\u{1F44D}\u{FE0F}' : '\u{1F44D}';
    $('#task-like').onclick = () => {
      task.liked = !task.liked;
      task.likes += task.liked ? 1 : -1;
      saveState();
      openTaskDetail(task.id);
    };

    // Copy link
    $('#task-copy-link').onclick = () => {
      navigator.clipboard?.writeText(`asana-clone://task/${task.id}`);
      showToast('Link copied');
    };

    // More actions
    $('#task-more').onclick = (e) => {
      const menu = document.createElement('div');
      menu.style.cssText = 'position:fixed;background:var(--bg-modal);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:9999;padding:4px;min-width:160px';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      const actions = [
        { label: 'Duplicate task', fn: () => { const dup = createTask({ ...task, name: task.name + ' (copy)' }); dup.id = genId(); renderCurrentView(); } },
        { label: 'Convert to subtask', fn: () => showToast('Not available') },
        { label: 'Print task', fn: () => window.print() },
        { type: 'separator' },
        { label: 'Delete task', danger: true, fn: () => { deleteTask(task.id); renderCurrentView(); } },
      ];

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
    };
  }

  function hideTaskDetail() {
    $('#task-detail-panel').classList.add('hidden');
    state.selectedTask = null;
  }

  function renderSubtasks(task) {
    const list = $('#task-subtasks-list');
    list.innerHTML = '';
    task.subtasks.forEach((st, i) => {
      const row = document.createElement('div');
      row.className = 'subtask-row';
      const cb = document.createElement('div');
      cb.className = `task-checkbox${st.completed ? ' checked' : ''}`;
      cb.textContent = st.completed ? '✓' : '';
      cb.onclick = () => { st.completed = !st.completed; saveState(); renderSubtasks(task); };
      const name = document.createElement('span');
      name.className = 'task-name';
      name.contentEditable = true;
      name.textContent = st.name;
      name.style.textDecoration = st.completed ? 'line-through' : 'none';
      name.onblur = () => { st.name = name.textContent.trim() || st.name; saveState(); };
      row.appendChild(cb);
      row.appendChild(name);
      list.appendChild(row);
    });

    $('#add-subtask-btn').onclick = () => {
      task.subtasks.push({ id: genId(), name: 'New subtask', completed: false });
      saveState();
      renderSubtasks(task);
      const last = list.lastElementChild?.querySelector('.task-name');
      if (last) { last.focus(); selectAll(last); }
    };
  }

  function renderActivity(task) {
    const list = $('#task-activity-list');
    list.innerHTML = '';
    task.comments.forEach(c => {
      const user = state.users.find(u => u.id === c.userId) || state.users[0];
      const el = document.createElement('div');
      el.className = 'activity-item';
      el.innerHTML = `
        <div class="activity-avatar" style="background:${user.color};color:#fff">${user.initials}</div>
        <div class="activity-content">
          <span class="activity-author">${esc(user.name)}<span class="activity-time">${timeAgo(c.createdAt)}</span></span>
          <div class="activity-text">${esc(c.text)}</div>
        </div>
      `;
      list.appendChild(el);
    });

    $('#send-comment').onclick = () => {
      const editor = $('#comment-editor');
      const text = editor.textContent.trim();
      if (!text) return;
      task.comments.push({ id: genId(), userId: 'u1', text, createdAt: Date.now() });
      editor.textContent = '';
      saveState();
      renderActivity(task);
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
    }
  }

  function openProject(projectId) {
    state.currentProject = projectId;
    state.currentView = 'project';
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-project').classList.add('active');
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    renderProject(projectId);
    updateBreadcrumb();
  }

  function updateBreadcrumb() {
    const bc = $('#breadcrumb');
    if (state.currentView === 'project' && state.currentProject) {
      const p = state.projects.find(pr => pr.id === state.currentProject);
      bc.textContent = p ? p.name : '';
    } else {
      const names = { home: 'Home', 'my-tasks': 'My Tasks', inbox: 'Inbox', reporting: 'Reporting', portfolios: 'Portfolios', goals: 'Goals', 'status-updates': 'Status Updates' };
      bc.textContent = names[state.currentView] || '';
    }
  }

  function updateBadges() {
    const unreadCount = state.inbox.filter(i => !i.read).length;
    const badge = $('#notification-badge');
    const inboxBadge = $('#inbox-badge');
    if (unreadCount > 0) {
      badge.classList.remove('hidden');
      badge.textContent = unreadCount;
      inboxBadge.classList.remove('hidden');
      inboxBadge.textContent = unreadCount;
    } else {
      badge.classList.add('hidden');
      inboxBadge.classList.add('hidden');
    }
  }

  // ── Tabs (Electron) ──
  function renderTabs(tabsData) {
    const container = $('#tabs-container');
    container.innerHTML = '';
    tabsData.forEach(tab => {
      const el = document.createElement('div');
      el.className = `tab${tab.active ? ' active' : ''}`;
      el.innerHTML = `<span class="tab-title">${esc(tab.title)}</span><button class="tab-close" data-tab-id="${tab.id}">&times;</button>`;
      el.onclick = () => window.electronInjectedApi?.switchToTab(tab.id);
      el.querySelector('.tab-close').onclick = (e) => {
        e.stopPropagation();
        window.electronInjectedApi?.closeTab(tab.id);
      };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        window.electronInjectedApi?.showTabContextMenu(tab.id);
      };
      container.appendChild(el);
    });
  }

  // ── Theme ──
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    $('#topbar').style.background = state.topbarColor;
    $('#sidebar').style.background = state.sidebarColor;
  }

  // ── Modals ──
  function openModal(id) {
    $(`#${id}`).classList.remove('hidden');
  }
  function closeModal(id) {
    $(`#${id}`).classList.add('hidden');
  }

  function initModals() {
    $$('.modal-close').forEach(btn => {
      btn.onclick = () => btn.closest('.modal').classList.add('hidden');
    });
    $$('.modal-overlay').forEach(overlay => {
      overlay.onclick = () => overlay.closest('.modal').classList.add('hidden');
    });
  }

  // ── Create Task Modal ──
  function initCreateTaskModal() {
    const populateSelects = () => {
      const assigneeSel = $('#new-task-assignee');
      assigneeSel.innerHTML = '<option value="">Unassigned</option>';
      state.users.forEach(u => {
        assigneeSel.innerHTML += `<option value="${u.id}">${esc(u.name)}</option>`;
      });

      const projectSel = $('#new-task-project');
      projectSel.innerHTML = '<option value="">None</option>';
      state.projects.forEach(p => {
        projectSel.innerHTML += `<option value="${p.id}">${esc(p.name)}</option>`;
      });

      $('#new-task-project').onchange = () => {
        const pid = $('#new-task-project').value;
        const sectionSel = $('#new-task-section');
        sectionSel.innerHTML = '<option value="">Default</option>';
        if (pid) {
          const project = state.projects.find(p => p.id === pid);
          project?.sections.forEach(s => {
            sectionSel.innerHTML += `<option value="${s.id}">${esc(s.name)}</option>`;
          });
        }
      };
    };

    $('#btn-create').onclick = () => {
      populateSelects();
      openModal('create-task-modal');
      $('#new-task-name').focus();
    };

    $('#create-task-submit').onclick = () => {
      const name = $('#new-task-name').value.trim();
      if (!name) { $('#new-task-name').focus(); return; }
      const task = createTask({
        name,
        description: $('#new-task-description')?.textContent || '',
        assignee: $('#new-task-assignee').value || null,
        dueDate: $('#new-task-due').value || null,
        projectId: $('#new-task-project').value || null,
        sectionId: $('#new-task-section').value || null,
        priority: $('#new-task-priority').value || null,
      });
      closeModal('create-task-modal');
      $('#new-task-name').value = '';
      renderCurrentView();
      showToast(`Task "${name}" created`);
    };
  }

  // ── Create Project Modal ──
  function initCreateProjectModal() {
    let selectedColor = '#6d6e6f';
    $('#add-project-sidebar').onclick = () => openModal('create-project-modal');

    $$('#color-picker .color-swatch').forEach(sw => {
      sw.onclick = () => {
        $$('#color-picker .color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
      };
    });

    $('#create-project-submit').onclick = () => {
      const name = $('#new-project-name').value.trim();
      if (!name) return;
      createProject({
        name,
        color: selectedColor,
        defaultView: $('#new-project-view').value,
        privacy: $('#new-project-privacy').value,
      });
      closeModal('create-project-modal');
      $('#new-project-name').value = '';
      renderSidebar();
      showToast(`Project "${name}" created`);
    };
  }

  // ── Settings Modal ──
  function initSettingsModal() {
    $('#user-avatar').onclick = () => openModal('settings-modal');

    $$('.settings-nav').forEach(nav => {
      nav.onclick = () => {
        $$('.settings-nav').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        $$('.settings-panel').forEach(p => p.classList.remove('active'));
        $(`#settings-${nav.dataset.settings}`).classList.add('active');
      };
    });

    $$('input[name="theme"]').forEach(radio => {
      radio.onchange = () => {
        state.theme = radio.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : radio.value;
        saveState();
        applyTheme();
      };
    });

    $$('#sidebar-color-picker .color-swatch').forEach(sw => {
      sw.onclick = () => {
        $$('#sidebar-color-picker .color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        state.sidebarColor = sw.dataset.color;
        saveState();
        applyTheme();
      };
    });

    $$('#topbar-color-picker .color-swatch').forEach(sw => {
      sw.onclick = () => {
        $$('#topbar-color-picker .color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        state.topbarColor = sw.dataset.color;
        saveState();
        applyTheme();
        window.electronInjectedApi?.sendColorThemeProps({ theme: state.theme, topbarColor: state.topbarColor });
      };
    });

    $('#compact-mode').onchange = () => {
      state.compactMode = $('#compact-mode').checked;
      document.body.classList.toggle('compact', state.compactMode);
      saveState();
    };
  }

  // ── Share Modal ──
  function initShareModal() {
    $('#share-project')?.addEventListener('click', () => {
      openModal('share-modal');
      renderShareMembers();
    });

    $('#copy-project-link').onclick = () => {
      navigator.clipboard?.writeText(`asana-clone://project/${state.currentProject}`);
      showToast('Link copied');
    };

    $('#share-invite-btn').onclick = () => {
      const email = $('#share-email').value.trim();
      if (!email) return;
      showToast(`Invite sent to ${email}`);
      $('#share-email').value = '';
    };
  }

  function renderShareMembers() {
    const list = $('#share-members-list');
    list.innerHTML = '';
    if (!state.currentProject) return;
    const project = state.projects.find(p => p.id === state.currentProject);
    if (!project) return;
    project.members.forEach(uid => {
      const user = state.users.find(u => u.id === uid);
      if (!user) return;
      const el = document.createElement('div');
      el.className = 'member-item';
      el.innerHTML = `
        <div class="task-assignee-avatar" style="background:${user.color};color:#fff">${user.initials}</div>
        <span style="flex:1;font-size:13px">${esc(user.name)}</span>
        <span style="font-size:11px;color:var(--text-tertiary)">Can edit</span>
      `;
      list.appendChild(el);
    });
  }

  // ── Goals & Portfolio creation ──
  function initGoals() {
    $('#create-goal').onclick = () => {
      const name = prompt('Goal name:');
      if (name) {
        createGoal({ name });
        renderGoals();
        showToast(`Goal "${name}" created`);
      }
    };
  }

  function initPortfolios() {
    $('#create-portfolio').onclick = () => {
      const name = prompt('Portfolio name:');
      if (name) {
        state.portfolios.push({ id: genId(), name, projects: [] });
        saveState();
        renderPortfolios();
        showToast(`Portfolio "${name}" created`);
      }
    };
  }

  // ── Section Management ──
  function initSections() {
    $('#add-section-my-tasks').onclick = () => {
      const name = prompt('Section name:');
      if (!name) return;
      const sec = document.createElement('div');
      sec.className = 'task-section';
      // Add to my tasks sections dynamically
      showToast(`Section "${name}" added`);
    };

    $('#add-section-project').onclick = () => {
      if (!state.currentProject) return;
      const project = state.projects.find(p => p.id === state.currentProject);
      if (!project) return;
      const name = prompt('Section name:');
      if (!name) return;
      project.sections.push({ id: genId(), name });
      saveState();
      renderProject(state.currentProject);
      showToast(`Section "${name}" added`);
    };
  }

  // ── Section Add Task Buttons ──
  function initSectionAddTask() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-add-task')) {
        const section = e.target.closest('.task-section');
        const sectionId = section?.dataset.sectionId || section?.dataset.section;
        const task = createTask({
          name: 'New Task',
          sectionId: sectionId || null,
          projectId: state.currentProject || null,
          assignee: state.currentView === 'my-tasks' ? 'u1' : null,
        });
        renderCurrentView();
        openTaskDetail(task.id);
      }
    });
  }

  // ── Project Star Toggle ──
  function initProjectStar() {
    $('#project-star').onclick = () => {
      if (!state.currentProject) return;
      const project = state.projects.find(p => p.id === state.currentProject);
      if (!project) return;
      project.starred = !project.starred;
      saveState();
      renderSidebar();
      renderProject(state.currentProject);
      showToast(project.starred ? 'Project starred' : 'Project unstarred');
    };
  }

  // ── View Tab Switching ──
  function initViewTabs() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('view-tab')) {
        const parent = e.target.closest('.view-header');
        parent?.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const tab = e.target.dataset.tab;

        if (state.currentView === 'my-tasks') {
          const listView = $('#my-tasks-sections');
          const boardView = $('#board-view');
          const calView = $('#calendar-view');
          listView.classList.toggle('hidden', tab !== 'list');
          boardView.classList.toggle('hidden', tab !== 'board');
          calView.classList.toggle('hidden', tab !== 'calendar');
          if (tab === 'board') {
            // Render board for my-tasks
            const cols = $('#board-columns');
            cols.innerHTML = '';
            ['To Do', 'In Progress', 'Done'].forEach(name => {
              const col = document.createElement('div');
              col.className = 'board-column';
              const tasks = name === 'Done' ? state.tasks.filter(t => t.completed && (!t.assignee || t.assignee === 'u1')) :
                name === 'In Progress' ? state.tasks.filter(t => !t.completed && t.dueDate && (!t.assignee || t.assignee === 'u1')) :
                state.tasks.filter(t => !t.completed && !t.dueDate && (!t.assignee || t.assignee === 'u1'));
              col.innerHTML = `<div class="board-column-header">${name} <span class="count">${tasks.length}</span></div><div class="board-column-body"></div>`;
              const body = col.querySelector('.board-column-body');
              tasks.forEach(t => body.appendChild(renderBoardCard(t)));
              cols.appendChild(col);
            });
          }
          if (tab === 'calendar') renderCalendarView();
        } else if (state.currentView === 'project' && state.currentProject) {
          if (tab === 'board') {
            $$('#view-project .task-sections, #view-project .add-section-btn').forEach(el => el.classList.add('hidden'));
            renderBoardView(state.currentProject);
            const boardDiv = document.createElement('div');
            boardDiv.id = 'project-board-view';
          } else if (tab === 'list') {
            $$('#view-project .task-sections, #view-project .add-section-btn').forEach(el => el.classList.remove('hidden'));
          } else if (tab === 'calendar') {
            renderCalendarView();
          }
        }
      }
    });
  }

  // ── Keyboard Shortcuts ──
  function initKeyboardShortcuts() {
    let tabPressed = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.target.closest('[contenteditable], input, textarea, select')) {
        e.preventDefault();
        tabPressed = true;
        setTimeout(() => tabPressed = false, 500);
        return;
      }

      if (tabPressed) {
        switch (e.key.toLowerCase()) {
          case 'n': e.preventDefault(); openModal('create-task-modal'); break;
          case 'h': e.preventDefault(); switchView('home'); break;
          case 'z': e.preventDefault(); switchView('my-tasks'); break;
          case 'i': e.preventDefault(); switchView('inbox'); break;
          case 'b': e.preventDefault(); window.electronInjectedApi?.maybeCloseQuickAddTaskWindow(); break;
          case 'x': e.preventDefault(); toggleSidebar(); break;
          case 'l': if (state.selectedTask) { e.preventDefault(); state.selectedTask.liked = !state.selectedTask.liked; saveState(); openTaskDetail(state.selectedTask.id); } break;
          case 's': if (state.selectedTask) { e.preventDefault(); $('#add-subtask-btn').click(); } break;
        }
        tabPressed = false;
        return;
      }

      if (e.key === '/' && !e.target.closest('[contenteditable], input, textarea')) {
        e.preventDefault();
        $('#global-search').focus();
      }

      if (e.key === 'Escape') {
        $$('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
        hideTaskDetail();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        $('#global-search').focus();
      }
    });
  }

  // ── Global Search ──
  function initSearch() {
    const input = $('#global-search');
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
      searchResults.style.left = rect.left + 'px';
      searchResults.style.top = rect.bottom + 4 + 'px';
      searchResults.style.display = 'block';
      searchResults.innerHTML = '';

      const matchedTasks = state.tasks.filter(t => t.name.toLowerCase().includes(q)).slice(0, 8);
      const matchedProjects = state.projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 4);

      if (matchedProjects.length) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;text-transform:uppercase';
        header.textContent = 'Projects';
        searchResults.appendChild(header);
        matchedProjects.forEach(p => {
          const el = document.createElement('div');
          el.style.cssText = 'padding:8px;cursor:pointer;border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:center;gap:8px';
          el.innerHTML = `<span class="project-dot" style="background:${p.color}"></span>${esc(p.name)}`;
          el.onmouseenter = () => el.style.background = 'var(--bg-hover)';
          el.onmouseleave = () => el.style.background = '';
          el.onclick = () => { openProject(p.id); searchResults.style.display = 'none'; input.value = ''; input.blur(); };
          searchResults.appendChild(el);
        });
      }

      if (matchedTasks.length) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;text-transform:uppercase;margin-top:8px';
        header.textContent = 'Tasks';
        searchResults.appendChild(header);
        matchedTasks.forEach(t => {
          const el = document.createElement('div');
          el.style.cssText = 'padding:8px;cursor:pointer;border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:center;gap:8px';
          el.innerHTML = `<div class="task-checkbox${t.completed ? ' checked' : ''}" style="width:14px;height:14px;font-size:8px">${t.completed ? '✓' : ''}</div>${esc(t.name)}`;
          el.onmouseenter = () => el.style.background = 'var(--bg-hover)';
          el.onmouseleave = () => el.style.background = '';
          el.onclick = () => { openTaskDetail(t.id); searchResults.style.display = 'none'; input.value = ''; input.blur(); };
          searchResults.appendChild(el);
        });
      }

      if (!matchedTasks.length && !matchedProjects.length) {
        searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px">No results</div>';
      }
    };

    input.onblur = () => {
      setTimeout(() => { if (searchResults) searchResults.style.display = 'none'; }, 200);
    };
  }

  // ── Sidebar Toggle ──
  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    $('#sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
  }

  // ── Inbox Archive All ──
  function initInbox() {
    $('#inbox-archive-all').onclick = () => {
      state.inbox = [];
      saveState();
      renderInbox();
      updateBadges();
      showToast('Inbox cleared');
    };

    $('#inbox-filter').onchange = () => {
      renderInbox();
    };
  }

  // ── Detail Close ──
  function initDetailPanel() {
    $('#task-close').onclick = () => hideTaskDetail();
    $('#task-fullscreen').onclick = () => {
      const panel = $('#task-detail-panel');
      if (panel.style.width === '100%') {
        panel.style.width = '';
      } else {
        panel.style.width = '100%';
      }
    };
    $('#task-attach').onclick = () => showToast('Attach file (not implemented in clone)');
    $('#task-subtask').onclick = () => {
      if (state.selectedTask) {
        state.selectedTask.subtasks.push({ id: genId(), name: 'New subtask', completed: false });
        saveState();
        renderSubtasks(state.selectedTask);
      }
    };
  }

  // ── Notepad Persistence ──
  function initNotepad() {
    $('#private-notepad').oninput = () => {
      state.notepad = $('#private-notepad').value;
      saveState();
    };
  }

  // ── Sidebar Navigation ──
  function initNavigation() {
    $$('.nav-item[data-view]').forEach(item => {
      item.onclick = () => switchView(item.dataset.view);
    });

    $$('.widget-link[data-view]').forEach(link => {
      link.onclick = () => switchView(link.dataset.view);
    });

    $('#sidebar-toggle').onclick = () => toggleSidebar();
  }

  // ── Section Collapse ──
  function initSectionCollapse() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-collapse')) {
        e.target.classList.toggle('collapsed');
        const taskList = e.target.closest('.section-header')?.nextElementSibling;
        if (taskList) taskList.classList.toggle('hidden');
      }
      if (e.target.classList.contains('section-toggle')) {
        const items = e.target.closest('.nav-section')?.querySelector('.nav-section-items');
        if (items) items.classList.toggle('hidden');
        e.target.textContent = items?.classList.contains('hidden') ? '▸' : '▾';
      }
    });
  }

  // ── Electron IPC Handlers ──
  function initElectronIPC() {
    const api = window.electronInjectedApi;
    if (!api) return;

    api.registerUpdateTabsHandler((tabs) => renderTabs(tabs));

    api.registerFullScreenHandler((isFs) => {
      document.body.classList.toggle('fullscreen', isFs);
    });

    api.registerMenuBarPreferencesHandler(() => openModal('settings-modal'));

    api.registerNavigateToTaskHandler((taskId) => {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) openTaskDetail(task.id);
    });

    api.registerNavigateToMeetingsPageHandler(() => {
      showToast('Meetings page');
    });

    api.registerNavigateToSettingsHandler(() => openModal('settings-modal'));

    api.registerNavigationHandler((route) => {
      if (route === '/keyboard-shortcuts') openModal('shortcuts-modal');
      else if (route === '/login') showToast('Login page');
    });

    api.registerUpdateColorThemeHandler((props) => {
      if (props.topbarColor) state.topbarColor = props.topbarColor;
      applyTheme();
    });

    api.registerMetaFHandler(() => {
      $('#global-search').focus();
    });

    // Initial tab load
    api.getTabs().then(tabs => renderTabs(tabs));
  }

  // ── Titlebar Window Controls ──
  function initWindowControls() {
    $('#btn-minimize').onclick = () => window.electronInjectedApi?.minimizeWindow();
    $('#btn-maximize').onclick = () => window.electronInjectedApi?.toggleMaximizeWindow();
    $('#btn-close').onclick = () => window.electronInjectedApi?.closeWindow();
    $('#new-tab-btn').onclick = () => window.electronInjectedApi?.createNewTab();
  }

  // ── Notification button ──
  function initNotifications() {
    $('#btn-notifications').onclick = () => switchView('inbox');
    $('#btn-help').onclick = () => openModal('shortcuts-modal');
  }

  // ── Seed Data ──
  function seedIfEmpty() {
    if (state.tasks.length > 0 || state.projects.length > 0) return;

    const p1 = createProject({ name: 'Product Launch', color: '#e8384f' });
    const p2 = createProject({ name: 'Website Redesign', color: '#4573d2' });
    const p3 = createProject({ name: 'Marketing Campaign', color: '#62d26f' });

    const today = todayStr();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    createTask({ name: 'Define product requirements', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u1', dueDate: today, priority: 'high' });
    createTask({ name: 'Design mockups for landing page', projectId: p1.id, sectionId: p1.sections[0].id, assignee: 'u2', dueDate: tomorrow, priority: 'medium' });
    createTask({ name: 'Set up CI/CD pipeline', projectId: p1.id, sectionId: p1.sections[1].id, assignee: 'u3', dueDate: nextWeek, priority: 'high' });
    createTask({ name: 'Write API documentation', projectId: p1.id, sectionId: p1.sections[1].id, assignee: 'u1', dueDate: nextWeek, priority: 'low' });
    createTask({ name: 'Finalize pricing strategy', projectId: p1.id, sectionId: p1.sections[2].id, assignee: 'u4', dueDate: yesterday, priority: 'high' });

    createTask({ name: 'Audit current site performance', projectId: p2.id, sectionId: p2.sections[0].id, assignee: 'u1', dueDate: today });
    createTask({ name: 'Create wireframes', projectId: p2.id, sectionId: p2.sections[0].id, assignee: 'u2', dueDate: tomorrow, priority: 'medium' });
    createTask({ name: 'Implement responsive navigation', projectId: p2.id, sectionId: p2.sections[1].id, assignee: 'u3', dueDate: nextWeek });
    createTask({ name: 'User testing session', projectId: p2.id, sectionId: p2.sections[1].id, assignee: 'u4', dueDate: nextWeek, priority: 'medium' });

    createTask({ name: 'Draft social media calendar', projectId: p3.id, sectionId: p3.sections[0].id, assignee: 'u1', dueDate: tomorrow, priority: 'medium' });
    createTask({ name: 'Design email templates', projectId: p3.id, sectionId: p3.sections[0].id, assignee: 'u2', dueDate: nextWeek });
    createTask({ name: 'Prepare press release', projectId: p3.id, sectionId: p3.sections[1].id, assignee: 'u4', dueDate: nextWeek, priority: 'high' });
    createTask({ name: 'A/B test landing pages', projectId: p3.id, sectionId: p3.sections[1].id, assignee: 'u3' });

    createTask({ name: 'Review quarterly OKRs', assignee: 'u1', dueDate: today, priority: 'high' });
    createTask({ name: 'Update onboarding docs', assignee: 'u1', dueDate: nextWeek });
    createTask({ name: 'Schedule team retro', assignee: 'u1', dueDate: tomorrow, priority: 'low' });

    createGoal({ name: 'Launch v2.0 by Q4', dueDate: '2026-12-31' });
    createGoal({ name: 'Achieve 1000 signups', dueDate: '2026-11-30' });

    state.inbox = [
      { id: genId(), senderId: 'u2', message: 'assigned you "Design mockups for landing page"', read: false, createdAt: Date.now() - 3600000 },
      { id: genId(), senderId: 'u3', message: 'completed "Set up CI/CD pipeline"', read: false, createdAt: Date.now() - 7200000 },
      { id: genId(), senderId: 'u4', message: 'commented on "Finalize pricing strategy"', read: true, createdAt: Date.now() - 86400000 },
    ];

    state.statusUpdates = [
      { id: genId(), title: 'Product Launch', status: 'on-track', text: 'All milestones on schedule. Beta testing begins next week.', createdAt: Date.now() - 86400000 },
      { id: genId(), title: 'Website Redesign', status: 'at-risk', text: 'Design feedback pending. May need to extend timeline.', createdAt: Date.now() - 172800000 },
    ];

    saveState();
  }

  // ── HTML Escape ──
  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
