# Model Capabilities System

The BB project uses a comprehensive model capabilities system to manage model-specific defaults, constraints, and pricing information. This document explains how the system works, how to use it in code, and how to keep model data up-to-date.

## Overview

The model capabilities system provides:

1. **Canonical Storage** for model-specific capabilities and constraints
2. **Parameter Resolution** with a clear priority hierarchy
3. **Default Values** optimized for different interaction types
4. **Validation** to ensure parameters stay within model constraints
5. **User Preferences** that override defaults without changing core data

## System Components

### Model Capabilities Data

Model capabilities are stored in `api/src/data/modelCapabilities.json` with a structured format that includes:

- Context window and token limits
- Detailed pricing structure with cached token support
- Feature support flags
- Default parameters
- Parameter constraints
- System prompt behavior

### ModelCapabilitiesManager

The `ModelCapabilitiesManager` class in `api/src/utils/modelCapabilitiesManager.ts` handles:

- Loading and caching model data
- Parameter resolution using a priority system
- Value validation against model constraints

### Integration with Interactions

The `LLMInteraction` base class includes methods to:

- Provide interaction-specific parameter preferences
- Interface with the capabilities manager for parameter resolution

## Parameter Resolution Hierarchy

The system resolves parameters using this priority order:

1. **Explicit Request Value**: Parameters explicitly provided in the request
2. **User Preference**: User-configured defaults in project config
3. **Interaction Type Default**: Optimized defaults based on interaction type (chat, conversation, etc.)
4. **Model Capability Default**: Model-specific defaults from capabilities data
5. **Global Fallback**: System-wide defaults if nothing else is specified

## Using the System in Code

### Resolving Model Parameters in Interactions

```typescript
// Access the interaction's resolve method
const resolved = await interaction.resolveModelParameters(
  model,
  explicitMaxTokens, // Optional, can be undefined
  explicitTemperature, // Optional, can be undefined
  LLMProvider.ANTHROPIC, // Optional, can be undefined
);

// Use the resolved parameters
const maxTokens = resolved.maxTokens;
const temperature = resolved.temperature;
```

### Checking Model Capabilities

```typescript
const capabilitiesManager = await ModelCapabilitiesManager.getInstance().initialize();

// Check if a model supports specific features
const supportsFunctions = capabilitiesManager.supportsFeature(
  'claude-3-7-sonnet-20250219',
  'functionCalling'
);

// Get full capabilities for a model
const capabilities = capabilitiesManager.getModelCapabilities(
  'claude-3-7-sonnet-20250219'
);
```

## User Preferences

Users can set their preferred defaults for model parameters in the project configuration. These preferences override model defaults but can be overridden by explicit request values.

### Setting User Preferences

In `.bb/config.yaml`:

```yaml
settings:
  api:
    llmProviders:
      anthropic:
        apiKey: "sk-ant-xxxx"
        userPreferences:
          temperature: 0.5
          maxTokens: 4096
      openai:
        apiKey: "sk-xxxx"
        userPreferences:
          temperature: 0.8
          maxTokens: 2048
```

## Updating Model Capabilities

Model capabilities can be updated using the model capabilities update script. This script fetches the latest model information from provider APIs or documentation and updates the capabilities file.

### Running the Update Script

Simplest method using the API task:

```bash
deno task -c api/deno.jsonc update-model-capabilities
```

Or directly:

```bash
deno run --allow-net --allow-read --allow-write --allow-env scripts/update_model_capabilities.ts
```

### Script Options

```bash
# Specify output path
deno run scripts/update_model_capabilities.ts --output=./custom/path/modelCapabilities.json

# Fetch only specific providers
deno run scripts/update_model_capabilities.ts --providers=anthropic,openai

# Provide API keys
deno run scripts/update_model_capabilities.ts \
  --anthropic-key=sk-ant-xxx \
  --openai-key=sk-xxx \
  --google-key=xxx
```

You can also use environment variables for API keys:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx OPENAI_API_KEY=sk-xxx \
  deno run scripts/update_model_capabilities.ts
```

## Adding New Models

To add a new model to the capabilities system:

1. Update the model capabilities update script to fetch or define the new model
2. Run the script to update the capabilities file
3. Ensure the appropriate enum is updated in `api/src/types/llms.types.ts`

For example, to add a new Anthropic model:

```typescript
// In scripts/update_model_capabilities.ts
this.registerModel("anthropic", "claude-new-model", {
  contextWindow: 100000,
  maxOutputTokens: 4096,
  pricing: {
    inputTokens: {
      basePrice: 0.000001,
      cachedPrice: 0.00000005,
    },
    outputTokens: {
      basePrice: 0.000005,
    },
    currency: "USD",
    effectiveDate: "2025-01-01",
  },
  // Other capabilities...
});
```

## Troubleshooting

### Missing Model Capabilities

If a model is not found in the capabilities data, the system will use default fallback values. Check the logs for warnings like:

```
ModelCapabilitiesManager: No capabilities found for model anthropic/unknown-model
```

To fix this, add the model to the capabilities file using the update script.

### Parameter Validation

The system automatically validates parameters against model constraints. For example, if a temperature value is outside the valid range, it will be clamped to the nearest valid value. No error will be thrown, but the value will be adjusted.

## Future Improvements

- Server-based model capabilities updates
- Automatic synchronization with provider documentation
- More detailed pricing tiers and discounts
- Expanded feature detection
- Model comparison utilities
