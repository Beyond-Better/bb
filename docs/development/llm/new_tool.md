# Creating a New Tool for BB

**IMPORTANT: When creating a new tool, it is crucial to follow the structure, style, and conventions of existing tools as closely as possible. This ensures consistency across the project and makes maintenance easier. Always use an existing tool as a template and only modify what is necessary for the new functionality.**

This document serves as a guide for creating new tools in the BB project. It includes a step-by-step process, a template for gathering necessary information, and important considerations for tool development.

## Step-by-Step Guide

0. **Choose a Reference Tool**: Select an existing tool that is most similar to the new tool you want to create. Use this as a template and reference throughout the development process.

1. **Identify the Need**: Determine the specific functionality the new tool will provide.

2. **Gather Information**: Use the template below to collect necessary details about the tool.

3. **Create the Tool Directory**: Create a new directory in the `api/src/llms/tools` directory. Name it according to the existing naming convention (e.g., `newToolName.tool`).

4. **Create the Tool File**: Within the new tool directory, create a `tool.ts` file. Copy the structure and style from the reference tool, modifying only what's necessary for the new functionality. The file path should be `api/src/llms/tools/newToolName.tool/tool.ts`.

5. **Create Formatter Files**: In the same tool directory, create two new files:
   - `formatter.browser.tsx` for browser formatting
   - `formatter.console.ts` for console formatting

6. **Implement the Tool**: Use the gathered information to implement the tool in `tool.ts`, following the structure and style of the reference tool as closely as possible. Only modify what is necessary for the new functionality.

7. **Implement Formatters**: Implement the `formatLogEntryToolUse` and `formatLogEntryToolResult` functions in both formatter files.

8. **Error Handling and Input Validation**: Implement robust error handling and input validation.

9. **Testing**: Create a `tests` directory within your tool's directory. Create comprehensive tests for the new tool in this directory. The test file should be located at `api/src/llms/tools/newToolName.tool/tests/tool.test.ts`. Use the reference tool's test file as a template, modifying only what's necessary for the new functionality. It is critical to read the TESTING.md file before writing tests to ensure consistency and proper test coverage. Tests in this directory will be run automatically by the testing framework.

10. **Documentation**: Add necessary documentation for the tool.

11. **Update Tools Documentation**: Add the tool to `docs/development/reference/tools.md`:
    - Add an entry under the appropriate category section
    - Include description, parameters, use cases, and examples
    - Follow the existing format and style
    - Ensure all parameters are documented
    - Include status if tool is disabled

## Information Gathering Template

When creating a new tool, gather the following information:

1. Tool Name: [Provide a descriptive name for the tool]

2. Tool Description: [Brief description of what the tool does]

3. Input Schema:
   - Parameter 1: [Name, type, description]
   - Parameter 2: [Name, type, description]
   - ...

4. Expected Output: [Describe what the tool should return upon successful execution]

5. Required Actions: [List the main actions the tool needs to perform]

6. Implementation Details: [Describe how the tool will accomplish its actions]

7. Error Scenarios: [List potential error scenarios and how they should be handled]

8. Testing Considerations: [Specific aspects to focus on during testing]

9. Formatting Considerations: [Describe any specific formatting needs for browser and console output]

## Tool Implementation Guidelines

**Remember: The key to successful tool implementation is to follow existing tools as closely as possible. Use an existing tool as a template and only modify what is absolutely necessary for the new functionality.**

When implementing a new tool, it's crucial to maintain consistency with existing tools in the project. This consistency ensures easier maintenance, better readability, and a more cohesive codebase. Pay close attention to the structure, naming conventions, and types used in other tools.

### Structure
Each tool should be a class that extends the `LLMTool` base class. The class should implement the following methods:

- `constructor`: Initialize the tool with a name and description.
- `get inputSchema()`: Define the input schema for the tool.
- `toolUseInputFormatter`: Format the tool input for display.
- `toolRunResultFormatter`: Format the tool result for display.
- `runTool`: Implement the main functionality of the tool.

### Naming Conventions
Follow the naming conventions used in existing tools. Use PascalCase for class names (e.g., `LLMToolNewFeature`) and camelCase for method and variable names.

### Formatter Implementation
Create two separate formatter files for each tool:

1. Browser Formatter (`formatter.browser.tsx`):
   - Import necessary types from `api/llms/llmTool.ts` and `api/llms/llmMessage.ts`.
   - Implement `formatLogEntryToolUse` and `formatLogEntryToolResult` functions that return JSX elements.

2. Console Formatter (`formatter.console.ts`):
   - Import necessary types from `api/llms/llmTool.ts` and `api/llms/llmMessage.ts`.
   - Import `colors` from `cliffy/ansi` and `stripIndents` from `common-tags`.
   - Implement `formatLogEntryToolUse` and `formatLogEntryToolResult` functions that return strings.

### Main Tool File
In the main tool file (`tool.ts`):

- Import the formatter functions from both formatter files.
- Implement `formatLogEntryToolUse` and `formatLogEntryToolResult` methods to use the appropriate formatter based on the format parameter.

Example:

```typescript
import { formatLogEntryToolUse as formatLogEntryToolUseBrowser, formatLogEntryToolResult as formatLogEntryToolResultBrowser } from './formatter.browser.tsx';
import { formatLogEntryToolUse as formatLogEntryToolUseConsole, formatLogEntryToolResult as formatLogEntryToolResultConsole } from './formatter.console.ts';

// ...

formatLogEntryToolUse = (toolInput: LLMToolInputSchema, format: 'console' | 'browser' = 'console'): string | JSX.Element => {
    return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
};

formatLogEntryToolResult = (resultContent: ConversationLogEntryContentToolResult, format: 'console' | 'browser' = 'console'): string | JSX.Element => {
    return format === 'console' ? formatLogEntryToolResultConsole(resultContent) : formatLogEntryToolResultBrowser(resultContent);
};
```

### Input Validation
Use the input schema to validate incoming data. The `validateInput` method in the base `LLMTool` class will automatically use this schema for validation.

### Error Handling
Implement try-catch blocks where necessary. Use the `createError` function to generate consistent error objects. Handle both expected and unexpected errors gracefully.

### Tool Result Handling
The `runTool` method should return an object of type `LLMToolRunResult`, which includes:

- `toolResults`: The main output of the tool (can be a string, LLMMessageContentPart, or LLMMessageContentParts).
- `toolResponse`: A string response for the tool execution.
- `bbResponse`: A user-friendly response describing the tool's action.
- `finalizeCallback` (optional): A function to perform any final actions after the tool use is recorded.

### Testing

When creating tests for your new tool:

- Place test files in the `tests` directory within your tool's directory.
- Follow the naming convention: `tool.test.ts`.
- Ensure comprehensive test coverage, including edge cases and error scenarios.
- Refer to TESTING.md for detailed guidelines on writing and organizing tests.
- Study existing tool tests as examples to maintain consistency in testing approach.
- Include tests for both browser and console formatters.

It is crucial to read and follow the guidelines in TESTING.md before writing any tests. This ensures consistency across the project and helps maintain high-quality test coverage.

### Documentation
Include JSDoc comments for the class and its methods. Update any relevant project documentation to include information about the new tool.

## Example Tool Types

### File Manipulation Tool
Tools that interact with the file system. Examples: SearchAndReplace, ApplyPatch tools.

### Data Retrieval Tool
Tools that fetch data from external sources or the local project. Example: SearchProject tool.

### System Command Tool
Tools that execute system commands. Example: RunCommand tool.

## Considerations for Specific Tool Types

### File Manipulation Tools
- Always use `isPathWithinProject` to ensure file operations are restricted to the project directory.
- Use `ProjectEditor` methods for file operations when possible.
- Handle file creation, modification, and deletion scenarios.

### Data Retrieval Tools
- Implement proper error handling for data access operations.
- Consider performance implications for large datasets or frequent queries.

### System Command Tools
- Use `Deno.run` or equivalent to execute system commands.
- Implement timeout mechanisms for long-running commands.
- Sanitize and validate command inputs to prevent injection attacks.

## Important Notes
- Tools are dynamically loaded by the LLMToolManager at runtime, so there's no need to manually register them. Update the `info.json` file in the tool directory instead of modifying `tools_manifest.ts`, which is built automatically.
- After adding or modifying tools, always restart the API server to ensure the changes are applied.
- Be cautious when implementing tools that interact with the file system or execute commands, as they can have significant impacts on the user's environment.
- Consider the impact of the tool on the overall conversation flow and user experience.
- Ensure that both browser and console formatters are implemented and used correctly for each tool.

## Tool Information File

Each tool should have an `info.json` file in its directory. This file should contain metadata about the tool, such as its name, description, and any other relevant information. The `tools_manifest.ts` file is generated automatically based on these `info.json` files, so there's no need to modify it directly.

## Conclusion

Creating a new tool involves careful planning, implementation, and testing. The most important principle to follow is to use an existing tool as a template and maintain consistency with it as much as possible. This approach ensures that new tools integrate seamlessly into the BB project, follow established patterns, and are easier to maintain, and provide reliable functionality. Remember to consider both the technical implementation and the user experience when designing and implementing new tools, including proper formatting for both browser and console outputs.