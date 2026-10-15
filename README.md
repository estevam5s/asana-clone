# Asana Clone — Reverse-Engineered Desktop App

A complete, functional clone of Asana Desktop, built by reverse-engineering the original Asana Desktop v2.10.2 (Electron-based) using [REA (Reverse Engineer Anything)](https://github.com/anthropics/rea).

Every subsystem was reconstructed based on REA's analysis of Asana's 398MB evidence file, mapping 16,019 application graph nodes, 99 IPC channels, and the complete `electronInjectedApi` surface.

**8,200+ lines** of hand-written code across 9 source files — **30 feature subsystems** fully implemented.

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
├── Session Restore (electron-store)
├── Deep Link Protocol (asana-clone://)
├── File Attachment/Export/Import dialogs
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
├── File operations (3 methods — attach, export, import)
├── Deep link handler (1 method)
└── Key window (2 methods)

Renderer (Workbench — 30 Feature Subsystems)
├── Home Dashboard (tasks, projects, people, private notepad)
├── My Tasks (list, board, calendar views)
├── Inbox (notifications, filter, archive)
├── Project View (overview, list, board, timeline, calendar, workflow, dashboard, messages, forms)
├── Reporting (task completion, status breakdown, upcoming deadlines)
├── Portfolios (project collections)
├── Goals (my goals, team goals, company goals, progress tracking)
├── Status Updates (on-track, at-risk, off-track)
├── Timeline / Gantt (Canvas 2D, date ranges, today line, milestones)
├── Workflow Builder (stage visualization, rule management)
├── Workload View (team capacity across days)
├── Admin Console (users, workspace, security, billing panels)
├── Custom Fields (text, number, dropdown, date, checkbox, people)
├── Rules / Automation Engine (trigger → action, live execution)
├── Rich Text Editing (bold, italic, underline, strike, lists, code, headings)
├── @Mentions (inline user search, keyboard navigation, highlight)
├── Dependencies (blocked-by / blocking, bidirectional linking)
├── Milestones (diamond markers, timeline integration)
├── Approvals (approve/reject workflow, status badges)
├── Recurring Tasks (daily/weekly/monthly/yearly, auto-create next)
├── Multi-homing (tasks in multiple projects)
├── Time Tracking (start/stop timer, manual log, total display)
├── File Attachments (native dialog + web fallback, file list)
├── Batch Operations (multi-select, bulk assign/date/move/complete/delete)
├── Project Templates (4 built-in, save from project, create from template)
├── Task Templates (save task as template)
├── Forms Builder (create forms, add fields, submissions)
├── Messages / Discussions (per-project threaded chat)
├── Project Overview (description, resources, milestones, donut chart)
├── Dashboard Charts (Canvas 2D: bar charts, donut charts, deadlines)
├── Team Management (invite members)
├── Workspace Settings (rename, icon, invite)
├── Guest Access (invite external users with limited access)
├── Export / Import (CSV + JSON export, CSV import)
├── Undo / Redo (50-level stack, Cmd+Z / Cmd+Shift+Z)
├── Enhanced Search (fuzzy across tasks, projects, messages)
├── Deep Link Handler (asana-clone://task/id, asana-clone://project/id)
├── Session Restore (electron-store persistence)
├── Board View (Kanban drag-and-drop)
├── Calendar View (month grid with task placement)
├── Global Search (real-time fuzzy search)
├── Create Task Modal (full fields + milestone/approval type)
├── Create Project Modal (color picker, privacy, default view, templates)
├── Share Modal (invite members, guest access, copy link)
├── Settings Modal (profile, account, display, notifications, apps, hacks)
├── Keyboard Shortcuts Modal
├── Tab Bar (create, close, switch)
├── Sidebar (workspace, nav, projects, teams, starred, templates, admin)
├── Topbar (search, create, timer indicator, notifications)
├── Toast Notifications
├── Celebration Animation (confetti on task completion)
├── Theme Engine (light, dark, system + custom sidebar/topbar colors)
├── Context Menus (task actions, more options)
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

## All 30 Feature Subsystems

### 1. Custom Fields
Create per-project custom fields (text, number, dropdown, date, checkbox, people). Values show on task detail and are persisted per-task.

### 2. Timeline / Gantt View
Canvas 2D rendered timeline with date headers, task bars with start/end dates, today line, milestone diamonds, drag positioning. Zoom controls.

### 3. Workflow Builder
Visual stage flow diagram showing project sections as workflow stages with arrows. Integrated rule management panel.

### 4. Rules / Automation Engine
Event-driven automation: triggers (task-completed, task-created, task-moved, task-assigned) fire actions (move-to-section, assign-to, add-comment, mark-complete). Rules execute live during operations.

### 5. Rich Text Editing
`contentEditable` toolbar with bold, italic, underline, strikethrough, bullet/numbered lists, code blocks, and headings. Applied to task descriptions and comments.

### 6. @Mentions
Type `@` in any contentEditable area to search users. Keyboard arrow navigation, Enter to insert. Mentions render as highlighted inline spans.

### 7. Dependencies
Bidirectional "blocked by" / "blocking" links between tasks. Add/remove from task detail. Dependency tags with one-click removal.

### 8. Milestones
Mark any task as a milestone (diamond icon). Displayed in timeline as diamond markers, in task rows with a milestone badge.

### 9. Approvals
Mark tasks as approvals with approve/reject buttons. Status badges (pending/approved/rejected). Approval completes the task.

### 10. Recurring Tasks
Set daily/weekly/monthly/yearly recurrence with custom intervals. When completed, automatically creates the next occurrence with shifted dates.

### 11. Multi-homing
Tasks can belong to multiple projects simultaneously. Project tags displayed on task rows. Manage from task detail panel.

### 12. Time Tracking
Start/stop timer per task with live display in task detail and topbar indicator. Manual time logging. Total tracked time display.

### 13. File Attachments
Attach files via native Electron dialog (with web fallback). File list with type icons, sizes, and remove button.

### 14. Batch Operations
Checkbox multi-select across tasks. Floating toolbar for bulk assign, set date, move, complete, or delete.

### 15. Project Templates
4 built-in templates (Product Launch, Sprint Planning, Marketing Campaign, Event Planning). Save any project as template. Create from template gallery.

### 16. Task Templates
Save any task configuration as a reusable template from the More Actions menu.

### 17. Forms Builder
Create intake forms per project with custom fields. Add/remove form fields. Submissions list.

### 18. Messages / Discussions
Per-project message thread. Compose and send messages. User avatars, timestamps. Real-time rendering.

### 19. Project Overview
Project description (editable), key resources, milestones list, donut completion chart, project details sidebar.

### 20. Dashboard Charts
Canvas 2D charts per project: tasks by section (bar), completion rate (donut), tasks by assignee (bar), upcoming deadlines list.

### 21. Workload View
Team capacity visualization: users × days grid with task count bars. Over-capacity highlighting.

### 22. Admin Console
4 panels: Users (list + guests), Workspace settings, Security, Billing. Stats cards (users, tasks, projects, completed).

### 23. Team Management
Invite members by email. Team member list display.

### 24. Workspace Settings
Rename workspace, change icon, invite members. Persisted across sessions.

### 25. Guest Access
Invite external users as guests with limited access level. Listed in Admin Console.

### 26. Export / Import
Export tasks as CSV or JSON. Import from CSV files. Format selection modal with progress indicator.

### 27. Undo / Redo
50-level undo/redo stack. Tracks task create, delete, and update operations. Cmd+Z / Cmd+Shift+Z keyboard shortcuts.

### 28. Enhanced Search
Real-time fuzzy search across tasks, projects, and messages. Categorized results dropdown with click-to-navigate.

### 29. Deep Link Handler
`asana-clone://task/{id}` and `asana-clone://project/{id}` protocol handling via Electron.

### 30. Session Restore
Electron-store based session persistence with restore banner on relaunch.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Tab+N | New task |
| Tab+H | Home |
| Tab+Z | My Tasks |
| Tab+I | Inbox |
| Tab+X | Toggle sidebar |
| Tab+E | Export |
| / | Search |
| Cmd+F | Search |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
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
- **Canvas 2D** — timeline, gantt, dashboard charts
- **localStorage** — workspace persistence
- **electron-store** — session restore
- **REA** — reverse engineering analysis that guided this build

## How It Was Built

1. Cloned [REA (Reverse Engineer Anything)](https://github.com/anthropics/rea)
2. Extracted Asana Desktop's `app.asar` (30.7MB, 3,761 files)
3. Analyzed the preload script and discovered `electronInjectedApi` with 70+ methods
4. Ran `rea analyze-javascript-application` on the ASAR with `--integrity-policy record-and-continue`
5. Produced 398MB of evidence: 16,019 graph nodes, 99 IPC channels, complete Electron boundaries
6. Mapped every IPC channel, context bridge API, and renderer interaction
7. Reconstructed all 30 subsystems based on the evidence

## License

MIT
