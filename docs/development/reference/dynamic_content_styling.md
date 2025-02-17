# Dynamic Content Styling Guide

This document outlines the current practices and patterns for styling dynamically generated content in BB.

## Overview

BB generates HTML content in several contexts:
- Log entry formatting
- Tool output rendering
- Dynamic UI components

## Styling Patterns

### 1. Predefined Components

Use `TOOL_TAGS_BROWSER` components for consistent styling:

```typescript
// Example: Formatting tool output
LLMTool.TOOL_TAGS_BROWSER.base.container(
  <>
    {LLMTool.TOOL_TAGS_BROWSER.base.label('Command:')}
    {LLMTool.TOOL_TAGS_BROWSER.base.code(command)}
  </>
);
```

Available components:
- `base.container` - Standard content wrapper
- `base.label` - Content labels
- `base.code` - Code blocks
- `content.title` - Section titles
- `content.preview` - Content previews

### 2. Semantic Classes

Use predefined semantic classes for common patterns:

```css
/* Available semantic classes */
.bb-tool-use     /* Tool usage blocks */
.bb-tool-result  /* Tool result blocks */
.bb-metrics      /* Metrics display */
.bb-code-block   /* Code formatting */
```

### 3. Utility Classes

When using Tailwind utility classes:
1. Use only classes included in the Tailwind config
2. Add new patterns to the safelist if needed
3. Document usage in formatter files

## File Organization

### 1. Formatter Files
- Place formatters in dedicated files
- Keep in sync with Tailwind config
- Document required utility classes
- Use semantic class names where possible

### 2. Configuration
```js
// tailwind.config.ts
{
  content: [
    // Core formatters
    '../../api/src/logEntries/formatters.browser.tsx',
    '../../api/src/llms/llmToolTags.tsx',
    // Tool formatters
    '../../api/src/llms/tools/*.tool/formatter.browser.tsx'
  ]
}
```

## Best Practices

1. Component Usage:
   - Prefer predefined components
   - Use semantic classes for common patterns
   - Document new utility patterns
   - Keep styles consistent

2. Maintenance:
   - Update Tailwind config for new formatters
   - Review and consolidate utility patterns
   - Monitor CSS bundle size
   - Test in both light and dark modes

3. Performance:
   - Use efficient selectors
   - Minimize dynamic class generation
   - Consider code splitting
   - Monitor runtime performance

## Testing

1. Visual Testing:
   - Test in all color schemes
   - Verify responsive behavior
   - Check component transitions
   - Validate accessibility

2. Integration Testing:
   - Verify style application
   - Test dynamic updates
   - Check theme switching
   - Validate class generation