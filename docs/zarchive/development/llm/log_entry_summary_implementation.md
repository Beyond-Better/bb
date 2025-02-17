# Log Entry Formatting Implementation

## Overview

The log entry formatting system provides a unified approach to format log entries for both console and browser display. Each formatter produces a complete result containing title, content, and preview information.

## Core Types

### LogEntryFormattedResult
```typescript
interface LogEntryFormattedResult {
  // Left side next to icon
  title: string | JSX.Element;
  subtitle?: string | JSX.Element;

  // Main body content
  content: string | JSX.Element;

  // Right side preview
  preview: string | JSX.Element;
}
```

### LogEntrySourceData
```typescript
interface LogEntrySourceData {
  title: string;
  subtitle?: string;
  content: string | LLMToolInputSchema | ConversationLogEntryContent;
  preview?: string;
}
```

## Implementation Details

### 1. LogEntryFormatterManager
- Single entry point for all log entry formatting
- Handles both console and browser output formats
- Provides consistent formatting across different entry types
- Uses string templates for HTML generation (no JSX)

### 2. Tool Formatters
Each tool implements two main formatting methods:
```typescript
formatLogEntryToolUse(
  toolInput: LLMToolInputSchema,
  format: LLMToolFormatterDestination
): LogEntryFormattedResult;

formatLogEntryToolResult(
  resultContent: ConversationLogEntryContent,
  format: LLMToolFormatterDestination
): LogEntryFormattedResult;
```

### 3. Format-Specific Output
- Console: Plain text with structured layout
- Browser: HTML strings with appropriate classes
- All HTML content is properly escaped

## Example Implementation: search_and_replace Tool

### Tool Use Format
```typescript
{
  title: 'search_and_replace',
  subtitle: '2 operations',
  content: '<div class="bb-tool-use">...</div>',
  preview: 'Modifying src/config.ts'
}
```

### Tool Result Format
```typescript
{
  title: 'search_and_replace',
  subtitle: '2 changes',
  content: '<div class="bb-tool-result">...</div>',
  preview: 'BB applied search and replace operations'
}
```

## HTML Structure

### Title Section
```html
<div class="bb-log-entry-left">
  <span class="bb-log-entry-title">Tool Name</span>
  <span class="bb-log-entry-subtitle">Context Info</span>
</div>
```

### Preview Section
```html
<div class="bb-log-entry-right">
  <div class="bb-log-entry-preview">Brief summary...</div>
</div>
```

## Implementation Guidelines

### 1. Content Formatting
- Use semantic HTML elements
- Apply consistent CSS classes
- Escape all user-provided content
- Keep previews concise (≤50 characters)

### 2. Error Handling
- Provide fallback content for failures
- Maintain consistent structure even in error cases
- Log formatting errors appropriately

### 3. Accessibility
- Use semantic HTML elements
- Provide meaningful text content
- Maintain logical reading order

## CSS Classes

### Core Classes
- `bb-log-entry-left`: Title and subtitle container
- `bb-log-entry-title`: Main title text
- `bb-log-entry-subtitle`: Additional context
- `bb-log-entry-right`: Preview container
- `bb-log-entry-preview`: Brief content summary

### Tool-Specific Classes
- `bb-tool-use`: Tool input formatting
- `bb-tool-result`: Tool output formatting

## Testing

### Format Testing
1. Test both console and browser output
2. Verify HTML escaping
3. Check preview truncation
4. Validate error cases

### Content Types
1. Test string content
2. Test complex objects
3. Test with missing optional fields
4. Test with error conditions

## Next Steps

1. Update Remaining Tools
   - Apply new format to all tools
   - Ensure consistent styling
   - Add tool-specific formatting

2. UI Improvements
   - Review and refine CSS
   - Add loading states
   - Improve error displays

3. Documentation
   - Add examples for each tool type
   - Document CSS classes
   - Provide formatting guidelines