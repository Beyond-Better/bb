# MultiModelQuery Tool Implementation Notes

## Overview

The multiModelQuery tool is designed to query multiple LLM models with the same prompt and return their responses. This tool allows users to compare outputs from different models and providers easily.

## Current Implementation

### File Structure

```
api/src/llms/tools/multiModelQuery.tool/
├── tool.ts
├── info.json
├── formatter.browser.tsx
├── formatter.console.ts
├── providers/
│   ├── anthropic.ts
│   └── openai.ts
└── tests/
    └── tool.test.ts
```

### Key Components

1. **Main Tool File (tool.ts)**
   - Defines the `MultiModelQueryTool` class
   - Implements the `runTool` method to query multiple models
   - Defines the input schema for the tool
   - Manages different providers
   - Handles errors and aggregates results

2. **Info File (info.json)**
   - Contains metadata about the tool (name, description, version, etc.)

3. **Formatters**
   - `formatter.browser.tsx`: Formats tool use and results for browser display
   - `formatter.console.ts`: Formats tool use and results for console output

4. **Providers**
   - `anthropic.ts`: Implements Anthropic API calls using @anthropic-ai/sdk
   - `openai.ts`: Implements OpenAI API calls using openai npm package

5. **Test File (tool.test.ts)**
   - Contains tests for successful queries, invalid providers, and API error handling
   - Uses stubs to mock API responses

## Current Functionality

- Accepts a query and a list of models to query
- Supports Anthropic and OpenAI providers with actual API implementations
- Formats output for both browser and console display
- Handles errors for unsupported providers and API failures
- Aggregates responses from multiple models

## Recent Changes

1. Implemented actual API calls for Anthropic and OpenAI:
   - Updated `anthropic.ts` and `openai.ts` to use respective SDKs
   - Added error handling for API requests
2. Enhanced `tool.ts`:
   - Improved error handling and result aggregation
   - Updated `runTool` method to handle multiple model queries
3. Updated test suite:
   - Added tests for successful queries with multiple models
   - Implemented tests for invalid providers
   - Added tests for API error handling
   - Used stubs to mock API responses
4. Secure API Key Handling:
   - Implemented a secure method for storing and accessing API keys
   - Using a tool-specific configuration file or environment variables

## Next Steps

1. **Error Handling and Logging**
   - Implement more detailed error logging for API calls and tool execution
   - Consider adding a retry mechanism for failed API calls
   - Implement graceful degradation if some models fail but others succeed

2. **Performance Optimization**
   - Implement parallel querying for multiple models
   - Add caching mechanism for repeated queries (if applicable)
   - Optimize memory usage for large responses

3. **User Experience Enhancements**
   - Add progress indicators for long-running queries
   - Implement a way to cancel ongoing queries
   - Add options for comparing responses (e.g., diff view)

4. **Additional Providers**
   - Implement Google API provider
   - Add support for local models like Llama
   - Create a flexible system for adding new providers easily

5. **Documentation**
   - Create comprehensive documentation for using the tool
   - Add examples and use cases in the documentation
   - Document the process for adding new providers

6. **Integration with BB System**
   - Ensure smooth integration with the broader BB system
   - Implement any necessary hooks or event emitters
   - Update global type definitions if needed

7. **Testing Enhancements**
   - Add more edge case tests (e.g., very long queries, rate limiting scenarios)
   - Implement integration tests with mock API servers
   - Add performance benchmarks

## Implementation Details

### API Calls

- Anthropic API:
  - Uses `@anthropic-ai/sdk` package
  - Creates a client with `ANTHROPIC_API_KEY` from environment
  - Uses `messages.create` method for queries
- OpenAI API:
  - Uses `openai` npm package
  - Creates a client with `OPENAI_API_KEY` from environment
  - Uses `chat.completions.create` method for queries

### Error Handling

- Each provider implements its own error handling
- The main tool aggregates errors from all providers
- Throws a single error with details if any model query fails

### Testing

- Uses Deno's built-in testing framework
- Implements stubs to mock API responses
- Tests cover successful queries, invalid providers, and API errors

## Considerations

- Ensure compliance with API terms of service for each provider
- Consider implementing a fallback mechanism if a provider is unavailable
- Think about how to handle different token limits across models
- Plan for versioning and backwards compatibility as the tool evolves

## Conclusion

The multiModelQuery tool now provides a functional way to compare responses from multiple LLM models. The next steps focus on enhancing its robustness, performance, and user experience. By addressing these areas, we can create a powerful and reliable tool for multi-model querying within the BB system.
