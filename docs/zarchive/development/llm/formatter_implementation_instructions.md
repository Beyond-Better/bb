# Formatter Implementation Instructions

## Overview
These instructions guide the process of creating and updating formatter files for all tools in the BB project. The goal is to separate formatting logic from the main tool files and create consistent, type-safe formatters for both browser and console outputs.

## Steps for Each Tool

1. Create Formatter Files
   - Create two files in the `api/src/llms/tools/formatters/` directory:
     - `[toolName].browser.tsx`
     - `[toolName].console.ts`
   - Follow the naming convention used for `runCommandTool`.

2. Implement Browser Formatter (`[toolName].browser.tsx`)
   - Use the following import structure:
     ```typescript
     import { JSX } from 'preact';
     import { LLMToolInputSchema, LLMToolRunResultContent, LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
     ```
   - Implement `formatLogEntryToolUse` and `formatLogEntryToolResult` functions.
   - Return JSX elements for formatted output.
   - Reuse existing formatting logic from the main tool file.

3. Implement Console Formatter (`[toolName].console.ts`)
   - Use the following import structure:
     ```typescript
     import { LLMToolInputSchema, LLMToolRunResultContent, LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
     import { colors } from 'cliffy/ansi/colors';
     import { stripIndents } from 'common-tags';
     ```
   - Implement `formatLogEntryToolUse` and `formatLogEntryToolResult` functions.
   - Return strings for formatted output.
   - Reuse existing formatting logic from the main tool file.

4. Update Main Tool File
   - Remove existing formatting logic (`formatLogEntryToolUse` and `formatLogEntryToolResult` methods).
   - Ensure the `fileName` property is correctly set in the constructor.

5. Error Handling
   - Implement basic error handling in formatter functions.
   - Delegate complex error handling to the `LogEntryFormatterManager` class.

6. Type Safety
   - Ensure all formatter functions are properly typed.
   - Use `LLMToolInputSchema` for input types and `LLMToolRunResultContent` for result types.

7. Metadata Handling
   - Remove any metadata formatting from the formatter files.
   - Metadata formatting will be handled directly by the CLI and BUI.

8. JSX Element Handling
   - For browser formatters, return JSX elements directly.
   - The `logEntryFormatter` handler will convert JSX elements to HTML strings before sending the response.
   - Ensure that the JSX structure can be properly rendered as HTML.

9. Fallback Content Handling
   - If a tool currently uses the `getContentFromToolResult` function from `llms.utils.ts`, maintain this usage in the formatter.
   - Import it as follows:
     ```typescript
     import { getContentFromToolResult } from 'api/utils/llms.utils.ts';
     ```

## General Guidelines

- Maintain consistency with the `runCommandTool` formatter files in terms of structure and naming.
- Ensure all imports use the correct paths as defined in the `import_map`.
- Keep formatting logic focused on the specific tool's requirements.
- Aim for clear, readable code with appropriate comments for complex logic.
- When creating JSX elements, use standard HTML tags and attributes that can be easily rendered as HTML strings.

## Example Structure

```typescript
// [toolName].browser.tsx
import { JSX } from 'preact';
import { LLMToolInputSchema, LLMToolRunResultContent, LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.utils.ts';

export const formatLogEntryToolUse = (
  toolInput: LLMToolInputSchema,
  format: LLMToolFormatterDestination = 'browser'
): JSX.Element => {
  // Implementation
  return (
    <div className="tool-use">
      {/* Format toolInput as JSX */}
    </div>
  );
};

export const formatLogEntryToolResult = (
  resultContent: ConversationLogEntryContentToolResult,
  format: LLMToolFormatterDestination = 'browser'
): JSX.Element => {
  // Implementation
  // Use getContentFromToolResult if necessary
  const content = getContentFromToolResult(toolResult);
  return (
    <div className="tool-result">
      {/* Format content as JSX */}
    </div>
  );
};

// [toolName].console.ts
import { LLMToolInputSchema, LLMToolRunResultContent, LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
import { colors } from 'cliffy/ansi/colors';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from 'api/utils/llms.utils.ts';

export const formatLogEntryToolUse = (
  toolInput: LLMToolInputSchema,
  format: LLMToolFormatterDestination = 'console'
): string => {
  // Implementation
  return stripIndents`
    Tool Input:
    ${/* Format toolInput as string */}
  `;
};

export const formatLogEntryToolResult = (
  resultContent: ConversationLogEntryContentToolResult,
  format: LLMToolFormatterDestination = 'console'
): string => {
  // Implementation
  // Use getContentFromToolResult if necessary
  const content = getContentFromToolResult(toolResult);
  return stripIndents`
    Tool Output:
    ${/* Format content as string */}
  `;
};
```

Follow these instructions for each tool in the project to ensure consistent and maintainable formatting across all tools.