const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronInjectedApi', {
  // Platform info
  platform: process.platform,
  version: '1.0.0',
  areTabsEnabled: true,
  architecture: process.arch,

  // System
  getAppMetrics: () => ipcRenderer.invoke('get-app-metrics'),
  getSystemMemoryInfo: () => process.getSystemMemoryInfo?.() ?? {},
  getCurrentProcessCpuPercentUsage: () => process.getCPUUsage?.()?.percentCPUUsage ?? 0,
  getCurrentProcessMemoryUsage: () => process.memoryUsage(),
  systemArchitecture: () => ipcRenderer.invoke('get-system-architecture'),

  // Window management
  getIsFullScreen: () => ipcRenderer.invoke('get-is-full-screen'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('toggle-maximize-window'),
  getIsWindowMaximized: () => ipcRenderer.invoke('get-is-window-maximized'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),

  // Full screen handlers
  registerFullScreenHandler: (cb) => {
    ipcRenderer.on('enter-full-screen', () => cb(true));
    ipcRenderer.on('leave-full-screen', () => cb(false));
  },
  deregisterFullScreenHandler: () => {
    ipcRenderer.removeAllListeners('enter-full-screen');
    ipcRenderer.removeAllListeners('leave-full-screen');
  },

  // Tab management
  createNewTab: (url) => ipcRenderer.invoke('create-new-tab', url),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  switchToTab: (tabId) => ipcRenderer.invoke('switch-to-tab', tabId),
  moveTab: (tabId, newIndex) => ipcRenderer.invoke('move-tab', { tabId, newIndex }),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  showTabContextMenu: (tabId) => ipcRenderer.invoke('show-tab-context-menu', tabId),
  reloadTab: (tabId) => ipcRenderer.invoke('reload-tab', tabId),
  registerUpdateTabsHandler: (cb) => {
    ipcRenderer.on('update-tabs', (_, tabs) => cb(tabs));
  },

  // Updates
  getPendingUpdateVersion: () => ipcRenderer.invoke('get-pending-update-version'),
  downloadUpdateAndRestart: () => ipcRenderer.invoke('download-update-and-restart'),
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
  registerUpdatePendingHandler: (cb) => {
    ipcRenderer.on('update-pending', (_, version) => cb(version));
  },
  registerForceUpdateHandler: (cb) => {
    ipcRenderer.on('force-app-update', () => cb());
  },

  // Session restore
  shouldShowSessionRestoreBanner: () => ipcRenderer.invoke('should-show-session-restore-banner'),
  respondToSessionRestore: (accept) => ipcRenderer.invoke('respond-to-session-restore', accept),
  discardPendingSessionRestore: () => ipcRenderer.invoke('discard-pending-session-restore'),

  // Menu/preferences
  registerMenuBarPreferencesHandler: (cb) => {
    ipcRenderer.on('menu-bar-preferences-click', () => cb());
  },
  deregisterMenuBarPreferencesHandler: () => {
    ipcRenderer.removeAllListeners('menu-bar-preferences-click');
  },

  // Navigation
  registerNavigateToTaskHandler: (cb) => {
    ipcRenderer.on('navigate-to-task-id', (_, taskId) => cb(taskId));
  },
  registerNavigateToMeetingsPageHandler: (cb) => {
    ipcRenderer.on('navigate-to-meetings-page', () => cb());
  },
  registerNavigateToSettingsHandler: (cb) => {
    ipcRenderer.on('navigate-to-settings-dialogue', () => cb());
  },
  registerNavigationHandler: (cb) => {
    ipcRenderer.on('in-app-navigation', (_, route) => cb(route));
  },

  // Auth / Login
  initializeLogin: () => ipcRenderer.invoke('login-initialized'),
  initiateBrowserLoginFlow: () => ipcRenderer.invoke('initiate-browser-login-flow'),
  initiateOAuthFlow: (provider) => ipcRenderer.invoke('initiate-oauth-flow', provider),
  initiateIntegrationOAuthFlow: (config) => ipcRenderer.invoke('initiate-integration-oauth-flow', config),
  registerOauthCallbackHandler: (cb) => {
    ipcRenderer.on('oauth-callback', (_, data) => cb(data));
  },
  registerSendClientIdToDesktopStartSessionHandler: (cb) => {
    ipcRenderer.on('send-client-id-to-desktop-start-session', (_, id) => cb(id));
  },

  // Notifications
  showAppBadgeNotificationDot: () => ipcRenderer.invoke('show-app-badge-notification-dot'),
  hideAppBadgeNotificationDot: () => ipcRenderer.invoke('hide-app-badge-notification-dot'),
  updateDesktopNotificationSettings: (s) => ipcRenderer.invoke('update-desktop-notification-settings', s),
  openNotificationSettings: () => ipcRenderer.invoke('open-notification-settings'),

  // Theme
  sendColorThemeProps: (props) => ipcRenderer.invoke('send-color-theme-props', props),
  registerUpdateColorThemeHandler: (cb) => {
    ipcRenderer.on('update-color-theme', (_, props) => cb(props));
  },

  // Tray
  enableTrayApp: () => ipcRenderer.invoke('enable-tray-app'),
  destroyTrayApp: () => ipcRenderer.invoke('destroy-tray-app'),
  getTrayWindowDisplay: () => ipcRenderer.invoke('get-tray-window-display'),
  setTrayWindowDisplay: (d) => ipcRenderer.invoke('set-tray-window-display', d),
  showTrayWindow: () => ipcRenderer.invoke('show-tray-window'),
  reloadTrayWindow: () => ipcRenderer.invoke('reload-tray-window'),
  playTimerSound: () => ipcRenderer.invoke('play-timer-sound'),

  // Meeting transcription
  joinAndTranscribeMeeting: (m) => ipcRenderer.invoke('join-and-transcribe-meeting', m),
  startLocalTranscription: () => ipcRenderer.invoke('start-local-transcription'),
  stopMeetingTranscription: () => ipcRenderer.invoke('stop-meeting-transcription'),
  prepareMeetingTranscription: () => ipcRenderer.invoke('prepare-meeting-transcription'),
  isMeetingTranscriptionEnabled: () => ipcRenderer.invoke('is-meeting-transcription-enabled'),
  getActiveRecording: () => ipcRenderer.invoke('get-active-recording'),
  setUpcomingMeetings: (m) => ipcRenderer.invoke('set-upcoming-meetings', m),
  registerMeetingTranscriptionPermissionStatusChangedHandler: (cb) => {
    ipcRenderer.on('meeting-transcription-permission-status-changed', (_, s) => cb(s));
  },
  registerMeetingTranscriptionZoomRestartRequiredChangedHandler: (cb) => {
    ipcRenderer.on('meeting-transcription-zoom-restart-required-changed', (_, r) => cb(r));
  },

  // Settings
  getDesktopSettings: () => ipcRenderer.invoke('get-desktop-settings'),
  setDesktopSettings: (s) => ipcRenderer.invoke('set-desktop-settings', s),
  getGlobalKeyboardShortcutSettings: () => ipcRenderer.invoke('get-global-keyboard-shortcut-settings'),
  setGlobalKeyboardShortcutSettings: (s) => ipcRenderer.invoke('set-global-keyboard-shortcut-settings', s),
  getOpenAtLoginSettings: () => ipcRenderer.invoke('get-open-at-login-settings'),
  setOpenAtLoginSettings: (s) => ipcRenderer.invoke('set-open-at-login-settings', s),

  // User
  updateCurrentUser: (u) => ipcRenderer.invoke('update-current-user', u),
  sendSessionId: (id) => ipcRenderer.invoke('set-session-id', id),
  sendQuickAddTaskId: (id) => ipcRenderer.invoke('set-quick-add-task-id', id),

  // Tasks (window-level)
  openTaskInLastFocusedAsanaWindow: (id) => ipcRenderer.invoke('open-task-in-last-focused-asana-window', id),
  openMeetingsPageInLastFocusedAsanaWindow: () => ipcRenderer.invoke('open-meetings-page-in-last-focused-asana-window'),

  // Logging
  registerLoggingHandlers: () => ipcRenderer.invoke('logging-handlers-registered'),
  downloadLogFile: () => ipcRenderer.invoke('download-log-file'),
  updateExperimentsData: (d) => ipcRenderer.invoke('update-experiments-data', d),

  // Quick add
  maybeCloseQuickAddTaskWindow: () => ipcRenderer.invoke('maybe-close-quick-add-task-window'),

  // Undo/redo
  disableUndoRedoMenuItems: () => ipcRenderer.invoke('disable-undo-redo-menu-items'),
  enableUndoRedoMenuItems: () => ipcRenderer.invoke('enable-undo-redo-menu-items'),

  // Search
  registerMetaFHandler: (cb) => {
    ipcRenderer.on('meta-f', () => cb());
  },

  // Key window
  getIsKeyAsanaWindow: () => ipcRenderer.invoke('get-is-key-asana-window'),
  registerSetIsKeyAsanaWindowHandler: (cb) => {
    ipcRenderer.on('set-is-key-asana-window', () => cb());
  },
});
