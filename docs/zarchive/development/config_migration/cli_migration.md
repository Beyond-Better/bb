# CLI Configuration Migration Plan

## Overview

This document details the migration plan for the Command Line Interface (CLI) component from v1 to v2 of the configuration system. The CLI is a critical component that:
1. Manages configuration via commands
2. Controls API server lifecycle
3. Initializes and manages projects
4. Provides conversation interface

## Current Configuration Usage

### Config Command (commands/config.ts)
```typescript
// Current usage
export const config = new Command()
  .command('view', 'View configuration')
  .option('--global', 'Show only global configuration')
  .option('--project', 'Show only project configuration')
  .action(async ({ global, project }) => {
    let config: unknown;
    if (global) {
      config = await ConfigManager.globalConfig();
    } else if (project) {
      config = await ConfigManager.projectConfig(Deno.cwd());
    } else {
      config = await ConfigManager.redactedFullConfig(Deno.cwd());
    }
  });
```

### API Control (commands/apiStart.ts)
```typescript
// Current usage
const fullConfig = await ConfigManager.fullConfig(startDir);
const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
const apiPort = `${port || fullConfig.api.apiPort || 3162}`;
const apiUseTls = typeof useTls !== 'undefined'
  ? !!useTls
  : typeof fullConfig.api.apiUseTls !== 'undefined'
  ? fullConfig.api.apiUseTls
  : true;
```

### Project Initialization (commands/init.ts)
```typescript
// Current usage
const configManager = await ConfigManager.getInstance();
await configManager.ensureProjectConfig(startDir, wizardAnswers);
```

## Migration Steps

### 1. Update Config Commands

```typescript
// cli/src/commands/config.ts
export const config = new Command()
  .name('config')
  .description('View or update BB configuration')
  // Add version awareness
  .option('--format <version>', 'Config format version (v1|v2)', { default: 'v2' })
  .command('view', 'View configuration')
  .option('--global', 'Show only global configuration')
  .option('--project', 'Show only project configuration')
  .action(async ({ global, project, format }) => {
    const config = await ConfigManagerV2.getInstance();
    
    try {
      let result: unknown;
      if (global) {
        result = await config.getGlobalConfig();
      } else if (project) {
        const projectId = await config.resolveProjectId(Deno.cwd());
        result = await config.getProjectConfig(projectId);
      } else {
        const projectId = await config.resolveProjectId(Deno.cwd());
        result = await config.getFullConfig(projectId);
      }
      
      // Format output based on version preference
      if (format === 'v1') {
        result = ConfigCompatibility.toV1Format(result);
      }
      
      console.log(formatConfig(result));
    } catch (error) {
      handleConfigError(error);
    }
  });
```

### 2. Update API Control

```typescript
// cli/src/commands/apiStart.ts
export const apiStart = new Command()
  .name('start')
  .description('Start the BB API server')
  .action(async (options) => {
    try {
      const config = await ConfigManagerV2.getInstance();
      const apiConfig = await config.getApiConfig();
      
      // Merge command options with config
      const serverConfig = {
        hostname: options.hostname || apiConfig.hostname,
        port: options.port || apiConfig.port,
        useTls: options.useTls ?? apiConfig.useTls
      };
      
      // Start API server
      const { pid, apiLogFilePath } = await startApiServer(serverConfig);
      
      // Handle success
      console.log(`API server started with PID: ${pid}`);
      console.log(`Logs: ${apiLogFilePath}`);
    } catch (error) {
      handleApiError(error);
    }
  });

// cli/src/utils/apiControl.utils.ts
export async function startApiServer(config: ApiServerConfig) {
  const command = new Deno.Command(config.bbApiExeName, {
    args: [
      '--hostname', config.hostname,
      '--port', String(config.port),
      '--use-tls', String(config.useTls)
    ]
  });
  
  return await command.output();
}
```

### 3. Update Project Management

```typescript
// cli/src/commands/init.ts
export const init = new Command()
  .name('init')
  .description('Initialize a new BB project')
  .action(async () => {
    try {
      const config = await ConfigManagerV2.getInstance();
      
      // Get project details
      const answers = await promptProjectDetails();
      
      // Generate project ID
      const projectId = await config.generateProjectId();
      
      // Create project config
      await config.createProject({
        projectId,
        project: {
          name: answers.name,
          type: answers.type,
          path: Deno.cwd()
        }
      });
      
      console.log(`Project initialized with ID: ${projectId}`);
    } catch (error) {
      handleInitError(error);
    }
  });
```

## Testing Strategy

### 1. Unit Tests

```typescript
// tests/cli/config.test.ts
describe('Config Command', () => {
  test('shows v2 config by default', async () => {
    const result = await runCommand(['config', 'view']);
    expect(result).toContain('version: 2');
  });
  
  test('formats as v1 when requested', async () => {
    const result = await runCommand(['config', 'view', '--format', 'v1']);
    expect(result).not.toContain('version: 2');
  });
});

// tests/cli/api.test.ts
describe('API Control', () => {
  test('starts API with v2 config', async () => {
    const result = await runCommand(['start']);
    expect(result.success).toBe(true);
  });
  
  test('handles custom options', async () => {
    const result = await runCommand(['start', '--port', '3001']);
    expect(result.success).toBe(true);
  });
});
```

### 2. Integration Tests

```typescript
describe('CLI Integration', () => {
  test('initializes project with v2 config', async () => {
    const result = await runCommand(['init']);
    expect(result.success).toBe(true);
    
    const config = await loadProjectConfig();
    expect(config.projectId).toBeDefined();
  });
  
  test('manages API lifecycle', async () => {
    await runCommand(['start']);
    const status = await runCommand(['status']);
    expect(status).toContain('running');
  });
});
```

## Rollback Plan

### 1. Command Handling
```typescript
class CliCommand {
  async execute(args: string[]) {
    try {
      return await this.executeWithV2();
    } catch (error) {
      if (error instanceof ConfigVersionError) {
        return await this.executeWithV1();
      }
      throw error;
    }
  }
}
```

### 2. Project Management
```typescript
class ProjectManager {
  async initializeProject() {
    try {
      await this.initializeWithV2();
    } catch (error) {
      if (error instanceof ConfigVersionError) {
        await this.initializeWithV1();
      }
      throw error;
    }
  }
}
```

## Success Criteria

1. Command Functionality
- [ ] All commands work with v2 config
- [ ] Backward compatibility maintained
- [ ] Error handling improved

2. API Management
- [ ] API starts successfully
- [ ] Status reporting accurate
- [ ] TLS configuration works

3. Project Management
- [ ] Project initialization works
- [ ] Config migration automatic
- [ ] No data loss

## Timeline

1. Command Updates (3-4 days)
   - Config command
   - API commands
   - Project commands

2. Testing (2-3 days)
   - Unit tests
   - Integration tests
   - Manual testing

3. Documentation (1-2 days)
   - Update help text
   - Update examples
   - Update error messages

## Dependencies

1. Configuration System
   - ConfigManagerV2 implementation
   - Migration utilities
   - Compatibility layer

2. API Component
   - Updated API server
   - New config format support
   - Error handling changes

## Risks and Mitigation

1. Command Compatibility
   - Risk: Breaking changes in commands
   - Mitigation: Version detection
   - Fallback: Legacy command mode

2. Project Management
   - Risk: Config migration fails
   - Mitigation: Backup before migration
   - Fallback: Manual recovery

3. API Control
   - Risk: API start/stop issues
   - Mitigation: Enhanced error detection
   - Fallback: Manual API management

## Monitoring

1. Command Usage
```typescript
class CommandMonitor {
  async trackUsage(command: string) {
    const metrics = {
      command,
      version: await this.detectConfigVersion(),
      success: true,
      timestamp: new Date()
    };
    await this.recordMetrics(metrics);
  }
}
```

2. Error Tracking
```typescript
class ErrorTracker {
  async trackCommandError(error: Error) {
    const details = {
      command: error.command,
      configVersion: error.configVersion,
      errorType: error.name,
      message: error.message
    };
    await this.reportError(details);
  }
}
```

3. Migration Status
```typescript
class MigrationTracker {
  async trackMigration(projectId: string) {
    const status = {
      projectId,
      timestamp: new Date(),
      success: true,
      backupCreated: true
    };
    await this.recordMigration(status);
  }
}
```