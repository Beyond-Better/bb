# Complex Validation Rules Framework

The BB validation framework provides a flexible, JSON-based system for defining complex validation rules that can be applied to model capabilities and UI parameter constraints. This system enables dynamic UI-level input validation based on specific model and feature configurations.

## Overview

The framework consists of several components:

1. **Validation Engine**: Core rule evaluation engine
2. **Rule Service**: Manages rule sets and provides them to the API
3. **API Endpoints**: RESTful endpoints for validation operations
4. **BUI Integration**: React hooks and utilities for real-time validation
5. **JSON Configuration**: Externally configurable rule definitions

## Key Features

- **Complex Conditional Logic**: Support for AND/OR/NOT operations with nested conditions
- **Dynamic Constraints**: Real-time parameter constraint updates based on model capabilities
- **Auto-suggestions**: Automatic value suggestions based on validation rules
- **Field-level Validation**: Individual form field validation with visual feedback
- **JSON-based Configuration**: Externally configurable rules without code changes
- **Real-time Updates**: Debounced validation with immediate UI feedback

## Usage Examples

### Basic Rule Definition

```json
{
  "id": "claude_extended_thinking_temp",
  "name": "Claude Extended Thinking Temperature",
  "description": "When Claude Opus or Sonnet models have extended thinking enabled, temperature must be 1.0",
  "trigger": "on_change",
  "priority": 100,
  "condition": {
    "logic": "AND",
    "conditions": [
      {
        "field": "model",
        "operator": "matches_pattern",
        "value": "claude.*(?:opus|sonnet)",
        "description": "Model is Claude Opus or Sonnet"
      },
      {
        "field": "parameters.extendedThinking.enabled",
        "operator": "equals",
        "value": true,
        "description": "Extended thinking is enabled"
      }
    ]
  },
  "actions": [
    {
      "action": "set_value",
      "target": "temperature",
      "value": 1.0,
      "message": "Temperature automatically set to 1.0 for Claude models with extended thinking",
      "severity": "info"
    },
    {
      "action": "set_constraint",
      "target": "temperature",
      "value": { "min": 1.0, "max": 1.0 }
    }
  ],
  "enabled": true,
  "tags": ["claude", "extended_thinking", "temperature"]
}
```

### Complex Nested Conditions

```json
{
  "id": "complex_conditional_example",
  "name": "Complex Performance Warning",
  "condition": {
    "logic": "OR",
    "conditions": [
      {
        "logic": "AND",
        "conditions": [
          {
            "field": "model",
            "operator": "contains",
            "value": "gpt-4"
          },
          {
            "field": "parameters.temperature",
            "operator": "greater_than",
            "value": 0.8
          }
        ]
      },
      {
        "logic": "AND",
        "conditions": [
          {
            "field": "model",
            "operator": "contains",
            "value": "claude"
          },
          {
            "field": "parameters.maxTokens",
            "operator": "greater_than",
            "value": 16000
          }
        ]
      }
    ]
  },
  "actions": [
    {
      "action": "show_warning",
      "target": "parameters",
      "message": "High resource usage detected. Consider optimizing parameters for better performance.",
      "severity": "warning"
    }
  ]
}
```

## React Hook Integration

### Basic Validation Hook

```typescript
import { useValidation } from '../hooks/useValidation.ts';

function MyComponent({ apiClient, model, parameters }) {
  const [validationState, validationActions] = useValidation(
    apiClient,
    model,
    parameters,
    {
      context: 'chat_input',
      validateOnChange: true,
      debounceMs: 300,
    }
  );

  // Access validation results
  const isValid = validationState.result?.valid ?? true;
  const hasErrors = validationState.result?.messages.errors.length > 0;
  const suggestions = validationState.result?.suggestions ?? {};
  
  return (
    <div>
      {/* Your form components */}
    </div>
  );
}
```

### Field-specific Validation

```typescript
import { useFieldValidation } from '../hooks/useValidation.ts';

function TemperatureSlider({ apiClient, model, parameters, onChange }) {
  const fieldValidation = useFieldValidation(
    apiClient,
    model,
    parameters,
    'temperature'
  );

  return (
    <div>
      <input
        type="range"
        min={fieldValidation.field.min ?? 0}
        max={fieldValidation.field.max ?? 1}
        step={fieldValidation.field.step ?? 0.1}
        disabled={fieldValidation.field.disabled}
        className={fieldValidation.field.highlight ? 'highlighted' : ''}
        onChange={onChange}
      />
      {fieldValidation.field.message && (
        <div className={`message ${fieldValidation.field.severity}`}>
          {fieldValidation.field.message}
        </div>
      )}
    </div>
  );
}
```

### Submit Validation

```typescript
import { useSubmitValidation } from '../hooks/useValidation.ts';

function ChatForm({ apiClient, model, parameters, onSend }) {
  const submitValidation = useSubmitValidation(
    apiClient,
    model,
    parameters,
    'chat_input'
  );

  const handleSubmit = async () => {
    const isValid = await submitValidation.validateSubmission();
    if (isValid) {
      await onSend();
    }
  };

  return (
    <button
      onClick={handleSubmit}
      disabled={submitValidation.isValidating}
    >
      {submitValidation.isValidating ? 'Validating...' : 'Send'}
    </button>
  );
}
```

## API Endpoints

### Get Rule Sets

```bash
GET /api/v1/validation/rule-sets?context=chat_input
```

Returns all validation rule sets for the specified context.

### Validate Parameters

```bash
POST /api/v1/validation/validate
Content-Type: application/json

{
  "model": "claude-3-7-sonnet-20250219",
  "parameters": {
    "temperature": 0.7,
    "extendedThinking": {
      "enabled": true
    }
  },
  "context": "chat_input",
  "trigger": "on_change"
}
```

Returns validation results with constraints, suggestions, and messages.

### Preview Constraints

```bash
POST /api/v1/validation/preview
Content-Type: application/json

{
  "model": "claude-3-7-sonnet-20250219",
  "context": "chat_input"
}
```

Returns initial constraints and suggestions for a model without running full validation.

## Rule Definition Reference

### Condition Operators

- `equals` / `not_equals`: Exact value matching
- `contains` / `not_contains`: String/array containment
- `matches_pattern`: Regular expression matching
- `in` / `not_in`: Array membership
- `greater_than` / `less_than` / `greater_equal` / `less_equal`: Numeric comparisons

### Action Types

- `set_value`: Force a parameter to a specific value
- `set_constraint`: Apply min/max constraints to a parameter
- `disable_feature` / `enable_feature`: Control feature availability
- `show_warning` / `show_error`: Display messages to users
- `suggest_value`: Suggest a value without forcing it
- `require_feature`: Require another feature to be enabled

### Trigger Types

- `on_load`: Run when the form/component loads
- `on_change`: Run when parameters change
- `on_submit`: Run before form submission

## Configuration

### Adding New Rule Sets

1. Create a JSON file with your rule definitions
2. Load it in `ValidationRuleService.loadUserRuleSets()`
3. Or add rules programmatically using the service API

### Custom Evaluators

You can add custom condition evaluators to the validation engine:

```typescript
const validationEngine = new ValidationEngine({
  customEvaluators: {
    'custom_operator': (condition, context) => {
      // Your custom evaluation logic
      return true; // or false
    }
  }
});
```

## Best Practices

1. **Use Priorities**: Set higher priorities for critical rules that should override others
2. **Clear Messages**: Provide helpful, user-friendly validation messages
3. **Progressive Enhancement**: Use warnings for suggestions, errors for blocking issues
4. **Performance**: Use debouncing for real-time validation to avoid excessive API calls
5. **Testing**: Test complex conditional logic thoroughly with various parameter combinations

## Error Handling

The framework includes comprehensive error handling:

- Network errors are caught and reported in the validation state
- Invalid rules are logged but don't crash the application
- Fallback behaviors ensure the UI remains functional even if validation fails

## Debugging

Enable debug mode for detailed logging:

```typescript
const validationEngine = new ValidationEngine({
  debug: true
});
```

In development mode, the example component includes a debug panel showing the complete validation state.

## Migration Guide

To integrate the validation framework into existing components:

1. Add the validation hooks to your component
2. Replace hardcoded constraints with validation-driven constraints
3. Add visual feedback for validation states
4. Update form submission to use submit validation
5. Test with your existing rule sets

The framework is designed to be backward-compatible and can be gradually adopted across the application.