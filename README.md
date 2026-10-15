# Asana Clone — Reverse-Engineered Desktop App

A complete, functional clone of Asana Desktop, built by reverse-engineering the original Asana Desktop v2.10.2 (Electron-based) using [REA (Reverse Engineer Anything)](https://github.com/anthropics/rea).

Every subsystem was reconstructed based on REA's analysis of Asana's 398MB evidence file, mapping 16,019 application graph nodes, 99 IPC channels, and the complete `electronInjectedApi` surface.

**7,500+ lines** of hand-written code across 9 source files.

## REA Analysis Results

| Metric | Value |
|---|---|
| Evidence file size | 398 MB |
| Application graph nodes | 16,019 |
| IPC channels discovered | 99 |
| Context Bridge APIs | `electronInjectedApi` (70+ methods) |
| Files in ASAR | 3,761 |
| JS files parsed | 987 |
| Source app version | Asana Desktop v2.10.2 |
| ASAR size | 30.7 MB |

## Architecture

Based on the REA analysis, this clone replicates Asana's core architecture:

```
Main Process (Electron)
├── Window Management (main, tray, quick-add)
├── IPC Handlers (99 channels)
├── Tab Management (create, close, switch, move, context menu, reload)
├── Tray App (timer, today's tasks, quick access)
├── Menu System (Asana Clone, Edit, View, Window, Help)
├── Global Shortcuts (quick-add task)
├── Auto-update System (check, download, restart)
├── Session Restore
├── Meeting Transcription (stub)
└── Dock Badge Notifications

Preload (Context Bridge — electronInjectedApi)
├── Platform info (4 properties)
├── System (5 methods)
├── Window management (6 methods)
├── Full screen handlers (2 methods)
├── Tab management (8 methods)
├── Updates (4 methods)
├── Session restore (3 methods)
├── Menu/preferences (2 methods)
├── Navigation (4 methods)
├── Auth/login (6 methods)
├── Notifications (4 methods)
├── Theme (2 methods)
├── Tray (7 methods)
├── Meeting transcription (10 methods)
├── Settings (6 methods)
├── User (3 methods)
├── Tasks (2 methods)
├── Logging (3 methods)
├── Quick add (1 method)
├── Undo/redo (2 methods)
├── Search (1 method)
└── Key window (2 methods)

Renderer (Workbench)
├── Home Dashboard (tasks, projects, people, private notepad)
├── My Tasks (list, board, calendar views)
├── Inbox (notifications, filter, archive)
├── Project View (overview, list, board, timeline, calendar, workflow, dashboard, messages, files)
├── Reporting (task completion, status breakdown, upcoming deadlines)
├── Portfolios (project collections)
├── Goals (my goals, team goals, company goals, progress tracking)
├── Status Updates (on-track, at-risk, off-track)
├── Task Detail Panel (slide-in: assignee, due date, priority, tags, dependencies, subtasks, comments/activity)
├── Board View (Kanban drag-and-drop)
├── Calendar View (month grid with task placement)
├── Global Search (fuzzy search across tasks and projects)
├── Create Task Modal (full fields)
├── Create Project Modal (color picker, privacy, default view)
├── Share Modal (invite members, copy link)
├── Settings Modal (profile, account, display, notifications, apps/integrations, hacks)
├── Keyboard Shortcuts Modal (all shortcuts documented)
├── Tab Bar (create, close, switch, reorder, context menu)
├── Sidebar (workspace, nav, projects, teams, starred)
├── Topbar (search, create, notifications, user avatar)
├── Toast Notifications
├── Celebration Animation (confetti on task completion)
├── Theme Engine (light, dark, system + custom sidebar/topbar colors)
├── Workspace Persistence (localStorage)
├── Tray Window (focus timer, today's tasks)
└── Quick Add Window (global shortcut task creation)
```

## All 99 IPC Channels (from REA Evidence)

```
active-recording-changed    close-tab               close-window
create-new-tab              desktop-start-session    destroy-tray-window
disable-undo-redo-menu-items                         discard-pending-session-restore
download-log-file           download-update-and-restart
enable-tray-app             enable-undo-redo-menu-items
enter-full-screen           force-app-update
get-active-recording        get-app-metrics          get-desktop-settings
get-is-full-screen          get-is-key-asana-window  get-is-window-maximized
get-open-at-login-settings  get-pending-update-version
get-system-architecture     get-tabs                 get-tray-window-display
hide-app-badge-notification-dot                      hide-session-restore-banner
hide-window                 in-app-navigation        initiate-browser-login-flow
initiate-integration-oauth-flow                      initiate-oauth-flow
is-meeting-transcription-enabled                     join-and-transcribe-meeting
leave-full-screen           log-enrollment-events    logging-handlers-registered
login-initialized           luna-ui-event            luna-ui-event-from-local-content
maximize-window             maybe-close-quick-add-task-window
meeting-transcription-config-changed                 meeting-transcription-permission-status
meeting-transcription-permission-status-changed      meeting-transcription-prompt-restart
meeting-transcription-request-permission             meeting-transcription-zoom-restart-required
meeting-transcription-zoom-restart-required-changed  menu-bar-preferences-click
meta-f                      minimize-window          move-tab
navigate-to-meetings-page   navigate-to-settings-dialogue
navigate-to-task-id         notify-deprecation-banner-state
oauth-callback              open-last-focused-asana-window
open-meeting-transcription-permissions               open-meetings-page-in-last-focused-asana-window
open-notification-settings  open-settings-dialog-in-last-focused-asana-window
open-task-in-last-focused-asana-window               play-timer-sound
preferences-handler-deregistered                     preferences-handler-registered
prepare-meeting-transcription                        reload-tab
reload-tray-window          respond-to-session-restore
restart-for-update          retry-load-url
send-client-id-to-desktop-start-session              send-color-theme-props
set-desktop-settings        set-global-keyboard-shortcut-settings
set-is-key-asana-window     set-open-at-login-settings
set-quick-add-task-id       set-recording-autoshare-meeting-note
set-recording-widget-tooltip-expanded                set-session-id
set-tray-window-display     set-upcoming-meetings
should-show-session-restore-banner                   show-app-badge-notification-dot
show-tab-context-menu       show-tray-window
start-local-transcription   stop-meeting-transcription
switch-to-tab               toggle-maximize-window
tray-window-display-changed unmaximize-window
update-color-theme          update-current-user
update-desktop-notification-settings                 update-experiments-data
update-pending              update-tabs
```

## Features

### Task Management
- Create, edit, delete tasks with full detail panel
- Assignee, due date, priority (low/medium/high), tags, dependencies
- Subtasks with inline editing and completion
- Comments and activity feed
- Like tasks
- Copy task link
- Duplicate, delete, convert operations
- Drag-and-drop between sections

### Views
- **List View**: Section-grouped task lists with collapsible headers
- **Board View**: Kanban columns with drag-and-drop
- **Calendar View**: Month grid showing tasks by due date

### Projects
- Create projects with custom colors (16 colors)
- Section management (add, rename, reorder)
- Star/unstar projects
- Share with members
- 9 view tabs: Overview, List, Board, Timeline, Calendar, Workflow, Dashboard, Messages, Files

### Reporting
- Tasks completed chart with percentage
- Tasks by status breakdown
- Upcoming deadlines list

### Goals & Portfolios
- Create and track goals with progress bars
- Status indicators (on-track, at-risk, off-track)
- Portfolio collections

### Inbox
- Notification feed with unread indicators
- Filter by type (all, unread, mentions, assigned)
- Archive individual or all

### Settings
- **Profile**: Photo, name, email, job title, department, about
- **Account**: Language, 2FA, deactivate
- **Display**: Theme (light/dark/system), sidebar/topbar colors, compact mode, row numbers, colorblind mode
- **Notifications**: Desktop notifications, email frequency, DND
- **Apps**: Google Drive, Teams, Slack, GitHub, Jira, Figma integrations
- **Hacks**: Extra delight, disable celebrations

### Desktop Features (Electron)
- Tab bar with create, close, switch, reorder, context menu
- Tray app with focus timer (25-min Pomodoro) and today's tasks
- Quick-add task window (global shortcut)
- macOS traffic light window controls
- Dock badge notifications
- Full screen support
- Global keyboard shortcuts

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| Tab+N | New task |
| Tab+H | Home |
| Tab+Z | My Tasks |
| Tab+I | Inbox |
| Tab+X | Toggle sidebar |
| / | Search |
| Cmd+F | Search |
| Escape | Close modal/panel |

## Quick Start

```bash
npm install
npm start
```

## Build Distributables

```bash
npm run build:mac    # macOS .dmg
npm run build:win    # Windows .exe
npm run build:linux  # Linux AppImage
```

## Tech Stack

- **Electron 33** — multi-process desktop application
- **Pure HTML/CSS/JS** — no framework, matching Asana's Electron approach
- **localStorage** — workspace persistence
- **REA** — reverse engineering analysis that guided this build

## How It Was Built

1. Cloned [REA (Reverse Engineer Anything)](https://github.com/anthropics/rea)
2. Extracted Asana Desktop's `app.asar` (30.7MB, 3,761 files)
3. Analyzed the preload script and discovered `electronInjectedApi` with 70+ methods
4. Ran `rea analyze-javascript-application` on the ASAR with `--integrity-policy record-and-continue`
5. Produced 398MB of evidence: 16,019 graph nodes, 99 IPC channels, complete Electron boundaries
6. Mapped every IPC channel, context bridge API, and renderer interaction
7. Reconstructed all subsystems based on the evidence

## License

MIT
