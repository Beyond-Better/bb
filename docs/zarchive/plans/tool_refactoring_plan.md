# Tool Refactoring Plan

## IMPORTANT NOTE
This refactor is for the individual tools ONLY. It does not include changes to the Tool Manager or Base classes. The focus is on restructuring the file organization for each tool, not on changing the tool's logic or functionality.

## Objective

Refactor the structure used for tools under `api/src/llms/tools/` to make each tool self-contained in its own directory. This refactoring will allow for easier management of built-in tools and future support for user-supplied tools.

## Key Points

- This refactor is for the individual tools, NOT Tool Manager or Base classes.
- Please begin by creating the new directory structure for the tools. The tool files already exist, they just need to be moved and imports updated. 
- The tools themselves are not being refactored; KEEP THE EXISTING LOGIC AND FUNCTIONALITY. The refactor is a file restructure only.
- You are effectively moving and renaming files rather than changing the content or functionality of the files (except for updating imports). 
  - Use the `rename_files` tool for the refactoring. Only use the `move_files` tool if you need to move multiple files without renaming them. Be sure to set the `createMissingDirectories` option. 
  - Use the `search_and_replace` tool for updating imports. 
- There is a final step of dynamic loading for tests; we may need to discuss that part of the plan in more detail.
- You DO NOT need to run any of the tests, I will do that afterwards. 
- The refactoring process will go through each tool one by one.
- The assistant should make the changes directly using the provided tools.
- Documentation updates will be handled after all tools are refactored.


## General Structure

IMPORTANT: Always use the `rename_files` tool for restructuring and renaming files. The `move_files` tool should only be used when moving multiple files without renaming them.

When using the `rename_files` tool, provide the full path for both the source and destination files. Here's an example of how to use the `rename_files` tool:

```json
{
  "operations": [
    {
      "source": "api/src/llms/tools/oldToolName.ts",
      "destination": "api/src/llms/tools/newToolName.tool/tool.ts"
    }
  ],
  "createMissingDirectories": true
}
```

This will ensure that the file is moved to the correct location and renamed appropriately.

For each tool:
1. Create a new directory: `api/src/llms/tools/[toolName].tool/`
2. Move main tool file: `[toolName]Tool.ts` -> `[toolName].tool/tool.ts`
3. Move formatters: `formatters/[toolName]Tool.*.ts` -> `[toolName].tool/formatter.*.ts`
4. Create tests directory: `[toolName].tool/tests/`
5. Move test file: `tests/t/llms/tools/[toolName]Tool.test.ts` -> `[toolName].tool/tests/tool.test.ts`
6. Create `info.json` with metadata

## Detailed Example for "moveFiles" tool (use the `rename_files` tool)

IMPORTANT: Always use the `rename_files` tool for restructuring and renaming. Use `search_and_replace` for updating imports. Only use the `move_files` tool when moving multiple files without renaming them. Do NOT use the `rewrite_file` tool for these operations.

When updating imports, prefer using import_map.json. For example, for test files:
```typescript
import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getTestFilePath, withTestProject } from 'api/tests/testSetup.ts';
```

For tool files, use these imports from import_map.json:
```typescript
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
```

1. Rename main tool file (set `createMissingDirectories` to create the `api/src/llms/tools/moveFiles.tool/` directory):

```json
{
  "operations": [
    {
      "source": "api/src/llms/tools/moveFilesTool.ts",
      "destination": "api/src/llms/tools/moveFiles.tool/tool.ts"
    }
  ],
  "createMissingDirectories": true
}
```
2. Rename formatters (including .tsx files):

```json
{
  "operations": [
    {
      "source": "api/src/llms/tools/formatters/moveFilesTool.browser.tsx",
      "destination": "api/src/llms/tools/moveFiles.tool/formatter.browser.tsx"
    },
    {
      "source": "api/src/llms/tools/formatters/moveFilesTool.console.ts",
      "destination": "api/src/llms/tools/moveFiles.tool/formatter.console.ts"
    }
  ],
  "createMissingDirectories": true
}
```
3. Rename test file (set `createMissingDirectories` to create the `api/src/llms/tools/moveFiles.tool/tests/` directory):

```json
{
  "operations": [
    {
      "source": "api/tests/t/llms/tools/moveFilesTool.test.ts",
      "destination": "api/src/llms/tools/moveFiles.tool/tests/tool.test.ts"
    }
  ],
  "createMissingDirectories": true
}
```
4. Create metadata file: `api/src/llms/tools/moveFiles.tool/info.json`
5. Update imports in `tool.ts` and test files using the `search_and_replace` tool
6. Ensure to keep the original contents of test files, only updating the imports

## Progress

Completed tools:
1. rewriteFile
2. requestFiles
3. forgetFilesTool
4. applyPatchTool
5. fetchWebPageTool
6. fetchWebScreenshotTool
7. rewriteFileTool
8. searchAndReplaceMultilineCode
9. searchAndReplaceTool
10. moveFilesTool
11. runCommandTool
12. delegateTasksTool

## Remaining Tools to Refactor

## Additional Tasks
- Create a README.md file in the `api/src/llms/tools` directory to explain its purpose
- Update imports in all affected files
- Ensure all tests are updated and working correctly

## Process

1. The assistant will pick the next tool in the list of remaining tools to refactor.
2. The assistant will implement the refactoring steps for that tool using the provided tools (rename_files, search_and_replace, etc.).
3. The assistant will update the list of completed and remaining tools in this document.
4. This process will be repeated for each tool until all tools are refactored.

## Notes

- Each tool will be refactored in a separate conversation.
- The assistant should follow the plan for each tool without additional guidance.
- The order of refactoring tools doesn't matter; choose from the "Remaining Tools to Refactor" section.
- After completing a tool's refactor, update this document to move the tool to the "Completed tools" section.
- No additional files or resources are needed beyond this planning document.


- The refactoring process is working well. We've successfully moved and renamed files, updated imports, and maintained the functionality of the tools.
- Remember to use the `move_files` and `rename_files` tools for restructuring, and `search_and_replace` for updating imports.
- Always verify the existence of files after moving and renaming.
- Update imports to use import map aliases where applicable.

## Original Notes
- The LLMToolManager and base LLMTool class are NOT part of this refactor. They will be updated in a separate task.
- Dynamic loading for tests needs to be implemented; you should discuss options with the user
- Import statements in other parts of the project (outside of tools) will be updated in a separate task

This refactoring plan focuses solely on restructuring the individual tools' file organization. It does not involve changes to the overall tool management system or the base classes.

This refactoring plan aims to improve the organization and maintainability of the BB tool system, setting the groundwork for future enhancements and user-supplied tools.