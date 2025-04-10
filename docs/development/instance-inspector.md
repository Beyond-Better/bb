# Instance Inspector

## Overview

The BB Instance Inspector is a debugging utility designed to provide visibility into the hierarchical structure of instantiated objects within the API. It helps identify potential issues such as duplicate instances, orphaned interactions, and memory leaks that might cause excessive logging or performance problems.

## Use Cases

- Debugging excessive logging
- Identifying memory leaks
- Tracking object lifecycles
- Understanding object hierarchies
- Verifying proper cleanup of resources

## Access Methods

The Instance Inspector can be accessed through multiple methods:

### 1. CLI Command (Recommended)

The most convenient way to inspect instances is through the BB CLI:

```bash
# Basic instance overview
bb debug instances

# Detailed view with more information
bb debug instances --detailed

# Output in JSON format
bb debug instances --format json

# Save output to file
bb debug instances --output instances.json --format json

# Write additional copy to log file
bb debug instances --log

# Focus on orphaned interactions
bb debug instances --orphaned
```

### 2. API Endpoint

For direct access or for use in custom scripts:

```bash
# Basic request
curl 'https://localhost:3162/api/v1/debug/instances'

# Detailed view with JSON formatting
curl 'https://localhost:3162/api/v1/debug/instances?detailed=true' | jq

# Text format
curl 'https://localhost:3162/api/v1/debug/instances?format=text'

# Write to log file
curl 'https://localhost:3162/api/v1/debug/instances?log=true'
```

### 3. Deno Task (For Automation)

For use in automated scripts:

```bash
# Basic overview
deno task tool:debug-instances

# Detailed view
deno task tool:debug-instances-detailed

# JSON output
deno task tool:debug-instances-json

# Write to log file
deno task tool:debug-instances-log

# Focus on orphaned interactions
deno task tool:debug-instances-orphaned

# Save to JSON file
deno task tool:debug-instances-file
```

### 4. Programmatic Usage

For use within code during development:

```typescript
import { logInstanceOverview } from 'api/utils/instanceInspector.ts';

// Add this at suspicious points in your code
logInstanceOverview({ detailed: true });
```

## Output Format

The instance inspector provides hierarchical information about:

### ProjectEditors

```
PROJECT EDITORS:
• Editor[conv-abc123]:
  - Project: proj-123456 (/path/to/project)
  - Components:
    ◦ OrchestratorController: ✓
      ■ AgentController: ✓
      ■ ToolManager: 25 tools (core)
      ■ LLMProvider: anthropic (claude-3-5-sonnet-20241022)
    ◦ MCPManager: ✓
      ■ Servers (2): slack, supabase-localdev
    ◦ ResourceManager: ✓
```

### Interactions

```
INTERACTIONS:
• conv-abc123 (LLMConversationInteraction): Project Overview
  - Files: 8
  - Model: claude-3-5-sonnet-20241022
  - Statements: 3
  - Children (2):
    ◦ agent-def456 (LLMChatInteraction): Generate title for conversation
    ◦ agent-ghi789 (LLMChatInteraction): Generate conversation objective
```

## Debugging Common Issues

### Tracking Down Excessive Logging

To identify sources of excessive logging:

1. Capture a baseline:
   ```bash
   bb debug instances --output before.json --format json
   ```

2. Perform the action that causes excessive logging

3. Capture the state after:
   ```bash
   bb debug instances --output after.json --format json
   ```

4. Compare the outputs:
   ```bash
   diff before.json after.json
   ```

### Finding Memory Leaks

Orphaned interactions are often a sign of memory leaks:

```bash
bb debug instances --detailed | grep "Orphaned"
```

Or for a complete analysis:

```bash
deno task tool:debug-instances-orphaned
```

### Duplicate Instances

Look for multiple ProjectEditors with the same conversationId or multiple OrchestratorControllers when there should only be one.

## Advanced Usage

### Monitoring Instance Growth

Set up a monitoring script:

```bash
#!/bin/bash
while true; do
  bb debug instances --format json | jq '.overview.projectEditorCount' >> counts.log
  sleep 10
done
```

### Filtering JSON Output

Use `jq` for focused analysis:

```bash
# Count active editors
bb debug instances --format json | jq '.overview.projectEditorCount'

# List all conversation IDs
bb debug instances --format json | jq '.overview.editors | keys'

# Find editors with AgentController
bb debug instances --format json | jq '.overview.editors[] | select(.components.orchestratorController.hasAgentController)'
```

## Troubleshooting

### Connection Issues

If the CLI commands cannot connect to the API:

1. Ensure the API is running: `bb status`
2. Check the port configuration in your project settings
3. Try the curl command to see if direct access works

### Empty Results

If you get empty results from the script but not from the API endpoint, it may be because:

1. The script is running in its own process and not connected to the API
2. TLS certificate issues - try setting `DENO_TLS_CA_STORE=system`
3. Connection refused - check if the API is running on the expected port

## Contributing

The instance inspector can be extended with new capabilities:

1. Add new component inspection in `api/src/utils/instanceInspector.ts` 
2. Create accessor methods for protected properties
3. Update the formatters to include the new information

Submit a PR with your enhancements!