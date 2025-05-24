# DUI Configuration Implementation Plan

## Overview

This document details the implementation plan for the Desktop User Interface (DUI) component using the v2 configuration system. As a new component, the DUI will be built directly with v2 configuration support, focusing on:
1. API instance management
2. Project listing and management
3. Configuration editing
4. System monitoring

## Configuration Requirements

### API Management
```typescript
interface ApiInstanceConfig {
  id: string;
  hostname: string;
  port: number;
  useTls: boolean;
  autoStart: boolean;
  status: 'running' | 'stopped' | 'error';
  projects: string[];  // List of project IDs using this API
}

interface ApiManagerConfig {
  instances: ApiInstanceConfig[];
  defaultInstance: string;  // ID of default API instance
  monitoring: {
    checkInterval: number;
    logRetention: number;
    autoRestart: boolean;
  };
}
```

### Project Management
```typescript
interface ProjectManagerConfig {
  recentProjects: Array<{
    id: string;
    name: string;
    path?: string;
    lastAccessed: string;
  }>;
  defaultApiInstance: string;
  viewOptions: {
    groupBy: 'type' | 'api' | 'none';
    sortBy: 'name' | 'lastAccessed' | 'type';
    showArchived: boolean;
  };
}
```

### UI Configuration
```typescript
interface DuiWindowConfig {
  defaultWidth: number;
  defaultHeight: number;
  rememberSize: boolean;
  rememberPosition: boolean;
  theme: 'light' | 'dark' | 'system';
}

interface DuiConfig {
  window: DuiWindowConfig;
  api: ApiManagerConfig;
  projects: ProjectManagerConfig;
}
```

## Implementation Plan

### 1. API Management Interface

```typescript
// dui/src/features/api/ApiManager.tsx
export function ApiManager() {
  const [config, setConfig] = useState<ApiManagerConfig>();
  
  useEffect(() => {
    const loadConfig = async () => {
      const configManager = await getConfigManager();
      const apiConfig = await configManager.getApiConfig();
      setConfig(apiConfig);
    };
    loadConfig();
  }, []);
  
  return (
    <div>
      <ApiInstanceList instances={config?.instances} />
      <ApiControls instance={config?.defaultInstance} />
      <ApiMonitor config={config?.monitoring} />
    </div>
  );
}

// dui/src/features/api/ApiControls.tsx
export function ApiControls({ instance }: { instance: string }) {
  const startApi = async () => {
    const config = await getConfigManager();
    const apiConfig = await config.getApiConfig(instance);
    await ApiService.start(apiConfig);
  };
  
  return (
    <div>
      <button onClick={startApi}>Start API</button>
      {/* Other controls */}
    </div>
  );
}
```

### 2. Project Management Interface

```typescript
// dui/src/features/projects/ProjectManager.tsx
export function ProjectManager() {
  const [config, setConfig] = useState<ProjectManagerConfig>();
  
  useEffect(() => {
    const loadConfig = async () => {
      const configManager = await getConfigManager();
      const projectConfig = await configManager.getProjectManagerConfig();
      setConfig(projectConfig);
    };
    loadConfig();
  }, []);
  
  return (
    <div>
      <ProjectList 
        projects={config?.recentProjects}
        viewOptions={config?.viewOptions}
      />
      <ProjectControls />
    </div>
  );
}

// dui/src/features/projects/ProjectConfig.tsx
export function ProjectConfig({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<ProjectConfig>();
  
  const updateConfig = async (updates: Partial<ProjectConfig>) => {
    const configManager = await getConfigManager();
    await configManager.updateProjectConfig(projectId, updates);
    // Refresh config
  };
  
  return (
    <div>
      <ConfigEditor config={config} onUpdate={updateConfig} />
    </div>
  );
}
```

### 3. Configuration Management

```typescript
// dui/src/services/ConfigService.ts
class ConfigService {
  private config: ConfigManagerV2;
  
  async initialize() {
    this.config = await getConfigManager();
    await this.loadInitialConfig();
  }
  
  async getApiInstance(id: string): Promise<ApiInstanceConfig> {
    return await this.config.getApiInstance(id);
  }
  
  async updateApiInstance(id: string, updates: Partial<ApiInstanceConfig>) {
    await this.config.updateApiInstance(id, updates);
    this.emit('apiConfigChanged', id);
  }
  
  async getProject(id: string): Promise<ProjectConfig> {
    return await this.config.getProjectConfig(id);
  }
  
  async updateProject(id: string, updates: Partial<ProjectConfig>) {
    await this.config.updateProjectConfig(id, updates);
    this.emit('projectConfigChanged', id);
  }
}
```

### 4. Status Monitoring

```typescript
// dui/src/services/MonitoringService.ts
class MonitoringService {
  private config: ConfigManagerV2;
  private intervals: Map<string, number> = new Map();
  
  async startMonitoring(apiId: string) {
    const apiConfig = await this.config.getApiInstance(apiId);
    const interval = setInterval(
      () => this.checkApiStatus(apiId),
      apiConfig.monitoring.checkInterval
    );
    this.intervals.set(apiId, interval as unknown as number);
  }
  
  async checkApiStatus(apiId: string) {
    try {
      const status = await ApiService.getStatus(apiId);
      await this.config.updateApiStatus(apiId, status);
      this.emit('statusUpdate', { apiId, status });
    } catch (error) {
      this.handleMonitoringError(apiId, error);
    }
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
// tests/dui/ApiManager.test.tsx
describe('API Manager', () => {
  test('loads API configuration', async () => {
    const { result } = renderHook(() => useApiManager());
    expect(result.current.config).toBeDefined();
  });
  
  test('starts API instance', async () => {
    const { getByText } = render(<ApiControls instance="default" />);
    await userEvent.click(getByText('Start API'));
    expect(ApiService.start).toHaveBeenCalled();
  });
});

// tests/dui/ProjectManager.test.tsx
describe('Project Manager', () => {
  test('loads project configuration', async () => {
    const { result } = renderHook(() => useProjectManager());
    expect(result.current.projects).toBeDefined();
  });
  
  test('updates project settings', async () => {
    const { getByText } = render(<ProjectConfig projectId="test" />);
    await userEvent.click(getByText('Save'));
    expect(ConfigService.updateProject).toHaveBeenCalled();
  });
});
```

### 2. Integration Tests

```typescript
describe('DUI Integration', () => {
  test('manages API lifecycle', async () => {
    const { getByText } = render(<ApiManager />);
    await userEvent.click(getByText('Start API'));
    expect(await screen.findByText('API Running')).toBeVisible();
  });
  
  test('handles project operations', async () => {
    const { getByText } = render(<ProjectManager />);
    await userEvent.click(getByText('Add Project'));
    expect(ConfigService.createProject).toHaveBeenCalled();
  });
});
```

## Error Handling

```typescript
// dui/src/services/ErrorHandler.ts
class ErrorHandler {
  async handleConfigError(error: Error) {
    if (error instanceof ConfigVersionError) {
      await this.showVersionError();
    } else if (error instanceof ConfigAccessError) {
      await this.showPermissionError();
    } else {
      await this.showGeneralError(error);
    }
  }
  
  async handleApiError(error: Error) {
    if (error instanceof ApiConnectionError) {
      await this.showConnectionError();
    } else {
      await this.showGeneralError(error);
    }
  }
}
```

## Success Criteria

1. API Management
- [ ] View all API instances
- [ ] Start/stop APIs
- [ ] Monitor API status
- [ ] Configure API settings

2. Project Management
- [ ] List all projects
- [ ] View project details
- [ ] Edit project settings
- [ ] Monitor project status

3. Configuration
- [ ] Load all config types
- [ ] Edit configurations
- [ ] Validate changes
- [ ] Save updates

## Timeline

1. Core Implementation (1 week)
   - Basic window setup
   - Configuration loading
   - UI framework

2. Feature Implementation (2 weeks)
   - API management
   - Project management
   - Configuration editing

3. Testing (1 week)
   - Unit tests
   - Integration tests
   - User testing

## Dependencies

1. Configuration System
   - ConfigManagerV2
   - Project management
   - API configuration

2. Electron Setup
   - Window management
   - IPC communication
   - File system access

## Monitoring

```typescript
// dui/src/services/Analytics.ts
class Analytics {
  async trackConfigOperation(operation: string) {
    const event = {
      category: 'config',
      action: operation,
      timestamp: new Date()
    };
    await this.recordEvent(event);
  }
  
  async trackApiOperation(operation: string) {
    const event = {
      category: 'api',
      action: operation,
      timestamp: new Date()
    };
    await this.recordEvent(event);
  }
}
```