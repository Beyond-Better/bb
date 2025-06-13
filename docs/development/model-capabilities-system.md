# Model Capabilities Management System

The BB project uses a comprehensive, dynamic model capabilities management system that provides unified access to model information across all LLM providers. This system combines static model data with runtime discovery of user-specific models (like Ollama), ensuring BB can work with both cloud-based and local models seamlessly.

## Overview

The model capabilities system provides:

1. **Unified Model Registry** - Single source of truth for all model information
2. **Dynamic Discovery** - Runtime detection of Ollama and other local models
3. **Static Model Data** - Development-time fetched data for cloud providers
4. **Parameter Resolution** - Intelligent parameter selection with priority hierarchies
5. **API Integration** - RESTful endpoints for model management
6. **Backwards Compatibility** - Seamless migration from legacy enum-based system

## Architecture

```
┌─────────────────────────────────────────────┐
│              ModelRegistryService            │
│  (Unified model registry & discovery)      │
└─────────────────┬───────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼────┐      ┌─────▼─────┐
   │ Static  │      │  Dynamic  │
   │ Models  │      │  Models   │
   │ (JSON)  │      │ (Ollama)  │
   └─────────┘      └───────────┘
```

## System Components

### 1. ModelRegistryService

The core service (`api/src/llms/modelRegistryService.ts`) that manages all model information:

- **Static Model Loading**: Loads pre-fetched model data from JSON
- **Dynamic Discovery**: Discovers Ollama models at runtime
- **Unified Access**: Single interface for all model operations
- **Provider Mapping**: Automatic model-to-provider relationships
- **Capability Queries**: Feature detection and constraint validation

### 2. Static Model Data

Model capabilities stored in `api/src/data/modelCapabilities.json`:

```json
{
  "anthropic": {
    "claude-3-7-sonnet-20250219": {
      "displayName": "Claude Sonnet 3.7",
      "contextWindow": 200000,
      "maxOutputTokens": 128000,
      "pricing": {
        "inputTokens": { "basePrice": 0.000003, "cachedPrice": 0.00000375 },
        "outputTokens": { "basePrice": 0.000015 },
        "currency": "USD",
        "effectiveDate": "2025-02-19"
      },
      "supportedFeatures": {
        "functionCalling": true,
        "json": true,
        "streaming": true,
        "vision": true,
        "extendedThinking": true,
        "promptCaching": true
      },
      "defaults": {
        "temperature": 0.7,
        "maxTokens": 16384,
        "extendedThinking": false
      },
      "constraints": {
        "temperature": { "min": 0.0, "max": 1.0 }
      },
      "systemPromptBehavior": "optional",
      "responseSpeed": "medium"
    }
  }
}
```

### 3. Dynamic Model Discovery

Runtime discovery of local models, currently supporting:

- **Ollama Models**: Automatically discovered from configured Ollama server
- **Feature Detection**: Heuristic-based capability inference
- **Graceful Fallbacks**: Continues operation if discovery fails

### 4. Enhanced Update Script

The model capabilities update script (`api/scripts/update_model_capabilities.ts`) provides:

- **Provider API Integration**: Fetches latest model data from APIs
- **Validation**: Comprehensive model data validation
- **Error Handling**: Flexible error handling with --use-cached option
- **Development Integration**: Part of BB release process

### 5. API Endpoints

RESTful endpoints for model management:

- `GET /api/v1/model` - List all available models
- `GET /api/v1/model/{modelId}` - Get specific model capabilities
- `POST /api/v1/model/refresh` - Refresh dynamic models

## Configuration

### Ollama Integration

Configure Ollama discovery in your project config:

```yaml
# .bb/config.yaml
api:
  llmProviders:
    ollama:
      enabled: true
      baseUrl: "http://localhost:11434"  # Optional, defaults to localhost
      timeout: 5000  # Optional, discovery timeout in ms
```

### User Preferences

Set model parameter preferences per provider:

```yaml
api:
  llmProviders:
    anthropic:
      apiKey: "sk-ant-xxxx"
      userPreferences:
        temperature: 0.5
        maxTokens: 4096
        extendedThinking: true
    openai:
      apiKey: "sk-xxxx"
      userPreferences:
        temperature: 0.8
        maxTokens: 2048
```

## Usage in Code

### Basic Model Registry Operations

```typescript
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

// Get registry instance
const registry = await ModelRegistryService.getInstance(projectConfig);

// Get all available models
const allModels = registry.getAllModels();

// Get models by provider
const anthropicModels = registry.getModelsByProvider('anthropic');
const ollamaModels = registry.getModelsByProvider('ollama');

// Get specific model info
const model = registry.getModel('claude-3-7-sonnet-20250219');
const capabilities = registry.getModelCapabilities('claude-3-7-sonnet-20250219');

// Check feature support
const supportsTools = registry.supportsFeature('llama3-groq-tool-use:70b', 'functionCalling');
const supportsVision = registry.supportsFeature('claude-3-5-sonnet-20241022', 'vision');
```

### Parameter Resolution (Legacy Compatibility)

```typescript
import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';

// Legacy interface still available
const capabilitiesManager = await ModelCapabilitiesManager.getInstance();

// Resolve parameters with priority hierarchy
const temperature = capabilitiesManager.resolveTemperature(
  'claude-3-7-sonnet-20250219',
  explicitValue,      // Highest priority
  userPreference,     // From config
  interactionDefault  // Interaction-specific
);

const maxTokens = capabilitiesManager.resolveMaxTokens(
  'claude-3-7-sonnet-20250219',
  explicitValue,
  userPreference,
  interactionDefault
);
```

### Model Constants (Migration from Enums)

```typescript
import { MODELS, AnthropicModel } from 'api/types/llms.ts';

// New approach: use string constants
const model = MODELS.CLAUDE_3_7_SONNET; // 'claude-3-7-sonnet-20250219'

// Legacy support: enum-like objects still work
const legacyModel = AnthropicModel.CLAUDE_3_7_SONNET; // Same value

// Direct strings are preferred
const preferredApproach = 'claude-3-7-sonnet-20250219';
```

### Dynamic Model Refresh

```typescript
// Refresh Ollama models without restart
await registry.refreshDynamicModels();

// Get updated model list
const updatedModels = registry.getModelsByProvider('ollama');
```

## API Usage

### List Models with Filtering

```bash
# Get all models
curl "http://localhost:3162/api/v1/model"

# Filter by provider
curl "http://localhost:3162/api/v1/model?provider=ollama"

# Filter by source (static/dynamic)
curl "http://localhost:3162/api/v1/model?source=dynamic"

# Pagination
curl "http://localhost:3162/api/v1/model?page=2&pageSize=10"
```

### Get Model Capabilities

```bash
# Get specific model details
curl "http://localhost:3162/api/v1/model/claude-3-7-sonnet-20250219"

# Response includes full capabilities, pricing, features
{
  "model": {
    "id": "claude-3-7-sonnet-20250219",
    "displayName": "Claude Sonnet 3.7",
    "provider": "anthropic",
    "providerLabel": "Anthropic",
    "source": "static",
    "capabilities": { /* full capabilities object */ }
  }
}
```

### Refresh Dynamic Models

```bash
# Trigger Ollama model refresh
curl -X POST "http://localhost:3162/api/v1/model/refresh"

# Response shows refresh results
{
  "message": "Dynamic models refreshed successfully",
  "modelsRefreshed": 8,
  "modelsChanged": 2
}
```

## Updating Model Capabilities

### Development Process

The model capabilities update is part of BB's development cycle:

```bash
# Update all provider model data
deno run --allow-all api/scripts/update_model_capabilities.ts

# Update specific providers only
deno run --allow-all api/scripts/update_model_capabilities.ts --providers=anthropic,openai

# Validate existing data
deno run --allow-all api/scripts/update_model_capabilities.ts --validate-only

# Continue on API failures using cached data
deno run --allow-all api/scripts/update_model_capabilities.ts --use-cached
```

### Using API Keys

Provide API keys via command line or environment variables:

```bash
# Command line
deno run --allow-all api/scripts/update_model_capabilities.ts \
  --anthropic-key=sk-ant-xxx \
  --openai-key=sk-xxx \
  --google-key=xxx

# Environment variables
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
export GOOGLE_API_KEY=xxx
deno run --allow-all api/scripts/update_model_capabilities.ts
```

### Global Config Integration

API keys can also be loaded from global BB config:

```yaml
# ~/.bb/global-config.yaml
api:
  llmProviders:
    anthropic:
      apiKey: "sk-ant-xxx"
    openai:
      apiKey: "sk-xxx"
    google:
      apiKey: "xxx"
```

## Migration Guide

### From Enums to String Constants

**Old approach:**
```typescript
import { AnthropicModel } from 'api/types/llms.ts';
const model = AnthropicModel.CLAUDE_3_7_SONNET;
```

**New approach:**
```typescript
import { MODELS } from 'api/types/llms.ts';
const model = MODELS.CLAUDE_3_7_SONNET;
// Or directly: const model = 'claude-3-7-sonnet-20250219';
```

### From LLMModelToProvider to ModelRegistryService

**Old approach:**
```typescript
import { LLMModelToProvider } from 'api/types/llms.ts';
const provider = LLMModelToProvider[model];
```

**New approach:**
```typescript
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
const registry = await ModelRegistryService.getInstance();
const provider = registry.getModelProvider(model);
```

### Backwards Compatibility

The system maintains full backwards compatibility:

- Enum-like objects (`AnthropicModel`, `OpenAIModel`, etc.) still work
- `LLMModelToProvider` mapping still available (dynamically populated)
- `ModelCapabilitiesManager` wraps the new `ModelRegistryService`
- All existing API calls continue to work

## Adding New Models

### Static Models (Cloud Providers)

Add new models by updating the capabilities update script:

```typescript
// In api/scripts/update_model_capabilities.ts
const newModel = {
  modelId: 'new-model-id',
  displayName: 'New Model Name',
  family: 'Model Family',
  contextWindow: 100000,
  maxOutputTokens: 4096,
  pricing: {
    inputTokens: { basePrice: 0.000001 },
    outputTokens: { basePrice: 0.000005 },
    currency: 'USD',
    effectiveDate: '2025-01-01',
  },
  supportedFeatures: {
    functionCalling: true,
    json: true,
    streaming: true,
    vision: false,
    extendedThinking: false,
    promptCaching: false,
  },
  // ... other capabilities
};

this.registerModel('provider-name', newModel);
```

### Dynamic Models (Ollama)

Dynamic models are automatically discovered. To add support for new features:

1. Update heuristics in `ModelRegistryService.modelSupportsTools()`
2. Update `ModelRegistryService.modelSupportsVision()`
3. Add new capability detection methods as needed

## Troubleshooting

### Ollama Discovery Issues

```typescript
// Check Ollama configuration
const config = projectConfig?.api?.llmProviders?.ollama;
console.log('Ollama enabled:', config?.enabled);
console.log('Ollama URL:', config?.baseUrl || 'http://localhost:11434');

// Check discovery logs
// Look for: "ModelRegistryService: Discovered X Ollama models"
```

### Missing Models

If a model is missing from the registry:

1. **Static models**: Run the update script to refresh model data
2. **Ollama models**: Check Ollama server is running and accessible
3. **Fallback**: System uses default capabilities for unknown models

### API Validation Errors

Run validation to check model data integrity:

```bash
deno run --allow-all api/scripts/update_model_capabilities.ts --validate-only
```

Common issues:
- Missing required properties
- Invalid pricing structure
- Constraint validation failures
- Malformed JSON

### Performance Considerations

- Model registry is initialized once at startup
- Ollama discovery is blocking but fast (5s timeout)
- Model data is cached in memory
- Dynamic refresh is available on-demand

## Future Enhancements

- **Additional Providers**: Support for more local model systems
- **Enterprise Models**: Custom fine-tuned model support
- **Model Versioning**: Track model updates and deprecations
- **Performance Metrics**: Model speed and quality tracking
- **Auto-refresh**: Periodic dynamic model updates
- **Model Recommendations**: Suggest optimal models for specific tasks