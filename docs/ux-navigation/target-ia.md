# Target information architecture

```mermaid
flowchart TB
  subgraph primary [Primary]
    Home["Home — attention"]
    MyWork["My Work — assigned / inbox / waiting"]
    Projects["Projects — portfolio index"]
    Agents["Agents — Odysseus + automations"]
    Approvals["Approvals — decisions"]
  end
  subgraph context [Contextual]
    Fav["Favorites / Recent projects"]
    RecentChat["Recent conversations ≤5"]
  end
  subgraph admin [Administrative]
    Workspace["Workspace & team"]
    Settings["Settings"]
    Help["Help"]
    Profile["User profile"]
  end
  Home --> Approvals
  MyWork --> Projects
  Projects --> Fav
  Agents --> RecentChat
```

## Primary destinations

1. **Home** — attention only (approvals, blocked, at-risk, due, quiet healthy, recent agent activity).
2. **My Work** — Assigned / Inbox / Waiting; List|Board via existing WorkItemsCenter.
3. **Projects** — portfolio (former Command Center); sidebar tree for favorites/recent.
4. **Agents** — Odysseus default agent + Automations (skills/schedules); activity/updates.
5. **Approvals** — outstanding decisions badge.

## Removed as product concepts

- **More** (submenu eliminated)
- **Command Center** as a nav noun (becomes Projects view label)
- **Work** as primary noun (becomes My Work + Projects)
- Odysseus unique hire card as a peer of primary nav (lives under Agents)

## Administrative (bottom)

Workspace & team · Settings · Help · Profile
