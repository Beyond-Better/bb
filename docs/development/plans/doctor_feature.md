# BB Doctor Feature Implementation Plan

## Overview

The BB Doctor feature provides diagnostic capabilities and issue reporting tools for both CLI and BUI interfaces. It helps users identify and fix common problems while facilitating effective issue reporting.

## Core Features

### 1. Diagnostic Checks

#### Configuration Validation
- Global and project configuration validation
- Check for required settings
- Validate value types and ranges
- Identify deprecated settings

#### TLS Status
- Certificate presence and validity
- Expiration warnings
- Trust store status
- Configuration alignment

#### Resource Usage
- Conversation storage analysis
  - Number of conversations
  - Size on disk per conversation
  - Total storage used
- Available disk space
- File permissions validation

#### API Health (BUI only)
- Connection status
- Response time
- Service availability

### 2. Issue Reporting Package

#### System Information
- BB version
- OS and architecture
- Installation method
- Runtime environment

#### Configuration Data
- Sanitized global config
- Sanitized project config
- Feature flags status
- Custom settings

#### Resource Information
- Conversation metrics
  - Count and sizes
  - Usage patterns
- Storage utilization
- Performance metrics

#### Tool Status
- Core tools availability
- Custom tools inventory
- Tool permissions
- Usage statistics

#### Logs
- API logs
- Recent error reports
- Performance logs
- Security-related events

## Implementation Structure

### 1. Shared Library (`src/shared/doctor/`)

#### Types (`types.ts`)
```typescript
interface DiagnosticResult {
  category: 'config' | 'tls' | 'resources' | 'permissions' | 'api';
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  fix?: {
    description: string;
    command?: string;    // CLI command
    apiEndpoint?: string; // BUI endpoint
  };
}

interface DoctorReport {
  timestamp: string;
  bbVersion: string;
  systemInfo: {
    os: string;
    arch: string;
    diskSpace: {
      total: number;
      free: number;
    };
  };
  diagnostics: DiagnosticResult[];
  conversations: {
    count: number;
    totalSize: number;
    details: Array<{
      id: string;
      size: number;
      lastModified: string;
    }>;
  };
  tools: {
    core: string[];
    custom?: string[];
  };
  logs?: {
    api: string;
    lastErrors?: string[];
  };
}
```

#### Service (`doctorService.ts`)
- Implements diagnostic checks
- Generates reports
- Provides fix utilities
- Handles both CLI and BUI needs

### 2. CLI Implementation

#### Command (`cli/src/commands/doctor.ts`)
- Interactive diagnostic display
- Report generation
- Fix application
- Export capabilities

#### Usage Examples
```bash
# Run diagnostics
bb doctor

# Run diagnostics and apply fixes
bb doctor --fix

# Generate and save full report
bb doctor --report --output report.json
```

### 3. BUI Implementation

#### Doctor Page (`bui/src/islands/DoctorPage.tsx`)
- Real-time diagnostic display
- Interactive fix application
- Report download
- Status visualization

#### API Integration
- Diagnostic endpoints
- Fix application routes
- Report generation API
- WebSocket status updates

## Development Phases

### Phase 1: Core Infrastructure
1. Implement shared doctor library
2. Add basic CLI diagnostics
3. Create simple BUI interface

### Phase 2: Diagnostic Expansion
1. Add detailed config validation
2. Implement resource analysis
3. Enhance TLS checking

### Phase 3: Fix Capabilities
1. Add automated fix options
2. Implement fix confirmation flow
3. Add fix result validation

### Phase 4: Reporting
1. Implement report generation
2. Add export capabilities
3. Create report visualization

## Security Considerations

1. Sensitive Data Handling
   - Config sanitization
   - Log redaction
   - Credential protection

2. Fix Application Safety
   - User confirmation required
   - Backup creation
   - Rollback capability

3. Permission Management
   - Elevated permission detection
   - Safe permission requests
   - Access logging

## Testing Strategy

1. Unit Tests
   - Individual diagnostic checks
   - Report generation
   - Fix implementations

2. Integration Tests
   - CLI command flow
   - BUI interaction
   - API integration

3. Security Tests
   - Data sanitization
   - Permission handling
   - Fix safety

## Sample Implementation

### 1. Initial Directory Structure
```
src/shared/doctor/
  ├── types.ts           # Type definitions
  ├── doctorService.ts   # Core diagnostic service
  ├── checks/           # Individual diagnostic checks
  │   ├── config.ts
  │   ├── tls.ts
  │   ├── resources.ts
  │   └── api.ts
  └── utils/            # Helper utilities
      ├── report.ts
      └── fixes.ts
```

### 2. Core Type Definitions (`src/shared/doctor/types.ts`)
```typescript
export type DiagnosticCategory = 'config' | 'tls' | 'resources' | 'permissions' | 'api';
export type DiagnosticStatus = 'ok' | 'warning' | 'error';

export interface DiagnosticFix {
  description: string;
  command?: string;      // CLI command to run
  apiEndpoint?: string;  // API endpoint for BUI
  requiresElevated?: boolean;
  requiresRestart?: boolean;
}

export interface DiagnosticResult {
  category: DiagnosticCategory;
  status: DiagnosticStatus;
  message: string;
  details?: string;
  fix?: DiagnosticFix;
}

export interface SystemResources {
  diskSpace: {
    total: number;
    free: number;
    unit: 'bytes';
  };
  conversations: {
    count: number;
    totalSize: number;
    unit: 'bytes';
  };
}

export interface DoctorReport {
  timestamp: string;
  bbVersion: string;
  systemInfo: {
    os: string;
    arch: string;
    resources: SystemResources;
  };
  diagnostics: DiagnosticResult[];
  conversations: Array<{
    id: string;
    size: number;
    lastModified: string;
  }>;
  tools: {
    core: string[];
    custom?: string[];
  };
  logs?: {
    api: string;
    lastErrors?: string[];
  };
}
```

### 3. Doctor Service (`src/shared/doctor/doctorService.ts`)
```typescript
import { DiagnosticResult, DoctorReport } from './types.ts';
import { checkConfig } from './checks/config.ts';
import { checkTls } from './checks/tls.ts';
import { checkResources } from './checks/resources.ts';
import { checkApi } from './checks/api.ts';
import { generateReport } from './utils/report.ts';

export class DoctorService {
  private results: DiagnosticResult[] = [];

  async runDiagnostics(options: {
    includeTls?: boolean;
    includeApi?: boolean;
  } = {}): Promise<DiagnosticResult[]> {
    this.results = [];

    // Always run config and resource checks
    await this.checkConfiguration();
    await this.checkResourceUsage();

    // Optional checks based on context
    if (options.includeTls) {
      await this.checkTlsStatus();
    }
    if (options.includeApi) {
      await this.checkApiHealth();
    }

    return this.results;
  }

  async generateReport(includeApiLogs = false): Promise<DoctorReport> {
    // Run all diagnostics first
    await this.runDiagnostics({
      includeTls: true,
      includeApi: true
    });

    return generateReport(this.results, includeApiLogs);
  }

  private async checkConfiguration(): Promise<void> {
    const results = await checkConfig();
    this.results.push(...results);
  }

  private async checkTlsStatus(): Promise<void> {
    const results = await checkTls();
    this.results.push(...results);
  }

  private async checkResourceUsage(): Promise<void> {
    const results = await checkResources();
    this.results.push(...results);
  }

  private async checkApiHealth(): Promise<void> {
    const results = await checkApi();
    this.results.push(...results);
  }
}
```

### 4. Config Check Implementation (`src/shared/doctor/checks/config.ts`)
```typescript
import { ConfigManager } from 'shared/configManager.ts';
import { DiagnosticResult } from '../types.ts';

export async function checkConfig(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const configManager = await ConfigManager.getInstance();

  try {
    const globalConfig = await configManager.loadGlobalConfig();
    const projectConfig = await configManager.loadProjectConfig();

    // Check required global settings
    if (!globalConfig.api?.apiPort) {
      results.push({
        category: 'config',
        status: 'error',
        message: 'Missing required global config: api.apiPort',
        fix: {
          description: 'Set default API port',
          command: 'bb config set --global api.apiPort 3162',
          apiEndpoint: '/api/v1/config/fix/api-port'
        }
      });
    }

    // Validate port number
    const port = globalConfig.api?.apiPort;
    if (port && (port < 1024 || port > 65535)) {
      results.push({
        category: 'config',
        status: 'error',
        message: 'Invalid API port number',
        details: 'Port must be between 1024 and 65535',
        fix: {
          description: 'Reset to default port (3162)',
          command: 'bb config set --global api.apiPort 3162',
          apiEndpoint: '/api/v1/config/fix/api-port'
        }
      });
    }

    // Add more config validation as needed

  } catch (error) {
    results.push({
      category: 'config',
      status: 'error',
      message: 'Failed to load configuration',
      details: error.message
    });
  }

  return results;
}
```

### 5. CLI Command (`cli/src/commands/doctor.ts`)
```typescript
import { Command } from 'cliffy/command';
import { colors } from 'cliffy/ansi/colors';
import { DoctorService } from 'shared/doctor/doctorService.ts';
import { confirm } from 'cliffy/prompt/mod.ts';

export const doctor = new Command()
  .name('doctor')
  .description('Check BB system health and generate diagnostic reports')
  .option('--fix', 'Attempt to fix identified issues')
  .option('--report', 'Generate a full diagnostic report')
  .option('--output <file:string>', 'Save report to file')
  .action(async (options) => {
    const service = new DoctorService();
    
    if (options.report) {
      const report = await service.generateReport(true);
      if (options.output) {
        await Deno.writeTextFile(options.output, JSON.stringify(report, null, 2));
        console.log(colors.green(`Report saved to ${options.output}`));
      } else {
        console.log(JSON.stringify(report, null, 2));
      }
      return;
    }

    const results = await service.runDiagnostics({
      includeTls: true,
      includeApi: false // Not needed for CLI
    });
    
    for (const result of results) {
      const color = result.status === 'ok' ? colors.green :
                   result.status === 'warning' ? colors.yellow :
                   colors.red;
                   
      console.log(`${color(result.status.toUpperCase())}: ${result.message}`);
      
      if (result.details) {
        console.log(result.details);
      }
      
      if (result.fix && options.fix) {
        console.log(`\nFix available: ${result.fix.description}`);
        if (await confirm('Apply fix?')) {
          if (result.fix.command) {
            // Execute fix command
            const cmd = result.fix.command.split(' ');
            const p = new Deno.Command(cmd[0], {
              args: cmd.slice(1)
            });
            const output = await p.output();
            if (output.success) {
              console.log(colors.green('Fix applied successfully'));
            } else {
              console.log(colors.red('Failed to apply fix'));
            }
          }
        }
      }
    }
  });
```

## Future Enhancements

1. Proactive Monitoring
   - Background health checks
   - Alert system
   - Trend analysis

2. Extended Diagnostics
   - Network analysis
   - Performance profiling
   - Security auditing

3. Advanced Reporting
   - Custom report templates
   - Comparative analysis
   - Trend visualization

4. Automated Maintenance
   - Scheduled checks
   - Auto-fix capabilities
   - Maintenance scheduling