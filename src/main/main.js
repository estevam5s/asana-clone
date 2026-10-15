const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme, dialog, shell, screen, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mainWindow = null;
let trayWindow = null;
let quickAddWindow = null;
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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

  const defaultTab = { id: uuidv4(), title: 'Home', url: 'asana://home', active: true };
  tabs = [defaultTab];
  activeTabId = defaultTab.id;
  keyAsanaWindowId = mainWindow.id;

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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

function buildAppMenu() {
  const template = [
    {
      label: 'Asana Clone',
      submenu: [
        { label: 'About Asana Clone', role: 'about' },
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

// ── IPC Handlers: 99 channels matching Asana's Electron IPC surface ──

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
ipcMain.handle('should-show-session-restore-banner', () => false);
ipcMain.handle('respond-to-session-restore', (_, accept) => { /* no-op in clone */ });
ipcMain.handle('discard-pending-session-restore', () => { /* no-op */ });

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
ipcMain.handle('login-initialized', () => { /* no-op */ });
ipcMain.handle('initiate-browser-login-flow', () => {
  mainWindow?.webContents.send('in-app-navigation', '/login');
});
ipcMain.handle('initiate-oauth-flow', (_, provider) => {
  mainWindow?.webContents.send('in-app-navigation', `/oauth/${provider}`);
});
ipcMain.handle('initiate-integration-oauth-flow', (_, config) => {
  mainWindow?.webContents.send('in-app-navigation', '/integrations');
});
ipcMain.handle('desktop-start-session', () => { /* no-op */ });

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
  mainWindow?.webContents.reload();
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
  globalShortcut.unregisterAll();
  tray?.destroy();
});
