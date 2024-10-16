# Formatter Implementation Plan

## Overview

This document outlines the plan for implementing formatters for tool input and output in the BB project. The goal is to provide flexible, maintainable, and type-safe formatting for both console and browser environments.

## Considered Approaches

### Option A: Centralized Formatting

Create a single file (e.g., `browserFormatters.tsx`) containing formatting functions for all tools.

Pros:
- All browser-specific formatting in one place
- Easier to manage and update
- Keeps tool files focused on primary functionality

Cons:
- May become unwieldy with a large number of tools

### Option B: Formatting Directory

Create a subdirectory within `tools` for formatting-related files.

Structure:
```
tools/
  runCommandTool.ts
  searchProjectTool.ts
  ...
  formatters/
    runCommandTool.browser.tsx
    runCommandTool.console.ts
    searchProjectTool.browser.tsx
    searchProjectTool.console.ts
    ...
```

Pros:
- Clear separation of concerns
- Scalable for future additions
- Keeps main tool files as .ts

Cons:
- Increases the number of files in the project

### Option C: JavaScript-based Approach

Use a JavaScript object structure to represent the component tree, interpretable by Preact components.

Example:

```typescript
// api/src/llms/tools/runCommandTool.formatter.ts

import { VNode } from 'preact';
import { LLMToolInputSchema, LLMToolRunResultContent } from '../llmTool.ts';

export const formatToolUse = (input: LLMToolInputSchema): VNode => {
  return {
    type: 'div',
    props: {
      className: "tool-use run-command",
      children: [
        { type: 'h3', props: { children: "Run Command Tool" } },
        {
          type: 'p',
          props: {
            children: [
              { type: 'strong', props: { children: "Command:" } },
              " ",
              { type: 'span', props: { style: { color: '#DAA520' }, children: input.command } }
            ]
          }
        },
        input.args && input.args.length > 0 ? {
          type: 'p',
          props: {
            children: [
              { type: 'strong', props: { children: "Arguments:" } },
              " ",
              { type: 'span', props: { style: { color: '#4169E1' }, children: input.args.join(' ') } }
            ]
          }
        } : null
      ].filter(Boolean)
    }
  };
};

// ... similar structure for formatToolResult
```

Pros:
- Avoids need for .tsx files
- Maintains type safety
- Can be used in standard .ts files

Cons:
- Less readable HTML structure
- May be more verbose than JSX

## Chosen Approach

After careful consideration, Option B (Formatting Directory) has been chosen for implementation. This approach provides a good balance between separation of concerns, scalability, and maintainability.

## Implementation Steps

1. Create a `formatters` directory within the `tools` directory.
2. For each tool, create two formatter files:
   - `<toolName>.browser.tsx` for browser formatting
   - `<toolName>.console.ts` for console formatting
3. Implement formatting functions in each file, using the existing `formatToolUse` and `formatToolResult` methods as a base.
4. Update the main tool files to remove formatting logic, keeping only the core functionality.
5. Update the `LogEntryFormatterManager` to use the new formatter files.
6. Update `logEntryFormatter.handlers.ts` to serve the correct formatter based on the client request.
7. Implement necessary changes in the CLI and BUI to use the new formatting system.

## Next Steps

- Implement the chosen approach for the RunCommand tool as a prototype.
- Review and refine the implementation.
- Gradually apply the same pattern to other tools.
- Update documentation and tests to reflect the new structure.
