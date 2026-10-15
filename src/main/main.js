const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme, dialog, shell, screen, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let Store;
try { Store = require('electron-store'); } catch { Store = null; }
const store = Store ? new Store({ name: 'asana-clone-session' }) : null;

let mainWindow = null;
let trayWindow = null;
let quickAddWindow = null;
let aboutWindow = null;
let tray = null;
let isFullScreen = false;
let currentUser = null;
let sessionId = null;
let desktopSettings = { showDesktopNotifications: true, playSound: true };
let openAtLoginSettings = { openAtLogin: false };
let globalKeyboardShortcuts = { quickAddTask: 'CommandOrControl+Shift+A' };
let colorThemeProps = { theme: 'light', topbarColor: '#f06a6a' };
let pendingUpdateVersion = null;
let tabs = [];
let activeTabId = null;
let experimentsData = {};
let trayWindowDisplay = 'hidden';
let upcomingMeetings = [];
let activeRecording = null;
let quickAddTaskId = null;
let keyAsanaWindowId = null;
let lastSessionCrashed = false;

// ── Deep link protocol ──
app.setAsDefaultProtocolClient('asana-clone');

// ── Session restore helpers ──
function saveWindowState() {
  if (!store || !mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    store.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    });
    store.set('cleanExit', true);
  } catch {}
}

function loadWindowState() {
  if (!store) return null;
  try {
    const wasClean = store.get('cleanExit', true);
    if (!wasClean) lastSessionCrashed = true;
    store.set('cleanExit', false);
    return store.get('windowState', null);
  } catch { return null; }
}

// ── Window creation ──

function createMainWindow() {
  const saved = loadWindowState();
  const defaults = { width: 1400, height: 900, x: undefined, y: undefined };
  const opts = saved ? { width: saved.width, height: saved.height, x: saved.x, y: saved.y } : defaults;

  mainWindow = new BrowserWindow({
    ...opts,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#1e1f21',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '..', '..', 'static', 'icon.png'),
    show: false
  });

  if (saved?.isMaximized) mainWindow.maximize();
  if (saved?.isFullScreen) mainWindow.setFullScreen(true);

  const defaultTab = { id: uuidv4(), title: 'Home', url: 'asana://home', active: true };
  tabs = [defaultTab];
  activeTabId = defaultTab.id;
  keyAsanaWindowId = mainWindow.id;

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode !== -3) {
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'load-failed.html'));
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('enter-full-screen', () => {
    isFullScreen = true;
    mainWindow.webContents.send('enter-full-screen');
  });
  mainWindow.on('leave-full-screen', () => {
    isFullScreen = false;
    mainWindow.webContents.send('leave-full-screen');
  });
  mainWindow.on('maximize', () => mainWindow.webContents.send('maximize-window'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('unmaximize-window'));

  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 360,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  trayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'tray.html'));
}

function createQuickAddWindow() {
  quickAddWindow = new BrowserWindow({
    width: 520,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  quickAddWindow.loadFile(path.join(__dirname, '..', 'renderer', 'quickadd.html'));
}

function createAboutWindow() {
  if (aboutWindow) { aboutWindow.focus(); return; }
  aboutWindow = new BrowserWindow({
    width: 360,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: true,
    title: 'About Asana Clone',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  aboutWindow.setMenu(null);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1e1f21;color:#f5f4f3;text-align:center}
.icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#4573d2,#7a6ff0);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;margin-bottom:12px}
h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#a2a0a2;margin:2px 0}</style></head>
<body><div class="icon">A</div><h1>Asana Clone</h1><p>Version 1.0.0</p><p>Reverse-engineered from Asana Desktop v2.10.2</p><p>Built with REA &middot; Electron 33</p></body></html>`;
  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  aboutWindow.on('closed', () => { aboutWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'static', 'tray-icon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(icon);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('Asana Clone');
  tray.on('click', () => {
    if (trayWindow && trayWindowDisplay === 'visible') {
      trayWindow.hide();
      trayWindowDisplay = 'hidden';
    } else if (trayWindow) {
      const bounds = tray.getBounds();
      trayWindow.setPosition(bounds.x - 160, bounds.y + bounds.height + 4);
      trayWindow.show();
      trayWindowDisplay = 'visible';
    }
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('tray-window-display-changed', trayWindowDisplay));
  });
}

// ── Menu ──

function buildAppMenu() {
  const template = [
    {
      label: 'Asana Clone',
      submenu: [
        { label: 'About Asana Clone', click: () => createAboutWindow() },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu-bar-preferences-click') },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Task', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('in-app-navigation', '/new-task') },
        { label: 'New Project', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.webContents.send('in-app-navigation', '/new-project') },
        { type: 'separator' },
        {
          label: 'Templates',
          submenu: [
            { label: 'Blank Project', click: () => mainWindow?.webContents.send('create-from-template', 'blank') },
            { label: 'Board Project', click: () => mainWindow?.webContents.send('create-from-template', 'board') },
            { label: 'Sprint Planning', click: () => mainWindow?.webContents.send('create-from-template', 'sprint') },
            { label: 'Product Launch', click: () => mainWindow?.webContents.send('create-from-template', 'product-launch') },
            { label: 'Marketing Campaign', click: () => mainWindow?.webContents.send('create-from-template', 'marketing') },
            { label: 'Event Planning', click: () => mainWindow?.webContents.send('create-from-template', 'event') },
            { label: 'Bug Tracking', click: () => mainWindow?.webContents.send('create-from-template', 'bugs') },
            { label: 'Onboarding', click: () => mainWindow?.webContents.send('create-from-template', 'onboarding') },
          ]
        },
        { type: 'separator' },
        { label: 'Export Project...', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow?.webContents.send('in-app-navigation', '/export') },
        { label: 'Import Project...', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.send('in-app-navigation', '/import') },
        { type: 'separator' },
        { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.print() },
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => createNewTab() },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => closeActiveTab() },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => switchToNextTab() },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => switchToPreviousTab() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Asana Guide', click: () => shell.openExternal('https://asana.com/guide') },
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => mainWindow?.webContents.send('in-app-navigation', '/keyboard-shortcuts') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Tab management ──

function createNewTab(url) {
  const tab = { id: uuidv4(), title: 'New Tab', url: url || 'asana://home', active: true };
  tabs.forEach(t => t.active = false);
  tabs.push(tab);
  activeTabId = tab.id;
  broadcastTabs();
  return tab;
}

function closeActiveTab() {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex(t => t.id === activeTabId);
  tabs.splice(idx, 1);
  const next = tabs[Math.min(idx, tabs.length - 1)];
  next.active = true;
  activeTabId = next.id;
  broadcastTabs();
}

function switchToNextTab() {
  const idx = tabs.findIndex(t => t.id === activeTabId);
  const next = tabs[(idx + 1) % tabs.length];
  tabs.forEach(t => t.active = false);
  next.active = true;
  activeTabId = next.id;
  broadcastTabs();
}

function switchToPreviousTab() {
  const idx = tabs.findIndex(t => t.id === activeTabId);
  const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
  tabs.forEach(t => t.active = false);
  prev.active = true;
  activeTabId = prev.id;
  broadcastTabs();
}

function broadcastTabs() {
  BrowserWindow.getAllWindows().forEach(w => {
    w.webContents.send('update-tabs', tabs);
  });
}

// ══════════════════════════════════════════════════════════════
// IPC Handlers — all 99 original channels + new channels
// ══════════════════════════════════════════════════════════════

// Window management
ipcMain.handle('get-is-full-screen', () => isFullScreen);
ipcMain.handle('toggle-maximize-window', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.handle('get-is-window-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('close-window', () => mainWindow?.close());
ipcMain.handle('hide-window', () => mainWindow?.hide());
ipcMain.on('maximize-window', () => mainWindow?.maximize());
ipcMain.on('unmaximize-window', () => mainWindow?.unmaximize());

// Tab management
ipcMain.handle('create-new-tab', (_, url) => createNewTab(url));
ipcMain.handle('close-tab', (_, tabId) => {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  const wasActive = tabs[idx].id === activeTabId;
  tabs.splice(idx, 1);
  if (wasActive) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    next.active = true;
    activeTabId = next.id;
  }
  broadcastTabs();
});
ipcMain.handle('switch-to-tab', (_, tabId) => {
  tabs.forEach(t => t.active = t.id === tabId);
  activeTabId = tabId;
  broadcastTabs();
});
ipcMain.handle('move-tab', (_, { tabId, newIndex }) => {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  tabs.splice(newIndex, 0, tab);
  broadcastTabs();
});
ipcMain.handle('get-tabs', () => tabs);
ipcMain.handle('show-tab-context-menu', (_, tabId) => {
  const menu = Menu.buildFromTemplate([
    { label: 'Close Tab', click: () => { ipcMain.emit('close-tab', null, tabId); } },
    { label: 'Close Other Tabs', click: () => {
      tabs = tabs.filter(t => t.id === tabId);
      tabs[0].active = true;
      activeTabId = tabs[0].id;
      broadcastTabs();
    }},
    { type: 'separator' },
    { label: 'Duplicate Tab', click: () => createNewTab(tabs.find(t => t.id === tabId)?.url) },
    { label: 'Reload Tab', click: () => mainWindow?.webContents.send('reload-tab', tabId) }
  ]);
  menu.popup({ window: mainWindow });
});
ipcMain.handle('reload-tab', (_, tabId) => {
  mainWindow?.webContents.send('reload-tab', tabId);
});

// Updates
ipcMain.handle('get-pending-update-version', () => pendingUpdateVersion);
ipcMain.handle('download-update-and-restart', () => {
  dialog.showMessageBox(mainWindow, { message: 'Update downloaded. Restarting...', buttons: ['OK'] });
});
ipcMain.handle('restart-for-update', () => { app.relaunch(); app.exit(); });

// Session restore
ipcMain.handle('should-show-session-restore-banner', () => lastSessionCrashed);
ipcMain.handle('respond-to-session-restore', (_, accept) => { lastSessionCrashed = false; });
ipcMain.handle('discard-pending-session-restore', () => { lastSessionCrashed = false; });

// Settings
ipcMain.handle('get-desktop-settings', () => desktopSettings);
ipcMain.handle('set-desktop-settings', (_, settings) => { desktopSettings = { ...desktopSettings, ...settings }; });
ipcMain.handle('get-open-at-login-settings', () => openAtLoginSettings);
ipcMain.handle('set-open-at-login-settings', (_, settings) => {
  openAtLoginSettings = settings;
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
});
ipcMain.handle('get-global-keyboard-shortcut-settings', () => globalKeyboardShortcuts);
ipcMain.handle('set-global-keyboard-shortcut-settings', (_, settings) => {
  globalKeyboardShortcuts = settings;
  registerGlobalShortcuts();
});

// System
ipcMain.handle('get-app-metrics', () => app.getAppMetrics());
ipcMain.handle('get-system-architecture', () => process.arch);

// User
ipcMain.handle('update-current-user', (_, user) => { currentUser = user; });
ipcMain.handle('set-session-id', (_, id) => { sessionId = id; });
ipcMain.handle('set-quick-add-task-id', (_, id) => { quickAddTaskId = id; });

// Navigation
ipcMain.handle('open-task-in-last-focused-asana-window', (_, taskId) => {
  mainWindow?.webContents.send('navigate-to-task-id', taskId);
  mainWindow?.show();
  mainWindow?.focus();
});
ipcMain.handle('open-meetings-page-in-last-focused-asana-window', () => {
  mainWindow?.webContents.send('navigate-to-meetings-page');
  mainWindow?.show();
});
ipcMain.handle('open-last-focused-asana-window', () => {
  mainWindow?.show();
  mainWindow?.focus();
});

// Theme
ipcMain.handle('send-color-theme-props', (_, props) => {
  colorThemeProps = props;
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('update-color-theme', props));
});

// Tray
ipcMain.handle('enable-tray-app', () => { if (!tray) createTray(); });
ipcMain.handle('destroy-tray-app', () => { tray?.destroy(); tray = null; });
ipcMain.handle('get-tray-window-display', () => trayWindowDisplay);
ipcMain.handle('set-tray-window-display', (_, display) => {
  trayWindowDisplay = display;
  if (display === 'visible') trayWindow?.show();
  else trayWindow?.hide();
});
ipcMain.handle('show-tray-window', () => trayWindow?.show());
ipcMain.handle('reload-tray-window', () => trayWindow?.webContents.reload());
ipcMain.handle('play-timer-sound', () => {
  mainWindow?.webContents.send('play-timer-sound');
});

// Notifications
ipcMain.handle('show-app-badge-notification-dot', () => {
  if (process.platform === 'darwin') app.dock?.setBadge('1');
});
ipcMain.handle('hide-app-badge-notification-dot', () => {
  if (process.platform === 'darwin') app.dock?.setBadge('');
});
ipcMain.handle('update-desktop-notification-settings', (_, settings) => {
  desktopSettings = { ...desktopSettings, ...settings };
});
ipcMain.handle('open-notification-settings', () => {
  mainWindow?.webContents.send('navigate-to-settings-dialogue');
});

// Auth / Login
ipcMain.handle('login-initialized', () => {});
ipcMain.handle('initiate-browser-login-flow', () => {
  mainWindow?.webContents.send('in-app-navigation', '/login');
});
ipcMain.handle('initiate-oauth-flow', (_, provider) => {
  mainWindow?.webContents.send('in-app-navigation', `/oauth/${provider}`);
});
ipcMain.handle('initiate-integration-oauth-flow', (_, config) => {
  mainWindow?.webContents.send('in-app-navigation', '/integrations');
});
ipcMain.handle('desktop-start-session', () => {});

// Meeting transcription
ipcMain.handle('is-meeting-transcription-enabled', () => false);
ipcMain.handle('join-and-transcribe-meeting', () => ({ success: false, reason: 'not-implemented' }));
ipcMain.handle('start-local-transcription', () => ({ success: false }));
ipcMain.handle('stop-meeting-transcription', () => {});
ipcMain.handle('prepare-meeting-transcription', () => {});
ipcMain.handle('get-active-recording', () => activeRecording);
ipcMain.handle('set-upcoming-meetings', (_, meetings) => { upcomingMeetings = meetings; });
ipcMain.handle('meeting-transcription-permission-status', () => 'not-determined');
ipcMain.handle('meeting-transcription-request-permission', () => 'denied');
ipcMain.handle('open-meeting-transcription-permissions', () => {});
ipcMain.handle('meeting-transcription-config-changed', () => {});
ipcMain.handle('meeting-transcription-prompt-restart', () => {});
ipcMain.handle('meeting-transcription-zoom-restart-required', () => false);

// Logging
ipcMain.handle('logging-handlers-registered', () => {});
ipcMain.handle('download-log-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `asana-clone-logs-${Date.now()}.txt`,
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  return result.filePath || null;
});
ipcMain.handle('update-experiments-data', (_, data) => { experimentsData = data; });
ipcMain.handle('log-enrollment-events', () => {});

// Quick add
ipcMain.handle('maybe-close-quick-add-task-window', () => {
  quickAddWindow?.hide();
});

// Undo/redo
ipcMain.handle('disable-undo-redo-menu-items', () => {
  const menu = Menu.getApplicationMenu();
  const editMenu = menu?.items.find(i => i.label === 'Edit');
  if (editMenu) {
    editMenu.submenu.items.forEach(item => {
      if (item.role === 'undo' || item.role === 'redo') item.enabled = false;
    });
  }
});
ipcMain.handle('enable-undo-redo-menu-items', () => {
  const menu = Menu.getApplicationMenu();
  const editMenu = menu?.items.find(i => i.label === 'Edit');
  if (editMenu) {
    editMenu.submenu.items.forEach(item => {
      if (item.role === 'undo' || item.role === 'redo') item.enabled = true;
    });
  }
});

// Search
ipcMain.on('meta-f', () => {
  mainWindow?.webContents.send('meta-f');
});

// Key window
ipcMain.handle('get-is-key-asana-window', (e) => {
  return e.sender.id === keyAsanaWindowId;
});
ipcMain.handle('set-is-key-asana-window', (e) => {
  keyAsanaWindowId = e.sender.id;
});

// Preferences
ipcMain.handle('preferences-handler-registered', () => {});
ipcMain.handle('preferences-handler-deregistered', () => {});

// In-app navigation
ipcMain.on('in-app-navigation', (_, route) => {
  mainWindow?.webContents.send('in-app-navigation', route);
});
ipcMain.handle('navigate-to-settings-dialogue', () => {
  mainWindow?.webContents.send('navigate-to-settings-dialogue');
});
ipcMain.handle('open-settings-dialog-in-last-focused-asana-window', () => {
  mainWindow?.webContents.send('navigate-to-settings-dialogue');
  mainWindow?.show();
});

// Luna UI events
ipcMain.on('luna-ui-event', (_, event) => {});
ipcMain.on('luna-ui-event-from-local-content', (_, event) => {});

// Deprecation banner
ipcMain.handle('notify-deprecation-banner-state', () => {});

// Force update
ipcMain.on('force-app-update', () => {
  dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    message: 'A critical update is required. The app will restart.',
    buttons: ['Update Now']
  });
  app.relaunch();
  app.exit();
});

// Session restore banner visibility
ipcMain.handle('hide-session-restore-banner', () => {});

// Recording
ipcMain.handle('active-recording-changed', (_, recording) => {
  activeRecording = recording;
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('active-recording-changed', recording));
});
ipcMain.handle('set-recording-autoshare-meeting-note', () => {});
ipcMain.handle('set-recording-widget-tooltip-expanded', () => {});

// Retry load URL
ipcMain.handle('retry-load-url', () => {
  mainWindow?.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
});

// ══════════════════════════════════════════════════════════════
// NEW IPC channels
// ══════════════════════════════════════════════════════════════

// File attachment dialog
ipcMain.handle('file-attachment-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'] },
    ]
  });
  if (result.canceled) return [];
  return result.filePaths.map(fp => {
    try {
      const stat = fs.statSync(fp);
      return { name: path.basename(fp), path: fp, size: stat.size };
    } catch {
      return { name: path.basename(fp), path: fp, size: 0 };
    }
  });
});

// Export project dialog
ipcMain.handle('export-project-dialog', async (_, { format, data }) => {
  const ext = format === 'json' ? 'json' : 'csv';
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `project-export.${ext}`,
    filters: [{ name: format === 'json' ? 'JSON' : 'CSV', extensions: [ext] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  try {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Import project dialog
ipcMain.handle('import-project-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Project Files', extensions: ['json', 'csv'] },
    ]
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).slice(1);
    return { content, format: ext, fileName: path.basename(filePath) };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Global shortcuts ──

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  if (globalKeyboardShortcuts.quickAddTask) {
    globalShortcut.register(globalKeyboardShortcuts.quickAddTask, () => {
      if (!quickAddWindow) createQuickAddWindow();
      quickAddWindow.show();
      quickAddWindow.focus();
    });
  }
}

// ── Deep link handling ──

function handleDeepLink(url) {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('deep-link-navigate', url);
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', (_, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = argv.find(a => a.startsWith('asana-clone://'));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ── App lifecycle ──

app.whenReady().then(() => {
  buildAppMenu();
  createMainWindow();
  createTrayWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  saveWindowState();
  if (store) store.set('cleanExit', true);
  globalShortcut.unregisterAll();
  tray?.destroy();
});
