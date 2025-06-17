# Tool Migration Guide

This guide outlines the process for migrating BB tools to use the @beyondbetter/tools package.

## Overview

Tools are being migrated from the BB project to use the @beyondbetter/tools package. This:
- Provides a consistent interface for tools
- Allows tools to be developed independently
- Makes it easier to share tools between projects
- Ensures type safety and compatibility

## Migration Steps

### 1. Update Imports

Replace BB imports with @beyondbetter/tools:

```typescript
// Before
import LLMTool from 'api/llms/llmTool.ts';
import type { 
  LLMToolInputSchema, 
  LLMToolLogEntryFormattedResult, 
  LLMToolRunResult 
} from 'api/llms/llmTool.ts';

// After
import LLMTool from '@beyondbetter/tools';
import type { 
  LLMToolInputSchema, 
  LLMToolLogEntryFormattedResult, 
  LLMToolRunResult,
  IConversationInteraction,
  IProjectEditor
} from '@beyondbetter/tools';
```

### 2. Update Type References

Use interface types for ProjectEditor and ConversationInteraction:

```typescript
// Before
async runTool(
  interaction: LLMConversationInteraction,
  toolUse: LLMAnswerToolUse,
  projectEditor: ProjectEditor,
): Promise<LLMToolRunResult>

// After
async runTool(
  interaction: IConversationInteraction,
  toolUse: LLMAnswerToolUse,
  projectEditor: IProjectEditor,
): Promise<LLMToolRunResult>
```

### 3. Update Tool Implementation

Use interface methods instead of implementation details:

```typescript
// Before
await projectEditor.orchestratorController.logChangeAndCommit(
  interaction,
  dataSourceRoot,
  filePath,
  content
);

// After
await projectEditor.logAndCommitChanges(
  interaction,
  [filePath],
  [content]
);
```

### 4. Update Formatters

Ensure formatters use types from @beyondbetter/tools:

```typescript
// formatter.browser.tsx and formatter.console.ts
import type { 
  LLMToolInputSchema,
  LLMToolLogEntryFormattedResult 
} from '@beyondbetter/tools';
```

### 5. Testing Updates

Update test files to use interfaces:

```typescript
// Before
const mockProjectEditor = {
  orchestratorController: {
    logChangeAndCommit: async () => {}
  }
} as ProjectEditor;

// After
const mockProjectEditor: IProjectEditor = {
  projectId: 'test',
  projectRoot: '/test',
  changedFiles: new Set(),
  changeContents: new Map(),
  logAndCommitChanges: async () => {},
  prepareResourcesForInteraction: async () => []
};
```

## Example Migration

Here's a complete example of migrating the search_project tool:

\`\`\`typescript
import LLMTool from '@beyondbetter/tools';
import type {
  IConversationInteraction,
  IProjectEditor,
  LLMToolInputSchema,
  LLMToolLogEntryFormattedResult,
  LLMToolRunResult
} from '@beyondbetter/tools';

export default class SearchProjectTool extends LLMTool {
  // ... rest of implementation using interfaces
}
\`\`\`

## Migration Checklist

For each tool:

1. [ ] Update imports to use @beyondbetter/tools
2. [ ] Replace concrete types with interfaces
3. [ ] Update method calls to use interface methods
4. [ ] Update formatter imports and types
5. [ ] Update tests to use interfaces
6. [ ] Verify tool functionality
7. [ ] Update documentation

## Common Issues

1. **File Operations**
   - Use projectEditor.logAndCommitChanges instead of orchestratorController
   - Use interface methods for file preparation

2. **Type Compatibility**
   - Ensure all types are imported from @beyondbetter/tools
   - Use interfaces instead of concrete implementations

3. **Testing**
   - Mock interfaces instead of concrete classes
   - Focus on interface contracts rather than implementation details

## Best Practices

1. **Interface Usage**
   - Only use methods defined in interfaces
   - Don't cast to concrete types
   - Keep implementation details in BB project

2. **Type Safety**
   - Use strict type checking
   - Avoid type assertions
   - Let TypeScript help catch interface mismatches

3. **Testing**
   - Test against interfaces
   - Use minimal mock implementations
   - Focus on tool behavior

## See Also

- [bb-tools Documentation](../../../bb-tools/README.md)
- [Tool Development Guide](./llm/new_tool.md)
- [Testing Guidelines](./llm/testing.md)