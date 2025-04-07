# BUI Enhancement Project Plan

## Overview
This document outlines the plan for enhancing the BUI (Browser User Interface) with multiple routes and new features, transforming it from a single-page chat interface into a full-featured application following Fresh's island architecture.

## Project Goals
1. Create a proper multi-route application structure
2. Implement comprehensive project management with multiple project types
3. Add user settings and preferences system
4. Enhance the chat interface with project context
5. Improve server status handling and app installation flow

## Core Types

### Project Types
```typescript
type ProjectType = 'local' | 'gdrive' | 'notion' | 'other';

interface Project {
    id: string;
    name: string;
    type: ProjectType;
    settings: ProjectSettings;
    createdAt: string;
    updatedAt: string;
    ownerId: string;
    teamId?: string;
}

interface ProjectSettings {
    rootPath: string;
    description?: string;
    localSettings?: LocalProjectSettings;
    googleSettings?: GoogleProjectSettings;
    notionSettings?: NotionProjectSettings;
}
```

### User Preferences
```typescript
interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    language: string;
    timezone: string;
    defaultProjectId?: string;
    recentProjects: string[];
    projectViewMode: 'list' | 'grid';
    notificationSettings: {
        email: boolean;
        desktop: boolean;
        types: {
            projectUpdates: boolean;
            teamInvites: boolean;
            systemAlerts: boolean;
        }
    }
}
```

## Implementation Phases

### Phase 1: Navigation & Layout Infrastructure
**Status**: Not Started  
**Estimated Timeline**: 2-3 days

#### Objectives
1. Create new route structure
2. Implement main navigation component
3. Set up layout system with theme support

#### Technical Details
1. Route Structure:
```
routes/
  ├── _app.tsx (existing, update for layout)
  ├── index.tsx (new home page)
  ├── chat/
  │   └── index.tsx (moved from current index)
  ├── projects/
  │   ├── index.tsx (project list)
  │   ├── new.tsx (project creation)
  │   └── [id].tsx (project detail/edit)
  └── settings/
      ├── index.tsx (settings overview)
      ├── profile.tsx (user profile)
      └── preferences.tsx (user preferences)
```

2. Components:
```typescript
// New island components
islands/
  ├── Navigation.tsx (main nav)
  ├── ProjectList.tsx (project management)
  ├── ProjectSelector.tsx (global project context)
  ├── ThemeProvider.tsx (theme management)
  └── UserSettings.tsx (settings panel)

// New static components
components/
  ├── Layout.tsx (main layout structure)
  ├── Header.tsx (app header with nav)
  ├── ProjectCard.tsx (project display)
  └── StatusBar.tsx (server/connection status)
```

### Phase 2: Project Management System
**Status**: Not Started  
**Estimated Timeline**: 4-5 days

#### Objectives
1. Implement project type system
2. Create project CRUD operations
3. Add project access control
4. Integrate with Chat interface

#### Components
```typescript
// Project Management
islands/
  ├── ProjectManager/
  │   ├── index.tsx (main component)
  │   ├── ProjectForm.tsx (create/edit)
  │   ├── ProjectSettings.tsx (configuration)
  │   └── AccessControl.tsx (permissions)
  └── ProjectContext/
      ├── Provider.tsx (context provider)
      └── Selector.tsx (project picker)

// State Management
const projectContext = signal<ProjectContext>({
    currentProject: null,
    userRole: 'viewer',
    permissions: defaultPermissions
});
```

### Phase 3: User Settings & Preferences
**Status**: Not Started  
**Estimated Timeline**: 3-4 days

#### Objectives
1. Implement preferences system
2. Add theme management
3. Create profile settings
4. Add notification preferences

#### Components
```typescript
islands/
  ├── Settings/
  │   ├── index.tsx (main settings)
  │   ├── Profile.tsx (user profile)
  │   ├── Preferences.tsx (user prefs)
  │   └── Notifications.tsx (alerts)
  └── ThemeProvider/
      ├── index.tsx (theme context)
      └── ThemeToggle.tsx (switcher)

// Settings State
const settingsContext = signal<SettingsContext>({
    preferences: defaultPreferences,
    account: defaultAccount,
    updatePreferences: async () => {},
    updateAccount: async () => {}
});
```

### Phase 4: Home Page & Server Status
**Status**: Not Started  
**Estimated Timeline**: 2-3 days

#### Objectives
1. Create welcoming home page
2. Implement server status detection
3. Add download instructions
4. Display project quick access

#### Components
```typescript
islands/
  ├── Home/
  │   ├── index.tsx (main page)
  │   ├── ServerStatus.tsx (status)
  │   └── QuickAccess.tsx (projects)
  └── Installation/
      ├── DownloadGuide.tsx (setup help)
      └── VersionCheck.tsx (compatibility)
```

### Phase 5: Chat Integration
**Status**: Not Started  
**Estimated Timeline**: 2-3 days

#### Objectives
1. Update Chat component for project context
2. Add project selector
3. Integrate with new routing
4. Add project-specific features

#### Changes
```typescript
// Update existing components
islands/Chat/
  ├── index.tsx (main update)
  ├── ProjectHeader.tsx (new)
  └── ProjectContext.tsx (new)

components/Chat/
  ├── ProjectSelector.tsx (new)
  └── ProjectInfo.tsx (new)
```

### Phase 6: Testing & Documentation
**Status**: In Progress  
**Estimated Timeline**: 2-3 days

#### Testing Strategy
Following `docs/development/bui/testing/strategy.md`:

1. Unit Tests:
```typescript
// Example test structure
Deno.test({
    name: 'ProjectManager: creates new project',
    async fn() {
        const manager = new ProjectManager();
        await manager.createProject({
            type: 'local',
            settings: { rootPath: '/test' }
        });
        assertEquals(manager.state.projects.length, 1);
    }
});
```

2. Integration Tests:
- Project type handling
- Settings persistence
- Theme management
- Access control
- WebSocket integration

#### Documentation
1. User Documentation:
- Project management guide
- Settings configuration
- Theme customization
- Installation guide

2. Developer Documentation:
- Component API reference
- State management patterns
- Testing guidelines
- Extension points

## Progress Tracking

### Current Status
- Overall Project Status: Planning Phase
- Current Phase: Documentation & Planning
- Next Phase: Navigation Infrastructure

### Completed Items
- [x] Initial project planning
- [x] Documentation structure
- [x] Phase definitions
- [x] Architecture alignment
- [x] Type definitions

### Next Steps
1. Begin Phase 1 implementation
2. Set up new route structure
3. Create navigation component

## Dependencies
- Fresh framework
- Tailwind CSS
- Preact signals
- Existing BUI components

## Timeline
- Total Estimated Duration: 15-21 days
- Start Date: TBD
- Target Completion: TBD

## Notes
- This document will be updated as the project progresses
- Each phase may be adjusted based on feedback
- Documentation will be maintained throughout
- Regular progress updates will be added

## References
- [BUI Overview](docs/development/bui/overview.md)
- [Component Patterns](docs/development/bui/architecture/components.md)
- [State Management](docs/development/bui/architecture/state-management.md)
- [Testing Strategy](docs/development/bui/testing/strategy.md)
- [Project Management](docs/development/bui/features/project-management.md)
- [User Settings](docs/development/bui/features/user-settings.md)