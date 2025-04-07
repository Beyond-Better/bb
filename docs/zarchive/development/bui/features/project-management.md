# Project Management Features

## Overview

Beyond Better organizes work around projects, which can be local file collections, Google Docs, Notion workspaces, or other document sources. This document outlines the project management features and their implementation.

## Core Concepts

### 1. Project Types
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
    // Common settings
    rootPath: string;
    description?: string;

    // Type-specific settings
    localSettings?: LocalProjectSettings;
    googleSettings?: GoogleProjectSettings;
    notionSettings?: NotionProjectSettings;
}
```

### 2. Project Access
```typescript
interface ProjectAccess {
    projectId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    permissions: ProjectPermissions;
}

interface ProjectPermissions {
    canEdit: boolean;
    canInvite: boolean;
    canManageSettings: boolean;
    canDelete: boolean;
}
```

## Features

### 1. Project Workspace Selection
- Entry point for BB application
- Lists available projects
- Creates new projects
- Switches between projects

Implementation:
```typescript
// islands/ProjectSelector.tsx
export default function ProjectSelector() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Load projects
    useEffect(() => {
        loadUserProjects();
    }, []);

    // Handle selection
    const handleSelect = (projectId: string) => {
        setSelectedId(projectId);
        // Update URL for Chat interface
        window.location.hash = `projectId=${projectId}`;
    };

    return (
        <Layout>
            <ProjectList
                projects={projects}
                selectedId={selectedId}
                onSelect={handleSelect}
            />
            <NewProjectButton />
        </Layout>
    );
}
```

### 2. Project Creation
Handles different project types:
```typescript
interface ProjectCreationProps {
    onSuccess: (project: Project) => void;
}

function ProjectCreation({ onSuccess }: ProjectCreationProps) {
    const [type, setType] = useState<ProjectType>('local');
    const [settings, setSettings] = useState<ProjectSettings>({
        rootPath: ''
    });

    const handleCreate = async () => {
        const project = await createProject({
            type,
            settings,
            name: settings.name
        });
        onSuccess(project);
    };

    return (
        <div>
            <ProjectTypeSelector
                value={type}
                onChange={setType}
            />
            <ProjectSettingsForm
                type={type}
                settings={settings}
                onChange={setSettings}
            />
            <ActionButton onClick={handleCreate}>
                Create Project
            </ActionButton>
        </div>
    );
}
```

### 3. Project Settings
Manages project configuration:
```typescript
// islands/ProjectSettings.tsx
export default function ProjectSettings() {
    const projectId = getProjectIdFromUrl();
    const [settings, setSettings] = useState<ProjectSettings | null>(null);

    // Load settings
    useEffect(() => {
        if (projectId) {
            loadProjectSettings(projectId);
        }
    }, [projectId]);

    const handleUpdate = async (updates: Partial<ProjectSettings>) => {
        await updateProjectSettings(projectId, updates);
        setSettings(prev => ({ ...prev, ...updates }));
    };

    return (
        <Layout>
            <SettingsForm
                settings={settings}
                onUpdate={handleUpdate}
            />
            <AccessControl projectId={projectId} />
        </Layout>
    );
}
```

## State Management

### 1. Project Context
```typescript
interface ProjectContext {
    currentProject: Project | null;
    userRole: ProjectAccess['role'];
    permissions: ProjectPermissions;
}

const projectContext = signal<ProjectContext>({
    currentProject: null,
    userRole: 'viewer',
    permissions: {
        canEdit: false,
        canInvite: false,
        canManageSettings: false,
        canDelete: false
    }
});
```

### 2. Project Selection Flow
```typescript
async function selectProject(projectId: string) {
    // Load project details
    const project = await loadProject(projectId);
    
    // Update context
    projectContext.value = {
        currentProject: project,
        userRole: project.access.role,
        permissions: project.access.permissions
    };

    // Update URL
    window.location.hash = `projectId=${projectId}`;
}
```

## Integration Points

### 1. Chat Interface
- Receives project context
- Uses project settings
- Respects permissions
- Updates project state

### 2. User Settings
- Default project preferences
- Project view settings
- Notification settings
- Access history

### 3. Billing Plans
- Project limits
- Feature availability
- Team size limits
- Storage quotas

## Implementation Phases

### Phase 1: Basic Project Management
1. Project CRUD operations
2. Local project support
3. Basic settings
4. Project switching

### Phase 2: Enhanced Features
1. Google Docs integration
2. Notion integration
3. Advanced settings
4. Project templates

### Phase 3: Team Features
1. Team management
2. Access control
3. Sharing features
4. Activity tracking

## Testing Strategy

### 1. Project Operations
```typescript
Deno.test({
    name: "Project: creation and settings",
    async fn() {
        // Create project
        const project = await createProject({
            type: 'local',
            settings: { rootPath: '/test' }
        });

        // Update settings
        await updateProjectSettings(project.id, {
            description: 'Test project'
        });

        // Verify
        const updated = await loadProject(project.id);
        assertEquals(updated.settings.description, 'Test project');
    }
});
```

### 2. Access Control
```typescript
Deno.test({
    name: "Project: access control",
    async fn() {
        const project = await createProject({ type: 'local' });
        
        // Grant access
        await grantAccess(project.id, 'user123', 'viewer');
        
        // Verify permissions
        const access = await getProjectAccess(project.id, 'user123');
        assertEquals(access.role, 'viewer');
    }
});
```

## Next Steps

1. Implement project selector island
2. Add project creation flow
3. Create settings management
4. Add access control
5. Integrate with Chat interface