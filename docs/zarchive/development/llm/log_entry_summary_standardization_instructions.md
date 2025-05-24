# Tool Formatter Standardization Guide

## Overview
Convert all tools to use:
1. Dedicated type definitions
2. Consistent return types (LLMToolLogEntryFormattedResult)
3. Shared formatting patterns between browser/console
4. CSS classes from TOOL_STYLES_BROWSER instead of inline styles for browser, and TOOL_STYLES_CONSOLE `color` functions for console
5. Standardized title/subtitle formatting
6. Tools are located under `api/src/llms/tools/`. When given a tool name (e.g., "applyPatch"), always look for its files in `api/src/llms/tools/[toolName].tool/`. For example, the "applyPatch" tool would be located at `api/src/llms/tools/applyPatch.tool/tool.ts`. Search the project using the file pattern `**/[toolName].tool/**` to find all the relevant tool files. 

IMPORTANT: Do not change the logic or return values of the runTool method!

## Step 1: Create/Update types.ts
The purpose is to move tool-specific field definitions from inline types in the formatter files into a dedicated types.ts file. Each tool has unique fields that extend the generic tool interfaces.

1. Create file if missing: `[tool-name].tool/types.ts`

2. Define tool input interface (fields previously inline with `toolInput: LLMToolInputSchema`):
```typescript
// Move fields specific to this tool from inline type to dedicated interface
export interface LLMToolToolNameInput {
    // Example fields (will be different for each tool):
    filePath?: string;
    content: string;
    options?: {
        flag1: boolean;
        setting2: string;
    };
}
```

3. Define tool result interface (fields previously inline with `resultContent: ConversationLogEntryContentToolResult`):
```typescript
export interface LLMToolToolNameResult {
    toolResult: LLMToolRunResultContent;
    // Move tool-specific response structure here
    bbResponse: {
        // Example fields (will be different for each tool):
        data: {
            changedResources: string[];
            errorMessages?: string[];
        };
    };
}
```

Key Points:
- Look for inline type casting in the formatter files like `toolInput as { field1: string, field2: boolean }`
- Move those tool-specific fields to ToolNameInput
- Look for inline type casting of `resultContent` or `bbResponse`
- Move those tool-specific result fields to ToolNameResult
- Both formatters can now share these type definitions
- Makes the tool's input/output structure explicit and maintainable
- Preface type names with `LLMTool`, eg LLMToolToolNameResult

Example from applyPatch:

```typescript
// OLD (inline in formatter files):
const { filePath, patch } = toolInput as { filePath?: string; patch: string };

// NEW (in types.ts):
export interface LLMToolApplyPatchInput {
    filePath?: string;
    patch: string;
}

// Then in formatter files:
const { filePath, patch } = toolInput as LLMToolApplyPatchInput;
```

## Step 2: Update formatter.browser.tsx
1. Update imports and return type:

```typescript
/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { LLMToolToolNameInput, LLMToolToolNameResult } from './types.ts';
```

IMPORTANT: The formatting functions MUST return LLMToolLogEntryFormattedResult:
```typescript
export function formatLogEntryToolUse(
    toolInput: LLMToolInputSchema
): LLMToolLogEntryFormattedResult {
    return {
        title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Tool Name'),
        subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Processing...'),
        content: LLMTool.TOOL_TAGS_BROWSER.base.container(<div>content here</div>),
        preview: 'Brief preview text'
    };
}
```

2. Other updates:

```typescript
/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ToolNameInput, ToolNameResult } from './types.ts';
```

2. Update return types:

```typescript
export const formatLogEntryToolUse = (
    toolInput: LLMToolInputSchema
): LLMToolLogEntryFormattedResult => {
```

3. Replace inline styles with CSS classes:

```typescript
<div className="bb-tool-use"> // not style=''
```

4. Update title format:
## Title and Subtitle Formatting

### Browser Formatter (formatter.browser.tsx)
1. Title format:

```typescript
title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Tool Name'),
```

2. Subtitle format:

```typescript
subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(dynamicContent),
```

Key points:
- Tool Use/Result is direct child of bb-log-entry-title
- Tool name is in bb-log-entry-toolname span inside bb-log-entry-title
- Subtitle content is wrapped in bb-log-entry-subtitle span
- Dynamic content goes inside JSX curly braces
- Tool name should be in Word Case in parentheses

### Console Formatter (formatter.console.ts)
1. Title format:

```typescript
title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Tool Name'),
```

2. Subtitle format:

```typescript
subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(dynamicContent),
```

Key points:
- Tool Use/Result is bold (defined in TOOL_STYLES_CONSOLE)
- Tool name is blue and in parentheses (defined in TOOL_STYLES_CONSOLE)
- Subtitle is dimmed (defined in TOOL_STYLES_CONSOLE)
- Tool name matches browser's Word Case
- Dynamic content can use template literals if needed

### CSS Classes (defined in tailwind config in BUI)
- bb-log-entry-title: Container for the title and tool name
- bb-log-entry-toolname: Tool name within the title
- bb-log-entry-subtitle: Subtitle text

### Example Usage
Browser:

```typescript
// Note: TOOL_TAGS_BROWSER functions return JSX elements
return {
  // Header elements using content namespace
  title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search And Replace'),
  subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${count} operations`),
  
  // Content using dedicated tag functions
  content: LLMTool.TOOL_TAGS_BROWSER.base.container(
    LLMTool.TOOL_TAGS_BROWSER.base.pre(content),
    `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`
  ),
  
  // Example of list usage
  content: LLMTool.TOOL_TAGS_BROWSER.base.container(
    LLMTool.TOOL_TAGS_BROWSER.base.list([
      'First item',
      LLMTool.TOOL_TAGS_BROWSER.base.code('const x = 42;'),
      'Third item'
    ])
  ),
  
  preview
};
```

Console:

```typescript
return {
  title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search And Replace'),
  subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${count} operations`),
  content,
  preview
};
```

## Step 3: Update formatter.console.ts
1. Update imports:

```typescript
import type { LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ToolNameInput, ToolNameResult } from './types.ts';
import { colors } from 'cliffy/ansi/colors';
```

2. Update return types:

```typescript
export const formatLogEntryToolUse = (
    toolInput: LLMToolInputSchema
): LLMToolLogEntryFormattedResult => {
```

3. Update title format:

```typescript
title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Tool Name'),
```

## Styling Guidelines

## Important Note About Tool Status

Some tools are already partially standardized. When updating these tools, complete the standardization process while preserving any existing standardized elements:

Partially Standardized Tools:
- applyPatch
- fetchWebPage
- searchAndReplace

All other tools need full standardization from scratch.

### Base Styles and Constants

All styles and tags are defined in `api/src/llms/llmToolTags.tsx` and imported by LLMTool. This keeps the styling logic separate from the tool logic and prevents circular dependencies. The styles and tags are then re-exported as static properties on the LLMTool class for consistent access across all tools.

NOTE: This guide provides common examples. For the complete set of available styles and tags, refer to `llmToolTags.tsx`.

#### Common Tag Functions

1. Base Elements (TOOL_TAGS_BROWSER.base):
   ```typescript
   // Container for content blocks
   container(content: string | JSX.Element, style?: string): JSX.Element
   
   // Labels and text elements
   label(text: string): JSX.Element
   pre(content: string): JSX.Element
   code(content: string): JSX.Element
   list(items: (string | JSX.Element)[]): JSX.Element
   ```

2. Content Elements (TOOL_TAGS_BROWSER.content):
   ```typescript
   // Standard elements
   title(text: string, toolName: string): JSX.Element
   subtitle(text: string): JSX.Element
   
   // File system elements
   filename(text: string): JSX.Element
   directory(text: string): JSX.Element
   
   // Metrics and counts
   number(value: number): JSX.Element
   percentage(value: number, decimals?: number): JSX.Element
   size(bytes: number): JSX.Element
   
   // Status and states
   status(status: 'running' | 'completed' | 'failed' | 'pending'): JSX.Element
   progress(current: number, total: number): JSX.Element
   boolean(value: boolean, format?: 'yes/no' | 'enabled/disabled'): JSX.Element
   ```

#### Usage Examples

```typescript
// Basic content with label
const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
  <>
    {LLMTool.TOOL_TAGS_BROWSER.base.label('File:')}{' '}
    {LLMTool.TOOL_TAGS_BROWSER.content.filename('example.ts')}
  </>
);

// Status information
const status = (
  <>
    {LLMTool.TOOL_TAGS_BROWSER.content.status('running', 'Processing')}
    {' '}
    {LLMTool.TOOL_TAGS_BROWSER.content.progress(3, 10)}
  </>
);

// Metrics display
const metrics = (
  <>
    Size: {LLMTool.TOOL_TAGS_BROWSER.content.size(1234)}
    {' | '}
    Progress: {LLMTool.TOOL_TAGS_BROWSER.content.percentage(75)}
  </>
);
```

For additional tag functions and styles, refer to `llmToolTags.tsx`. The file contains the complete set of available tags, including:
- Time-related (timestamp, duration, timeRange)
- Web elements (url, link, image)
- UI elements (badge, icon, diff, truncated)
- And more

#### Corresponding Console Styles

Each browser tag has a corresponding console style in TOOL_STYLES_CONSOLE. Here are some common examples:

```typescript
static readonly TOOL_STYLES_CONSOLE = {
  base: {
    label: (text: string) => colors.bold(text),
    // ... other base styles
  },
  content: {
    filename: (text: string) => colors.cyan(text),
    status: {
      running: (text: string) => colors.blue(text),
      completed: (text: string) => colors.green(text),
      // ... other status styles
    },
    number: (text: string) => colors.blue(text),
    // ... other content styles
  }
};
```

Refer to `llmToolTags.tsx` for the complete set of console styles.

All styles and tags are defined in llmToolTags.tsx and imported by LLMTool. This keeps the styling logic separate from the tool logic and prevents circular dependencies. The styles and tags are then re-exported as static properties on the LLMTool class for consistent access across all tools.

#### Available Tag Functions

1. Base Elements (TOOL_TAGS_BROWSER.base):
   ```typescript
   // Container for content blocks
   container(content: string | JSX.Element, style?: string): JSX.Element
   
   // Preformatted text blocks
   pre(content: string, style?: string): JSX.Element
   
   // Code snippets
   code(content: string, style?: string): JSX.Element
   
   // Unordered lists
   list(items: (string | JSX.Element)[], style?: string): JSX.Element
   
   // Strong text labels
   label(text: string): JSX.Element
   ```

2. Content Elements (TOOL_TAGS_BROWSER.content):
   ```typescript
   // Standard elements
   title(text: string, toolName: string): JSX.Element
   subtitle(text: string): JSX.Element
   
   // File system elements
   filename(text: string): JSX.Element     // File names with monospace and cyan color
   directory(text: string): JSX.Element    // Directory paths with monospace and darker cyan
   
   // Web elements
   url(text: string): JSX.Element          // URLs with monospace and blue color
   image(src: string, alt: string): JSX.Element  // Images with responsive sizing
   
   // Metrics and counts
   counts(text: string): JSX.Element       // Numeric counts in purple
   tokenUsage(text: string): JSX.Element   // Token counts in purple
   size(bytes: number): JSX.Element        // File sizes with automatic unit conversion
   
   // Special formats
   toolName(text: string): JSX.Element     // Tool references in blue
   date(text: string): JSX.Element         // Dates in monospace gray
   boolean(value: boolean, format?: 'yes/no' | 'enabled/disabled' | 'included/excluded'): JSX.Element
   regex(text: string): JSX.Element        // Regex patterns with special background
   ```

#### Usage Examples

```typescript
// Basic content with label
const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
  <>
    {LLMTool.TOOL_TAGS_BROWSER.base.label('File:')}{' '}
    {LLMTool.TOOL_TAGS_BROWSER.content.filename('example.ts')}
  </>
);

// File system information
const fileInfo = (
  <>
    {LLMTool.TOOL_TAGS_BROWSER.content.directory('src/utils/')}
    {LLMTool.TOOL_TAGS_BROWSER.content.filename('helper.ts')}
    {' '}
    {LLMTool.TOOL_TAGS_BROWSER.content.size(1234)}
  </>
);

// Tool references
const toolRef = (
  <>
    Using {LLMTool.TOOL_TAGS_BROWSER.content.toolName('search_and_replace')}
    {' with '}
    {LLMTool.TOOL_TAGS_BROWSER.content.counts('3')} operations
  </>
);

// Status information
const status = (
  <>
    Cache: {LLMTool.TOOL_TAGS_BROWSER.content.boolean(true, 'enabled/disabled')}
    {' | '}
    Tokens: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage('1.2K')}
  </>
);
```

#### Corresponding Console Styles

Each browser tag has a corresponding console style in TOOL_STYLES_CONSOLE:

```typescript
static readonly TOOL_STYLES_CONSOLE = {
  base: {
    label: (text: string) => colors.bold(text),
    // ... other base styles
  },
  content: {
    filename: (text: string) => colors.cyan(text),
    url: (text: string) => colors.blue(text),
    counts: (text: string) => colors.magenta(text),
    tokenUsage: (text: string) => colors.magenta(text),
    toolName: (text: string) => colors.blue(text),
    date: (text: string) => colors.gray(text),
    directory: (text: string) => colors.cyan(text),
    boolean: (text: string) => colors.magenta(text),
    regex: (text: string) => colors.yellow(text),
    size: (text: string) => colors.gray(text),
    // ... other content styles
  }
};
```

All styles and tags are defined in llmToolTags.tsx and imported by LLMTool. This keeps the styling logic separate from the tool logic and prevents circular dependencies. The styles and tags are then re-exported as static properties on the LLMTool class for consistent access across all tools., with separate constants for browser and console formatting. This approach provides several benefits:
- Better encapsulation of tool-related styling
- Easy access in derived tool classes via `LLMTool.TOOL_STYLES`
- Type safety through TypeScript integration
- Consistent styling patterns across all tools

1. Browser Tags (TOOL_TAGS_BROWSER - defined in llmToolTags.tsx):
```typescript
// JSX components are defined in api/src/llms/llmToolTags.tsx
/** @jsxImportSource preact */
import type { JSX } from 'preact';
import { colors } from 'cliffy/ansi/colors';

// All styles and tags are defined in this file to avoid circular dependencies

export const TOOL_TAGS_BROWSER = {
  // Header elements
  content: {
    title: (text: string, toolName: string): JSX.Element => (
      <div className="bb-log-entry-title">
        {text} <span className="bb-log-entry-toolname">({toolName})</span>
      </div>
    ),
    subtitle: (text: string): JSX.Element => (
      <span className="bb-log-entry-subtitle">{text}</span>
    ),
  },
  // Content elements
  container: (content: string | JSX.Element, style?: string): JSX.Element => (
    <div className={style ?? LLMTool.TOOL_STYLES_BROWSER.base.container}>{content}</div>
  ),
  pre: (content: string, style?: string): JSX.Element => (
    <pre className={style ?? LLMTool.TOOL_STYLES_BROWSER.base.pre}>{content}</pre>
  ),
  code: (content: string, style?: string): JSX.Element => (
    <code className={style ?? LLMTool.TOOL_STYLES_BROWSER.base.code}>{content}</code>
  ),
  list: (items: (string | JSX.Element)[], style?: string): JSX.Element => (
    <ul className={style ?? LLMTool.TOOL_STYLES_BROWSER.base.list}>
      {items.map((item, index) => (
        <li key={index} className={LLMTool.TOOL_STYLES_BROWSER.base.listItem}>{item}</li>
      ))}
    </ul>
  ),
};

// Then imported and used in llmTool.ts
import { TOOL_TAGS_BROWSER, TOOL_STYLES_BROWSER, TOOL_STYLES_CONSOLE } from './llmToolTags.tsx';

// Re-exported as static properties
static readonly TOOL_TAGS_BROWSER = TOOL_TAGS_BROWSER;
static readonly TOOL_STYLES_BROWSER = TOOL_STYLES_BROWSER;
static readonly TOOL_STYLES_CONSOLE = TOOL_STYLES_CONSOLE;

// Example usage in a tool formatter:
import LLMTool from 'api/llms/llmTool.ts';
// Note: All styles and tags are imported through LLMTool
// No need to import directly from llmToolTags.tsx

// Headers use content namespace
const title = LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Example Tool');
const subtitle = LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Processing...');

// Content elements use dedicated functions
const codeBlock = LLMTool.TOOL_TAGS_BROWSER.base.container(
  LLMTool.TOOL_TAGS_BROWSER.base.pre('const x = 42;'),
  `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`
);

const itemList = LLMTool.TOOL_TAGS_BROWSER.base.list([
  'First item',
  LLMTool.TOOL_TAGS_BROWSER.base.code('someFunction()'),
  'Third item'
]);
```

2. Browser Styles (TOOL_STYLES_BROWSER):
```typescript
// Available as static property on LLMTool
static readonly TOOL_STYLES_BROWSER = {
  base: {
    container: "p-4 rounded-lg border",
    pre: "p-2.5 rounded font-mono text-sm",
    code: "font-mono text-sm",
    list: "space-y-2",
    listItem: "ml-4"
  },
  status: {
    error: "bg-red-50 border-red-200 text-red-700",
    success: "bg-green-50 border-green-200 text-green-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    info: "bg-blue-50 border-blue-200 text-blue-700"
  },
  content: {
    code: "bg-gray-50 border-gray-200",
    data: "bg-blue-50 border-blue-200"
  }
};
```

3. Console Styles (TOOL_STYLES_CONSOLE):
```typescript
static readonly TOOL_STYLES_CONSOLE = {
  base: {
    label: (text: string) => colors.bold(text),
    value: (text: string) => text,
    code: (text: string) => text,
    list: (text: string) => text,
    listItem: (text: string) => `  ${text}` // 2-space indent
  },
  status: {
    error: (text: string) => colors.red(text),
    success: (text: string) => colors.green(text),
    warning: (text: string) => colors.yellow(text),
    info: (text: string) => colors.blue(text)
  },
  content: {
    title: (text: string, toolName: string) => 
      `${colors.bold(text)} ${colors.blue(`(${toolName})`)}`,
    subtitle: (text: string) => colors.dim(text),
    filename: (text: string) => colors.cyan(text),
    code: (text: string) => text,
    data: (text: string) => colors.blue(text)
  }
};
```

3. Define tool-specific styles in each formatter:
```typescript
// In your tool's formatter.browser.tsx
import LLMTool from 'api/llms/llmTool.ts';
import type { JSX } from 'preact';

const TOOL_SPECIFIC_STYLES = {
  // Extend or override base browser styles
  container: `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.patch}`,
  // Add tool-specific styles
  customElement: "mt-2 px-4 py-2 bg-gray-100 rounded"
};

// In your tool's formatter.console.ts
const content = stripIndents`
  ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File:')} 
  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)}
  
  ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content:')}
  ${LLMTool.TOOL_STYLES_CONSOLE.content.code(content)}
`;
```

### Styling Approach
1. Generic Tool Classes:
   - Use predefined classes for common tool elements
   - These are configured in the BUI Tailwind config
   - Examples: 'bb-log-entry-title', 'bb-log-entry-toolname', 'bb-log-entry-subtitle'
   - DO NOT modify these classes in individual tools

2. Tool-Specific Styling:
   - Use Tailwind utility classes for tool-specific styling
   - Combine utilities through TOOL_STYLES constants
   - Avoid inline styles completely
   - Keep styling consistent with the base TOOL_STYLES

### Common Classes
1. Generic Tool Classes (defined in BUI):
   - bb-log-entry-title: Primary title container
   - bb-log-entry-toolname: Tool name within title
   - bb-log-entry-subtitle: Secondary title text
   - bb-tool-use: Container for tool usage display
   - bb-tool-result: Container for tool results

2. Tailwind Utility Examples:
   - Background: bg-yellow-50, bg-blue-50
   - Borders: border border-gray-200
   - Spacing: p-4, mt-2, space-y-2
   - Typography: font-mono, text-sm

## Implementation Checklist for Each Tool
1. [ ] Create/update types.ts with proper interfaces
2. [ ] Update browser formatter:
   - [ ] Correct imports (including TOOL_STYLES from llmTool.ts)
   - [ ] LLMToolLogEntryFormattedResult return type
   - [ ] Define tool-specific TOOL_STYLES constant extending base styles
   - [ ] Replace inline styles with Tailwind utility classes
   - [ ] Use generic tool classes for standard elements (log-entry-title, etc.)
   - [ ] Standardized title format
3. [ ] Update console formatter:
   - [ ] Correct imports
   - [ ] LLMToolLogEntryFormattedResult return type
   - [ ] Consistent structure with browser
   - [ ] Standardized title format
4. [ ] Verify consistent behavior between formatters
5. [ ] Test with actual tool usage

