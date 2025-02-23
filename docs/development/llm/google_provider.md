# Google (Gemini) Provider Implementation

This document details the implementation of the Google Gemini provider in BB, including key learnings from the documentation, implementation decisions, and remaining tasks.

## API Understanding

### 1. Content Structure
The Google API uses a structured content format that differs from other providers:

```typescript
interface Content {
    role: string;
    parts: Part[];
}

type Part = 
    | TextPart 
    | InlineDataPart 
    | FunctionCallPart 
    | FunctionResponsePart 
    | FileDataPart 
    | ExecutableCodePart 
    | CodeExecutionResultPart;
```

Key differences:
- Parts array instead of single content
- Strict type separation for different content types
- No nested content structures
- Explicit function call/response parts

### 2. Function Calling
Google's function calling implementation follows OpenAPI standards:

```typescript
interface FunctionDeclaration {
    type: 'function';
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
    };
}

interface FunctionCall {
    name: string;
    args: object;  // Direct object, not stringified
}

interface FunctionResponse {
    name: string;
    response: object;  // Direct object, not stringified
}
```

Important notes:
- Args and responses are objects, not strings (unlike some other providers)
- Function declarations require explicit type: 'function'
- OpenAPI schema format for parameters

### 3. Safety Features
Google provides comprehensive safety features:

```typescript
interface SafetyRating {
    category: HarmCategory;
    probability: HarmProbability;
}

enum HarmCategory {
    HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
    HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
    HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
    HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT"
}
```

Safety handling includes:
- Safety ratings per response
- Content blocking
- Safety-related finish reasons
- Prompt feedback for blocked content

### 4. Stop Reasons
Google provides detailed finish reasons that need mapping to BB's format:

```typescript
enum FinishReason {
    BLOCKLIST = "BLOCKLIST",
    FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
    LANGUAGE = "LANGUAGE",
    MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL",
    MAX_TOKENS = "MAX_TOKENS",
    OTHER = "OTHER",
    PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
    RECITATION = "RECITATION",
    SAFETY = "SAFETY",
    SPII = "SPII",
    STOP = "STOP"
}

// Mapped to BB's format:
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
```

## Current Implementation

### 1. Message Conversion
The implementation converts between BB's message format and Google's Content format:

```typescript
private asProviderMessageType(messages: LLMMessage[]): Content[] {
    return messages.map(message => ({
        role: message.role,
        parts: message.content.map(part => {
            if (part.type === 'text') {
                // Preserve file metadata blocks
                if (part.text.includes(BB_FILE_METADATA_DELIMITER)) {
                    return { text: part.text };
                }
                return { text: part.text };
            } else if (part.type === 'image') {
                return {
                    inlineData: {
                        data: part.source.data,
                        mimeType: part.source.mimeType
                    }
                };
            } else if (part.type === 'tool_result') {
                return {
                    functionResponse: {
                        name: part.tool_use_id || '',
                        response: part.content
                    }
                };
            }
        })
    }));
}
```

Key decisions:
- Preserve file metadata exactly as-is
- Convert images to InlineDataPart format
- Handle tool results as function responses
- Maintain role information

### 2. Tool Configuration
The implementation includes proper tool configuration and schema cleaning:

```typescript
Schema cleaning is required because Google's API doesn't support the 'default' key in function parameter schemas:

```typescript
/**
 * Recursively clean a schema object by removing 'default' keys
 */
private cleanSchema(schema: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(schema)) {
        // Skip 'default' key
        if (key === 'default') continue;
        
        // Recursively clean nested objects
        if (value && typeof value === 'object') {
            cleaned[key] = this.cleanSchema(value);
        } else {
            cleaned[key] = value;
        }
    }
    
    return cleaned;
}
```

This cleaning is applied when converting tools to Google's format:
```typescript
private asProviderToolType(tools: LLMTool[]): Tool[] {
    return tools.map(tool => ({
        functionDeclarations: [{
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: {
                type: 'object',
                properties: this.cleanSchema(tool.inputSchema.properties || {}),
                required: tool.inputSchema.required || []
            }
        }]
    }));
}
```

The request format follows Google's API structure:

```typescript
interface GenerateContentRequest {
    contents: Content[];
    tools?: Tool[];
    toolConfig?: {
        functionCallingConfig: {
            mode: 'AUTO' | 'ANY' | 'NONE';
            allowedFunctionNames?: string[];
        };
    };
}
```

Current settings:
- Default mode: 'AUTO'
- No function name restrictions
- Tools included only when available

### 3. Response Processing
Response processing handles various aspects:

```typescript
const messageResponse: LLMProviderMessageResponse = {
    id: crypto.randomUUID(),  // Google doesn't provide message IDs
    type: 'message',
    role: 'assistant',
    model: model,
    fromCache: false,
    timestamp: new Date().toISOString(),
    answerContent: this.asApiMessageContentPartsType(candidate),
    answer: extractTextFromContent(this.asApiMessageContentPartsType(candidate)),
    isTool: this.hasFunctionCall(candidate),
    messageStop: {
        stopReason: this.mapFinishReason(candidate.finishReason),
        stopSequence: null,
    },
    usage: this.transformUsage(response.usageMetadata),
    rateLimit: {
        // Placeholder values until rate limiting is implemented
        requestsRemaining: 1000,
        requestsLimit: 1000,
        requestsResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tokensRemaining: 1000000,
        tokensLimit: 1000000,
        tokensResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
};
```

### 4. Token Usage
Token usage mapping from Google's format:

```typescript
interface UsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
}

private transformUsage(usageMetadata?: UsageMetadata): LLMTokenUsage {
    return {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
        cacheCreationInputTokens: 0,  // Not supported by Google
        cacheReadInputTokens: usageMetadata?.cachedContentTokenCount || 0,
        totalAllTokens: usageMetadata?.totalTokenCount || 0
    };
}
```

## Remaining Tasks

### 1. Rate Limiting
- [ ] Research Google's rate limit headers
- [ ] Implement proper rate limit tracking
- [ ] Add rate limit error handling
- [ ] Update placeholder values with real data

### 2. Streaming Support
- [ ] Implement streaming response handling
- [ ] Handle partial content updates
- [ ] Support token streaming
- [ ] Add streaming-specific error handling

### 3. Advanced Features
- [ ] Implement multi-tool usage
- [ ] Add compositional function calling
- [ ] Support code execution
- [ ] Add dynamic tool configuration

### 4. Error Handling
- [ ] Map all Google error types
- [ ] Improve error recovery
- [ ] Add retry logic
- [ ] Handle specific error conditions

### 5. Testing
- [ ] Create test suite
- [ ] Test all content types
- [ ] Test error conditions
- [ ] Test rate limiting
- [ ] Test streaming
- [ ] Test tool usage

### 6. Documentation
- [ ] Add inline code documentation
- [ ] Document error handling
- [ ] Add usage examples
- [ ] Document limitations

## Known Issues

### 1. Rate Limiting
Current implementation uses placeholder values:
```typescript
rateLimit: {
    requestsRemaining: 1000,  // Placeholder
    requestsLimit: 1000,      // Placeholder
    requestsResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    tokensRemaining: 1000000, // Placeholder
    tokensLimit: 1000000,     // Placeholder
    tokensResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
}
```

Need to:
- Identify actual rate limit headers
- Implement proper tracking
- Add rate limit error handling

### 2. Error Handling
Current implementation needs improvement:
- Better error type mapping
- More specific error messages
- Proper error recovery
- Rate limit error handling

### 3. Schema Compatibility
Google's function calling implementation has some limitations:
- No support for 'default' values in parameter schemas
- Requires explicit removal of 'default' keys
- May have other OpenAPI compatibility differences

Mitigation:
- Schema cleaning function removes unsupported keys
- Validation before sending to API
- Logging of schema modifications

### 4. Token Usage
Potential issues:
- Token counting differences
- Cache token handling
- Token limit enforcement

## Future Improvements

### 1. Performance
- [ ] Optimize content conversion
- [ ] Add response caching
- [ ] Improve error recovery
- [ ] Add performance metrics

### 2. Features
- [ ] Streaming support
- [ ] Better tool configuration
- [ ] Advanced function calling
- [ ] Code execution support

### 3. Monitoring
- [ ] Add usage tracking
- [ ] Improve error logging
- [ ] Add performance monitoring
- [ ] Track rate limits

### 4. Testing
- [ ] Expand test coverage
- [ ] Add integration tests
- [ ] Add performance tests
- [ ] Add stress tests

## References

1. Google API Documentation:
   - [Text Generation](https://ai.google.dev/gemini-api/docs/text-generation)
   - [Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
   - [API Reference](https://github.com/google-gemini/generative-ai-js)

2. BB Documentation:
   - [LLM Provider Guide](../llm/new_provider.md)
   - [Type Definitions](../../api/types/llms.types.ts)
   - [Base LLM Class](../../api/llms/providers/baseLLM.ts)

3. Related Implementations:
   - [Anthropic Provider](../../api/llms/providers/anthropicLLM.ts)
   - [OpenAI Provider](../../api/llms/providers/openAICompatLLM.ts)