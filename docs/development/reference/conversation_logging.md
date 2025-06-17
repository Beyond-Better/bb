# Conversation Logging and Formatting in BB

## Overview

This document outlines the conversation logging and formatting system for BB, focusing on techniques for efficient and flexible logging across the API, CLI, and BUI components. The primary goal is to maintain a centralized logging system in the API while providing dynamic, tool-specific formatting capabilities for different output destinations.

## Key Components

1. CollaborationLogger (API)
2. CollaborationLogFormatter (CLI/BUI)
3. Dynamic Formatter Loader (CLI/BUI)
4. Formatter Provider (API)

## Logging Structure

The CollaborationLogger in the API is responsible for creating and storing log entries in a JSON format. Each log entry contains:

- Type (e.g., 'user', 'assistant', 'tool_use', 'tool_result', 'auxiliary')
- Timestamp
- Content (raw data)
- Metadata (e.g., conversation stats, token usage)

Example log entry structure:

```json
{
  "type": "tool_use",
  "timestamp": "2023-05-01T12:34:56.789Z",
  "toolName": "searchAndReplace",
  "content": {
    "filePath": "example.txt",
    "operations": [
      {
        "search": "foo",
        "replace": "bar"
      }
    ]
  },
  "metadata": {
    "interactionStats": {
      "statementCount": 5,
      "statementTurnCount": 2,
      "interactionTurnCount": 10
    },
    "tokenUsage": {
      "inputTokens": 50,
      "outputTokens": 30,
      "totalTokens": 80
    }
  }
}
```

## Dynamic Formatting System

To allow for flexible, tool-specific formatting while keeping the formatting logic centralized in the API, we implement a dynamic formatting system:

1. The API provides a formatter endpoint that serves JavaScript modules containing formatting functions for each tool and log entry type.
2. The CLI and BUI use a dynamic loader to import these formatting functions at runtime.

### Formatter Provider (API)

The API exposes an endpoint that serves JavaScript modules containing formatting functions:

```typescript
// api/src/routes/api/formatter.handlers.ts

import { Router } from "oak";
import { LLMToolManager } from "../../llms/llmToolManager.ts";
import { LogFormatterManager } from "../../utils/logFormatterManager.ts";

export function createFormatterRouter(toolManager: LLMToolManager, formatterManager: LogFormatterManager) {
  const router = new Router();

  router.get("/formatter/:formatterType/:name", async (ctx) => {
    const { formatterType, name } = ctx.params;
    let formatterCode: string;

    if (formatterType === 'tool') {
      const tool = toolManager.getTool(name);
      if (!tool) {
        ctx.response.status = 404;
        ctx.response.body = `Tool '${name}' not found`;
        return;
      }
      formatterCode = `
        export function formatLogEntryToolUse(input, format) {
          return ${tool.formatters.useInput.toString()}(input, format);
        }
        export function formatLogEntryToolResult(result, format) {
          return ${tool.formatters.useResult.toString()}(result, format);
        }
      `;
    } else if (formatterType === 'logEntry') {
      const formatter = formatterManager.getFormatter(name);
      if (!formatter) {
        ctx.response.status = 404;
        ctx.response.body = `Formatter for '${name}' not found`;
        return;
      }
      formatterCode = `
        export function formatLogEntry(entry, format) {
          return ${formatter.toString()}(entry, format);
        }
      `;
    } else {
      ctx.response.status = 400;
      ctx.response.body = `Invalid formatter type: ${formatterType}`;
      return;
    }

    ctx.response.type = "application/javascript";
    ctx.response.body = formatterCode;
  });

  return router;
}
```

### Dynamic Formatter Loader (CLI/BUI)

The CLI and BUI use a dynamic loader to import formatting functions:

```typescript
// src/shared/utils/dynamicFormatter.ts

export class DynamicFormatter {
  private formatters = new Map<string, {
    formatLogEntryToolUse?: (input: any, format: string) => string;
    formatLogEntryToolResult?: (result: any, format: string) => string;
    formatLogEntry?: (entry: any, format: string) => string;
  }>();

  constructor(private apiBaseUrl: string) {}

  async getFormatter(formatterType: 'tool' | 'logEntry', name: string) {
    const key = `${formatterType}:${name}`;
    if (!this.formatters.has(key)) {
      await this.loadFormatter(formatterType, name);
    }
    return this.formatters.get(key);
  }

  private async loadFormatter(formatterType: 'tool' | 'logEntry', name: string) {
    const url = `${this.apiBaseUrl}/formatter/${formatterType}/${name}`;
    const module = await import(url);
    this.formatters.set(`${formatterType}:${name}`, module);
  }
}
```

### Usage in CLI/BUI

```typescript
// cli/src/commands/viewLogs.ts (similar for BUI)

import { DynamicFormatter } from "../utils/dynamicFormatter.ts";

const formatter = new DynamicFormatter("https://localhost:3162/api");

async function displayLogEntry(entry: LogEntry) {
  let formatted: string;

  if (entry.type === "tool_use" || entry.type === "tool_result") {
    const toolFormatter = await formatter.getFormatter('tool', entry.toolName);
    if (toolFormatter) {
      formatted = entry.type === "tool_use"
        ? toolFormatter.formatLogEntryToolUse(entry.content, "console")
        : toolFormatter.formatLogEntryToolResult(entry.content, "console");
    } else {
      console.error(`Unable to format ${entry.type} for tool ${entry.toolName}`);
      return;
    }
  } else {
    const logEntryFormatter = await formatter.getFormatter('logEntry', entry.type);
    if (logEntryFormatter) {
      formatted = logEntryFormatter.formatLogEntry(entry, "console");
    } else {
      console.error(`Unable to format log entry of type ${entry.type}`);
      return;
    }
  }

  console.log(formatted);
}
```

## Considerations and Best Practices

1. Security:
   - Sanitize and validate the generated code before execution in CLI/BUI.
   - Use Content Security Policy (CSP) headers to restrict script execution if needed in the future.

2. Caching:
   - Implement caching in the CLI and BUI to store frequently used formatters.
   - Use cache invalidation strategies to ensure formatters are up-to-date.

3. Error Handling:
   - Implement robust error handling for cases where a formatter can't be loaded or executed.
   - Provide fallback formatting options for when dynamic loading fails.

4. Performance:
   - Monitor the performance impact of dynamic imports and optimize if necessary.
   - Implement a simple bundling system for commonly used formatters to improve initial load times.

5. Versioning:
   - Implement a versioning system for formatters to manage updates and backwards compatibility.
   - Include version information in formatter requests and responses.
   - Maintain multiple versions of formatters when necessary for backwards compatibility.

6. Offline Support and Fallback:
   - Implement a robust offline support system that allows CLI/BUI to function with full formatting capabilities when not connected to the API.
   - Create a fallback mechanism that uses basic formatting when specific formatters are unavailable.
   - Regularly sync and cache formatters for offline use.

7. Testing:
   - Develop comprehensive unit and integration tests for the dynamic formatting system.
   - Include tests for various edge cases and error scenarios.

## Conclusion

This dynamic formatting system allows for flexible, tool-specific formatting while keeping the core logging logic centralized in the API. By using runtime imports, we can provide up-to-date formatting capabilities to the CLI and BUI without requiring frequent updates to these components. This approach balances the need for centralized logic with the flexibility required for diverse output formats and tool-specific formatting needs.