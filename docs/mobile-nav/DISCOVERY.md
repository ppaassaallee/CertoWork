# Mobile nav — Discovery

## 1. Router / AppShell
| Item | Path | Name |
|------|------|------|
| Router | `src/App.tsx` | `BrowserRouter` → catch-all `<DelivereeWorkspace />` |
| Shell | `src/components/DelivereeWorkspace.tsx` | `DelivereeWorkspace` (`do-shell`, `is-mobile-core`) |
| Lens routes | `src/lib/delivereeRoutes.ts` | `resolveDelivereeLens`, `lensToPath`, `DelivereeLens` |
| Layout stubs | `src/layout/AppShell.tsx`, `Header.tsx`, `Sidebar.tsx` | unused thin wrappers |

## 2. Five main pages
| Page | Path | Component |
|------|------|-----------|
| Home | `/`, `/home` | `src/features/home/HomeCockpit.tsx` |
| My Work | `/my-work/*` | Shell tabs + `MyWorkViewsSurface` / `DailyPlanOverlay` |
| Projects | `/projects` | `ProjectCommandCenter` in `ProjectSurfaces.tsx` |
| Notes | `/notes` | `NotesWorkspace.tsx` |
| Notifications / conversations | no dedicated page | Bell → `AssignmentNotificationsBell`; chat → `/collab` / sidebar `boldi_conversations` |

## 3. Top bar (`do-header` in DelivereeWorkspace)
| Control | Handler |
|---------|---------|
| Hamburger | `setSidebarOpen(true)` |
| Workspace / breadcrumb | Sidebar brand + `AppBreadcrumbs` |
| Bell | `AssignmentNotificationsBell` |
| Odysseus sparkle | `toggleOdysseusPanel` / `openOdysseusPanel` |
| Chat (mobile) | `navigate("/collab")` |
| Gear (mobile) | `navigate("/settings")` |
| Search | `setCommandPaletteOpen(true)` |
| + Create | `setCreateMenuOpen` → inline `.do-create-menu` |

## 4. Drawer
`do-sidebar` in `DelivereeWorkspace`: brand/workspace switcher, search, Home/My Work/Projects/Notes, Favorites/Recent, tables, management (`do-mobile-advanced`), conversations, settings footer.

## 5. Bottom tab bar
| Path | Name |
|------|------|
| `src/hooks/useMobileCore.ts` | `useMobileCore` — `max-width: 760px` |
| `src/lib/mobileCore.ts` | `MOBILE_CORE_TABS`, `mobileCoreTab` |
| Dock | `.do-mobile-dock` — Home / My Work / Projects / Notes |

## 6. Create flow
No `CreateMenu` / `NewItemDialog`. Inline create menu → `QuickCaptureModal` (`features/capture/`), `ItemModal`, project wizard / magic project, `NoteQuickCapture`.

## 7. Odysseus
| Path | Name |
|------|------|
| Panel | `features/odysseus/panel/OdysseusPanel.tsx` |
| Scope | `OdysseusPanelScope` in `panel/types.ts` |
| API | Shell state: `openOdysseusPanel(scope?)` — **not** a React Context |
| Extra entry points | Home “Triage with Odysseus”, Projects “Ask about this portfolio…”, ItemModal, ⌘J |

## 8. Notification sources
| Source | Path |
|--------|------|
| Assignments | `user_notifications` via `AssignmentNotificationsBell` |
| Conversations | `boldi_conversations` in shell |
| Approvals | lens `approvals` / review queue |
| Requests | `RequestsCenter.tsx` |
| Mentions | no dedicated inbox (composer `MentionMenu` only) |
| Routine runs | Home activity list in `HomeCockpit` / `buildHomeCockpitData` |

## 9. My Work
Shell tabs: Assigned / Inbox / Waiting / Today / This week / Week / Captured / Reviews.  
Views: `MyWorkViewsSurface` + `ViewsBar`.  
Daily Plan: `DailyPlanOptIn` (“Try Daily Plan”), `DailyPlanOverlay`, `useDailyPlanEnabled` / `enableDailyPlan`.

## 10. Projects
`ProjectCommandCenter` in `ProjectSurfaces.tsx` (Overview widgets, filters, list). Older `ProjectsList.tsx` still present. Costs via `?view=economics` / finance routes.

## 11. Notes
`NotesWorkspace` + `NotebookSidebar` (Personal / Team) + `NotesList`.

## 12. Dates
No shared `formatDate`. Helpers: `lib/workspaceDisplay.ts` (`timestamp`, `timeAgo`), `notionShortDate`, `formatCheckpointLabel`. Risk: rendering Firestore Timestamp objects as children.

## 13. Design system
`styles/certo-tokens.css`, `index.css`, `components/ui/Button.tsx`, `Icon.tsx` (lucide), custom sheets (DestructiveDialog, Daily Plan sheets). **No vaul / Radix Dialog.**

## 14. Feature flags
`lib/featureFlags.ts`. Mobile rebuild ships to all phone users (no A/B). Daily Plan keeps its per-uid flag.
