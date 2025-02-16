# Creating a New LLM Provider

This guide outlines the process of implementing a new LLM provider in BB. It's based on our experience implementing various providers like Anthropic, OpenAI, and Google.

## Implementation Steps

### 1. Provider Class Setup
```typescript
class NewProviderLLM extends LLM {
    private client!: ProviderClient;

    constructor(callbacks: LLMCallbacks) {
        super(callbacks);
        this.llmProviderName = LLMProvider.NEW_PROVIDER;
        this.initializeClient();
    }
}
```

### 2. Core Methods to Implement

#### a. Client Initialization
- Initialize the provider's client with API key and configuration
- Handle configuration errors appropriately
```typescript
private async initializeClient() {
    const apiKey = this.projectConfig.settings.api?.llmProviders?.newProvider?.apiKey;
    if (!apiKey) {
        throw createError(
            ErrorType.LLM,
            'API key is not configured',
            { provider: this.llmProviderName } as LLMErrorOptions,
        );
    }
    this.client = new ProviderClient(apiKey);
}
```

#### b. Message Type Conversion
- Convert BB's message format to provider's format
- Handle all content types:
  - Text content
  - File content (with metadata)
  - Image content
  - Tool results
- Preserve metadata and context

Example type mapping:
```typescript
// BB's format:
interface LLMMessageContentPart {
    type: 'text' | 'image' | 'tool_result';
    text?: string;
    source?: {
        type: 'base64';
        data: string;
        mimeType: string;
    };
}

// Provider's hypothetical format:
interface ProviderContent {
    type: string;
    content: string | ImageData;
    metadata?: Record<string, unknown>;
}

// Conversion function:
private asProviderMessageType(messages: LLMMessage[]): ProviderContent[] {
    return messages.map(message => {
        return message.content.map(part => {
            if (part.type === 'text') {
                return {
                    type: 'text',
                    content: part.text || ''
                };
            } else if (part.type === 'image') {
                return {
                    type: 'image',
                    content: {
                        data: part.source?.data || '',
                        mimeType: part.source?.mimeType || ''
                    }
                };
            }
            // Handle other types...
        });
    });
}
```

#### c. Tool Type Conversion
- Convert BB's tool format to provider's format
- Handle tool configuration options
- Preserve tool descriptions and schemas

Example:
```typescript
private asProviderToolType(tools: LLMTool[]): ProviderTool[] {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: this.convertSchema(tool.inputSchema),
        config: this.getToolConfig(tool)
    }));
}

/**
 * Some providers may have limitations or differences in their schema support.
 * Always check the provider's documentation for:
 * - Supported schema keywords
 * - Required vs optional fields
 * - Schema validation rules
 */
private convertSchema(schema: LLMToolInputSchema): ProviderSchema {
    // Example schema cleaning function
    const cleanSchema = (obj: Record<string, any>): Record<string, any> => {
        const cleaned: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Skip provider-incompatible keys
            if (key === 'default' || key === 'examples') continue;
            
            // Clean nested objects
            if (value && typeof value === 'object') {
                cleaned[key] = cleanSchema(value);
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    };

    // Convert and clean the schema
    return {
        type: schema.type,
        properties: Object.entries(schema.properties || {}).reduce(
            (acc, [key, prop]) => ({
                ...acc,
                [key]: {
                    type: prop.type,
                    description: prop.description,
                    required: schema.required?.includes(key) || false
                }
            }),
            {}
        )
    };
}
```

### 3. Provider-Specific Configuration

#### a. Model Configuration
```typescript
interface ProviderConfig {
    model: string;
    apiVersion?: string;
    baseURL?: string;
    defaultParams?: {
        temperature?: number;
        maxTokens?: number;
        // Other provider-specific params
    };
}

// In projectConfig.ts
export interface ProjectConfig {
    settings: {
        api?: {
            llmProviders?: {
                newProvider?: {
                    apiKey: string;
                    config: ProviderConfig;
                };
            };
        };
    };
}
```

#### b. Feature Configuration
```typescript
interface ProviderFeatures {
    streamingSupported: boolean;
    multimodalSupported: boolean;
    maxContextWindow: number;
    supportedContentTypes: string[];
}

class NewProviderLLM extends LLM {
    private features: ProviderFeatures;

    constructor(callbacks: LLMCallbacks) {
        super(callbacks);
        this.features = this.initializeFeatures();
    }

    private initializeFeatures(): ProviderFeatures {
        return {
            streamingSupported: true,
            multimodalSupported: false,
            maxContextWindow: 128000,
            supportedContentTypes: ['text', 'image']
        };
    }
}
```

### 4. Required Interfaces

#### Token Usage
- Map provider's token counting to BB's format:
```typescript
interface LLMTokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    totalAllTokens?: number;
}

// Example mapping:
private transformUsage(providerUsage: ProviderUsage): LLMTokenUsage {
    return {
        inputTokens: providerUsage.prompt_tokens || 0,
        outputTokens: providerUsage.completion_tokens || 0,
        totalTokens: providerUsage.total_tokens || 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalAllTokens: providerUsage.total_tokens || 0
    };
}
```

#### Message Stop Reasons
- Map provider's completion reasons to BB's format:
```typescript
type stopReason = 
    | 'tool_use'
    | 'stop_sequence'
    | 'end_turn'
    | 'max_tokens'
    | 'stop'
    | 'length'
    | 'tool_calls'
    | 'content_filter'
    | 'function_call'
    | null;

// Example mapping:
private mapStopReason(providerReason: string): LLMMessageStop['stopReason'] {
    switch (providerReason) {
        case 'length_limit': return 'max_tokens';
        case 'end_sequence': return 'stop';
        case 'content_safety': return 'content_filter';
        case 'function_execution': return 'tool_calls';
        default: return null;
    }
}
```

### 5. Versioning Considerations

- Check provider's API version compatibility
- Handle version-specific features
- Document version requirements

Example:
```typescript
private checkApiVersion() {
    const minVersion = '2.0.0';
    const currentVersion = this.client.getApiVersion();
    if (!this.isVersionCompatible(currentVersion, minVersion)) {
        throw new Error(`Provider API version ${currentVersion} is not compatible. Minimum required: ${minVersion}`);
    }
}
```

### 6. Error Handling
- Handle API errors
- Handle content filtering/blocking
- Handle rate limiting
- Handle token limits
- Handle malformed responses

Example:
```typescript
try {
    const response = await this.client.generateResponse(request);
    // Process response...
} catch (error) {
    if (error instanceof ProviderRateLimitError) {
        // Handle rate limiting
        logger.warn(`Rate limit exceeded: ${error.message}`);
        throw createError(
            ErrorType.LLM,
            'Rate limit exceeded',
            { provider: this.llmProviderName, retryAfter: error.retryAfter }
        );
    } else if (error instanceof ProviderContentFilterError) {
        // Handle content filtering
        logger.warn(`Content filtered: ${error.message}`);
        throw createError(
            ErrorType.LLM,
            'Content filtered by provider',
            { provider: this.llmProviderName, reason: error.filterReason }
        );
    }
    // Handle other errors...
}
```

### 7. Logging
Add detailed logging for:
- Message processing
- Content type detection
- File content handling
- Tool/function handling
- Response processing
- Error conditions

Example:
```typescript
private asProviderMessageType(messages: LLMMessage[]): ProviderContent[] {
    logger.debug(`Converting ${messages.length} messages to provider format`);
    
    return messages.map((message, index) => {
        logger.debug(`Processing message ${index + 1}/${messages.length}`);
        logger.debug(`Message role: ${message.role}, content parts: ${message.content.length}`);
        
        const converted = this.convertContent(message);
        logger.debug(`Converted message: ${JSON.stringify(converted)}`);
        
        return converted;
    });
}
```

## Implementation Checklist

1. Basic Setup:
   - [ ] Provider class extending LLM
   - [ ] Client initialization
   - [ ] Configuration handling
   - [ ] Version compatibility check

2. Message Handling:
   - [ ] Text content conversion
   - [ ] File content handling
   - [ ] Image content handling
   - [ ] Tool result handling
   - [ ] Metadata preservation

3. Tool Support:
   - [ ] Tool declaration conversion
   - [ ] Tool configuration
   - [ ] Function call handling
   - [ ] Function response handling

4. Response Processing:
   - [ ] Token usage mapping
   - [ ] Stop reason mapping
   - [ ] Safety rating handling
   - [ ] Error handling
   - [ ] Rate limit handling

5. Logging:
   - [ ] Message processing logs
   - [ ] Content handling logs
   - [ ] Tool usage logs
   - [ ] Error condition logs

## Common Pitfalls

1. Token Counting:
   - Different providers count tokens differently
   - Some providers don't provide all token metrics
   - Cache-related tokens may not be available

2. Content Handling:
   - File metadata needs preservation
   - Image formats may vary
   - Content type detection must be robust

3. Tool/Function Calling:
   - Function call formats vary
   - Response formats vary
   - Tool configurations differ
   - Schema compatibility varies:
     * Some providers don't support 'default' values
     * OpenAPI schema support differs between providers
     * Nested schema handling varies
     * Schema validation rules may be stricter
   - Schema cleaning may be required:
     * Remove unsupported keys
     * Transform incompatible formats
     * Handle nested schema structures
     * Validate transformed schemas

4. Error Handling:
   - Rate limits may be unclear
   - Error formats vary
   - Safety filter behavior differs

## Best Practices

1. Type Safety:
   - Use TypeScript interfaces for all provider types
   - Map provider types to BB types explicitly
   - Handle optional fields carefully

2. Error Handling:
   - Use appropriate error types
   - Include provider-specific details
   - Log errors with context

3. Logging:
   - Log all major operations
   - Include relevant context
   - Help with debugging

4. Testing:
   - Test all content types
   - Test error conditions
   - Test rate limiting
   - Test with real API calls