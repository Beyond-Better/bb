# Configuration Migration System

This document details the automatic configuration migration system that handles:
- Upgrading config files to the latest version
- Adding required projectId to existing projects
- Validating migrated configurations
- Reporting migration status

## Migration Progress

### Completed Components

1. CLI Migration
   - Successfully migrated all CLI commands and utilities
   - Key changes:
     - Updated to ConfigManagerV2 getInstance() pattern
     - Converted property names (e.g., apiHostname → hostname)
     - Updated method names (e.g., setGlobalConfigValue → updateGlobalConfig)
     - Added appropriate type annotations
     - Fixed variable scoping issues

### Lessons Learned

1. Property Migration Patterns:
   - API properties moved under tls object:
     - apiUseTls → tls.useTls
     - tlsCertFile → tls.certFile
     - tlsKeyFile → tls.keyFile
   - Server properties simplified:
     - apiHostname → hostname
     - apiPort → port
   - LLM keys moved to dedicated object:
     - anthropicApiKey → llmKeys.anthropic

2. Common Migration Tasks:
   - Update ConfigManager imports to v2 version
   - Add ts-ignore comments where type definitions need work
   - Move configManager instantiation to appropriate scope
   - Update property access to match new structure
   - Convert method calls to new names

3. Migration Challenges:
   - Variable scoping in complex functions
   - Property access through optional chaining
   - Method name changes requiring parameter updates
   - Maintaining proper error handling

## Project ID Management

```typescript
interface ProjectIdInfo {
  id: string;
  path: string;
  created: string;
  lastAccessed: string;
}

class ProjectIdManager {
  private static readonly ID_LENGTH = 12;
  private static readonly ID_PATTERN = /^[a-f0-9]{12}$/;
  private idRegistry: Map<string, ProjectIdInfo> = new Map();

  async generateUniqueId(projectPath: string): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const id = this.generateId(projectPath, attempts);
      if (!this.idRegistry.has(id)) {
        const info: ProjectIdInfo = {
          id,
          path: projectPath,
          created: new Date().toISOString(),
          lastAccessed: new Date().toISOString()
        };
        this.idRegistry.set(id, info);
        await this.saveRegistry();
        return id;
      }
      attempts++;
    }
    throw new Error(`Failed to generate unique project ID for ${projectPath}`);
  }

  private generateId(path: string, attempt: number): string {
    const normalizedPath = normalizePath(path);
    const input = attempt > 0 ? `${normalizedPath}-${attempt}` : normalizedPath;
    return createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, this.ID_LENGTH);
  }

  static validateId(id: string): boolean {
    return ProjectIdManager.ID_PATTERN.test(id);
  }
}
```

## Enhanced Migration System

```typescript
interface MigrationResult {
  success: boolean;
  version: {
    from: string;
    to: string;
  };
  backupPath?: string;
  changes: Array<{
    path: string[];
    from: unknown;
    to: unknown;
  }>;
  errors: Array<{
    path: string[];
    message: string;
  }>;
}

class ConfigMigrationV2 {
  static async migrateToV2(oldConfig: any): Promise<{
    config: GlobalConfig | ProjectConfig;
    result: MigrationResult;
  }> {
    const result: MigrationResult = {
      success: false,
      version: {
        from: oldConfig.version || '1.0.0',
        to: CURRENT_CONFIG_VERSION
      },
      changes: [],
      errors: []
    };

    try {
      // Determine config type and migrate
      const isProjectConfig = 'project' in oldConfig;
      const config = isProjectConfig ? 
        await this.migrateProjectConfig(oldConfig, result) :
        await this.migrateGlobalConfig(oldConfig, result);

      // Validate migrated config
      const validation = await this.validateConfig(config);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        throw new Error('Config validation failed after migration');
      }

      result.success = true;
      return { config, result };
    } catch (error) {
      result.errors.push({
        path: [],
        message: `Migration failed: ${error.message}`
      });
      throw new ConfigMigrationError('Migration failed', result);
    }
  }

  private static async validateConfig(config: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };

    // Required fields
    if (config.projectId && !ProjectIdManager.validateId(config.projectId)) {
      result.isValid = false;
      result.errors.push({
        path: ['projectId'],
        message: 'Invalid project ID format'
      });
    }

    // Version
    if (!config.version || config.version !== CURRENT_CONFIG_VERSION) {
      result.isValid = false;
      result.errors.push({
        path: ['version'],
        message: 'Invalid or missing version'
      });
    }

    return result;
  }
}

class ConfigMigrationError extends Error {
  constructor(
    message: string, 
    public readonly migrationResult: MigrationResult
  ) {
    super(message);
    this.name = 'ConfigMigrationError';
  }
}
```

## Migration Status Reporting

```typescript
interface MigrationStatus {
  inProgress: boolean;
  completed: Array<{
    configType: 'global' | 'project';
    path: string;
    timestamp: string;
    result: MigrationResult;
  }>;
  failed: Array<{
    configType: 'global' | 'project';
    path: string;
    timestamp: string;
    error: string;
    result: MigrationResult;
  }>;
}

class MigrationStatusManager {
  private status: MigrationStatus = {
    inProgress: false,
    completed: [],
    failed: []
  };

  async recordSuccess(
    configType: 'global' | 'project',
    path: string,
    result: MigrationResult
  ): Promise<void> {
    this.status.completed.push({
      configType,
      path,
      timestamp: new Date().toISOString(),
      result
    });
    await this.saveStatus();
  }

  async recordFailure(
    configType: 'global' | 'project',
    path: string,
    error: Error,
    result: MigrationResult
  ): Promise<void> {
    this.status.failed.push({
      configType,
      path,
      timestamp: new Date().toISOString(),
      error: error.message,
      result
    });
    await this.saveStatus();
  }

  async getMigrationReport(): Promise<string> {
    const report = [];
    
    report.push('# Configuration Migration Report\n');
    
    if (this.status.inProgress) {
      report.push('⚠️ Migration currently in progress\n');
    }
    
    if (this.status.completed.length > 0) {
      report.push('## Successful Migrations');
      for (const item of this.status.completed) {
        report.push(`\n### ${item.configType} config: ${item.path}`);
        report.push(`Timestamp: ${item.timestamp}`);
        report.push(`Version: ${item.result.version.from} -> ${item.result.version.to}`);
        if (item.result.changes.length > 0) {
          report.push('\nChanges:');
          for (const change of item.result.changes) {
            report.push(`- ${change.path.join('.')}: ${change.from} -> ${change.to}`);
          }
        }
      }
    }
    
    if (this.status.failed.length > 0) {
      report.push('\n## Failed Migrations');
      for (const item of this.status.failed) {
        report.push(`\n### ${item.configType} config: ${item.path}`);
        report.push(`Timestamp: ${item.timestamp}`);
        report.push(`Error: ${item.error}`);
        if (item.result.errors.length > 0) {
          report.push('\nErrors:');
          for (const error of item.result.errors) {
            report.push(`- ${error.path.join('.')}: ${error.message}`);
          }
        }
      }
    }
    
    return report.join('\n');
  }
}
```

## Integration with API Server

```typescript
class ApiServer {
  private migrationManager = new MigrationStatusManager();

  async initialize() {
    try {
      this.migrationManager.status.inProgress = true;
      
      // Migrate global config
      const globalConfig = await this.migrateGlobalConfig();
      
      // Initialize with migrated config
      const config = await getConfigManager(globalConfig);
      
      // Start API server
      await this.startServer(config);
      
      this.migrationManager.status.inProgress = false;
      logger.info('API server initialized with migrated configuration');
      
      // Generate migration report
      const report = await this.migrationManager.getMigrationReport();
      logger.info('Migration Report:', report);
    } catch (error) {
      this.migrationManager.status.inProgress = false;
      logger.error('Failed to initialize API server:', error);
      throw error;
    }
  }

  private async migrateGlobalConfig() {
    const configPath = await getGlobalConfigPath();
    const backupDir = await getConfigBackupDir();
    
    try {
      // Load existing config
      const currentConfig = await loadConfigFile(configPath);
      
      // Check version
      if (!currentConfig.version || currentConfig.version !== CURRENT_CONFIG_VERSION) {
        // Create backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `config-${timestamp}.yaml`);
        await copyFile(configPath, backupPath);
        
        // Migrate config
        const { config, result } = await ConfigMigrationV2.migrateToV2(currentConfig);
        result.backupPath = backupPath;
        
        // Save migrated config
        await saveConfigFile(configPath, config);
        
        // Record success
        await this.migrationManager.recordSuccess('global', configPath, result);
        
        return config;
      }
      
      return currentConfig;
    } catch (error) {
      if (error instanceof ConfigMigrationError) {
        await this.migrationManager.recordFailure(
          'global',
          configPath,
          error,
          error.migrationResult
        );
      } else {
        await this.migrationManager.recordFailure(
          'global',
          configPath,
          error,
          {
            success: false,
            version: { from: 'unknown', to: CURRENT_CONFIG_VERSION },
            errors: [{ path: [], message: error.message }],
            changes: []
          }
        );
      }
      throw error;
    }
  }
}
```

## Project Config Migration

```typescript
class ConfigManagerV2 {
  private projectIdManager = new ProjectIdManager();
  private migrationManager = new MigrationStatusManager();

  async loadProjectConfig(projectPath: string): Promise<ProjectConfig> {
    const configPath = join(projectPath, '.bb', 'config.yaml');
    const backupDir = join(projectPath, '.bb', 'backups');
    
    try {
      // Load existing config
      const currentConfig = await loadConfigFile(configPath);
      
      // Check if migration needed
      if (!currentConfig.version || 
          currentConfig.version !== CURRENT_CONFIG_VERSION || 
          !currentConfig.projectId) {
        
        // Ensure backup directory exists
        await ensureDir(backupDir);
        
        // Create backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `config-${timestamp}.yaml`);
        await copyFile(configPath, backupPath);
        
        // Migrate config
        const { config, result } = await ConfigMigrationV2.migrateToV2(currentConfig);
        result.backupPath = backupPath;
        
        // Ensure projectId exists
        if (!config.projectId) {
          config.projectId = await this.projectIdManager.generateUniqueId(projectPath);
          result.changes.push({
            path: ['projectId'],
            from: undefined,
            to: config.projectId
          });
        }
        
        // Save migrated config
        await saveConfigFile(configPath, config);
        
        // Record success
        await this.migrationManager.recordSuccess('project', configPath, result);
        
        return config;
      }
      
      return currentConfig;
    } catch (error) {
      if (error instanceof ConfigMigrationError) {
        await this.migrationManager.recordFailure(
          'project',
          configPath,
          error,
          error.migrationResult
        );
      } else {
        await this.migrationManager.recordFailure(
          'project',
          configPath,
          error,
          {
            success: false,
            version: { from: 'unknown', to: CURRENT_CONFIG_VERSION },
            errors: [{ path: [], message: error.message }],
            changes: []
          }
        );
      }
      throw error;
    }
  }
}
```