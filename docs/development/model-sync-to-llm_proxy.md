# Model Sync to LLM-Proxy Documentation

## Overview

This document describes how to synchronize model capabilities from the local JSON file to BB's llm-proxy service. The sync process is separate from the model capabilities update process to allow deploying to multiple environments (staging/production) independently.

## Prerequisites

1. **Updated Model Capabilities**: Run `update_model_capabilities.ts` first to generate current `modelCapabilities.json`
2. **Authentication Token**: Obtain service token for the target environment
3. **Environment Configuration**: Set up environment-specific configs

## Script: `sync_models_to_llm_proxy.ts`

### Usage

```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--input=PATH` | Input capabilities file | `api/src/data/modelCapabilities.json` |
| `--environment=ENV` | Target environment (`staging`\|`production`) | `staging` |
| `--supabase-url=URL` | Override Supabase config URL | From global config |
| `--auth-token=TOKEN` | Authentication token | From env file/var |
| `--dry-run` | Preview changes without making them | `false` |
| `--force` | Update all models regardless of changes | `false` |

### Authentication

The script supports multiple authentication methods (in order of priority):

1. **CLI Argument**: `--auth-token=YOUR_TOKEN`
2. **Environment File**: `LLM_PROXY_AUTH_TOKEN` in `.env.staging`/`.env.production`
3. **Environment Variable**: `LLM_PROXY_AUTH_TOKEN`

### Environment Configuration

#### Option 1: Environment Files (Recommended)

Create environment-specific configuration files:

**.env.staging**
```bash
LLM_PROXY_AUTH_TOKEN=your_staging_service_token
SUPABASE_CONFIG_URL=https://staging.beyondbetter.dev/api/v1/config/supabase
```

**.env.production**
```bash
LLM_PROXY_AUTH_TOKEN=your_production_service_token
SUPABASE_CONFIG_URL=https://www.beyondbetter.dev/api/v1/config/supabase
```

#### Option 2: CLI Arguments

```bash
--auth-token=your_token \
--supabase-url=https://staging.beyondbetter.dev/api/v1/config/supabase
```

## Sync Process

### 1. Dry Run (Recommended First Step)

Preview what changes would be made:

```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=staging \
  --dry-run
```

Output example:
```
🧪 DRY RUN - Would sync the following models:
  CREATE: anthropic/claude-sonnet-4-20250514 - Claude Sonnet 4.0
  UPDATE: openai/gpt-4o - GPT-4o
  CREATE: google/gemini-2.0-flash - Gemini 2.0 Flash
```

### 2. Sync to Staging

```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=staging
```

### 3. Test Staging Environment

Verify the changes work correctly in staging before proceeding to production.

### 4. Sync to Production

```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  api/scripts/sync_models_to_llm_proxy.ts \
  --environment=production
```

## Sync Behavior

### Models Included
- ✅ **All providers** except Ollama (local deployment)
- ✅ **Non-hidden models** (models with `hidden: false` or no hidden property)
- ✅ **New models** not currently in llm-proxy
- ✅ **Changed models** with updated pricing or settings

### Models Excluded
- ❌ **Ollama models** (local deployment, no API costs)
- ❌ **Hidden models** (manually marked `hidden: true` in JSON)

### Update Detection

The script compares current models in llm-proxy with local capabilities and syncs models that have changes in:

- Input token pricing (`cost_input`)
- Output token pricing (`cost_output`)
- Cache pricing (`cost_cache_read`, `cost_cache_create`)
- Availability status (`is_available`)
- Model settings (capabilities, features, etc.)

### Individual Requests

The script makes separate API requests for each model to provide:
- ✅ **Detailed progress reporting** for each model
- ✅ **Error isolation** (one failure doesn't stop others)
- ✅ **Clear success/failure tracking**

## Output and Reporting

### Progress Output
```
🔄 Syncing 15 models...
[1/15] Syncing anthropic/claude-sonnet-4-20250514...
  ✅ [1/15] Successfully synced anthropic/claude-sonnet-4-20250514
[2/15] Syncing openai/gpt-4o...
  ✅ [2/15] Successfully synced openai/gpt-4o
```

### Final Report
```
📊 Synchronization Results:
  ✅ Created: 8 models
  🔄 Updated: 3 models
  ⏭️ Skipped: 12 models (no changes)
  ❌ Failed: 0 models

✅ Created Models:
  + anthropic/claude-sonnet-4-20250514
  + google/gemini-2.0-flash
  + deepseek/deepseek-reasoner

🔄 Updated Models:
  ~ openai/gpt-4o
  ~ anthropic/claude-3-5-sonnet-20241022
```

## Data Format

### LLM-Proxy Model Schema

The script converts BB's `ModelCapabilities` format to the llm-proxy database schema:

```typescript
interface LLMProxyModel {
  model_id: string;           // Model identifier
  provider_name: string;      // Provider name  
  model_name: string;         // Display name
  model_type: string;         // Type (text/multimodal)
  cost_input: number;         // Input token cost (per-token)
  cost_output: number;        // Output token cost (per-token)
  cost_cache_read?: number;   // Cache read cost
  cost_cache_create?: number; // Cache creation cost (1.25x cache_read)
  is_available: boolean;      // Availability status
  settings: object;           // Additional model metadata
}
```

### Settings Object

The `settings` field contains comprehensive model metadata:

```json
{
  "displayName": "Claude Sonnet 4.0",
  "contextWindow": 200000,
  "maxOutputTokens": 64000,
  "supportedFeatures": {
    "functionCalling": true,
    "vision": true,
    "streaming": true
  },
  "responseSpeed": "medium",
  "cost": "medium", 
  "intelligence": "high",
  "systemPromptBehavior": "optional",
  "defaults": { /* ... */ },
  "constraints": { /* ... */ }
}
```

## Error Handling

### Continue on Failure
- Script continues processing remaining models if individual requests fail
- All failures are collected and reported at the end
- Exit code reflects overall success/failure

### Common Issues

1. **Authentication Errors**
   - Verify token is valid and has required permissions
   - Check environment configuration

2. **Network Errors**
   - Retry failed models manually
   - Check Supabase URL configuration

3. **Validation Errors**
   - Ensure model capabilities JSON is valid
   - Check for missing required fields

## Integration with CI/CD

### Recommended Workflow

1. **Development**: Use dry-run to validate changes
2. **Staging Deployment**: Auto-sync to staging on model updates
3. **Production Deployment**: Manual approval and sync to production

### Example GitHub Actions

```yaml
- name: Sync Models to Staging
  if: github.ref == 'refs/heads/main'
  run: |
    deno run --allow-net --allow-read --allow-write --allow-env \
      api/scripts/sync_models_to_llm_proxy.ts \
      --environment=staging
  env:
    LLM_PROXY_AUTH_TOKEN: ${{ secrets.STAGING_LLM_PROXY_TOKEN }}

- name: Sync Models to Production  
  if: github.ref == 'refs/heads/release'
  run: |
    deno run --allow-net --allow-read --allow-write --allow-env \
      api/scripts/sync_models_to_llm_proxy.ts \
      --environment=production
  env:
    LLM_PROXY_AUTH_TOKEN: ${{ secrets.PRODUCTION_LLM_PROXY_TOKEN }}
```

## Security Considerations

- **Service Tokens**: Store securely in environment files or secrets management
- **Least Privilege**: Use tokens with minimal required permissions
- **Audit Logging**: Monitor sync activities in llm-proxy logs
- **Environment Isolation**: Separate tokens for staging/production

## Troubleshooting

### Debug Mode
Add more verbose logging by setting environment variable:
```bash
export LOG_LEVEL=debug
```

### Manual Verification
After sync, verify changes in llm-proxy:
```bash
# Check current models
curl -H "Authorization: Bearer $TOKEN" \
  https://your-llm-proxy/functions/v1/provider-models
```

### Rollback
If issues occur:
1. Revert model capabilities JSON to previous version
2. Re-run sync to restore previous state
3. Investigate and fix issues

---

**Remember**: Always test in staging before deploying to production!