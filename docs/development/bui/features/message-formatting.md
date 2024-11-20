# Message Formatting

This document describes the message formatting system in the BUI, including Markdown support, code highlighting, and specialized message types.

## Overview

The BUI implements a comprehensive message formatting system that handles:
- Markdown text formatting
- Code syntax highlighting
- Tool message formatting
- Message type styling
- Copy functionality

## Components

The message formatting system is built on two main components:
- `MessageEntry`: Handles general message rendering
- `MessageEntryTool`: Specialized component for tool interactions

See [Message Components](../components/message-components.md) for detailed component documentation.

## Markdown Support

### Configuration

The system uses `marked` with custom configuration for enhanced rendering:

```typescript
marked.setOptions({
    renderer: customRenderer,
    highlight: (code, lang) => highlight(code, { language: lang }).value,
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false,
    smartypants: false,
    xhtml: false
});
```

### Supported Features

1. Basic Formatting
   - Bold (`**text**`)
   - Italic (`*text*`)
   - Links (`[text](url)`)
   - Lists (ordered and unordered)

2. Code Formatting
   - Inline code (\`code\`)
   - Code blocks with language support
   ```typescript
   ```typescript
   function example() {
       // Code here
   }
   ```
   ```

3. Tables and Lists
   - Markdown tables
   - Nested lists
   - Task lists

## Code Highlighting

### Language Support

Automatic language detection and syntax highlighting for:
- TypeScript/JavaScript
- Python
- JSON
- HTML/CSS
- Markdown
- Shell scripts
- And many more

### Styling

Code blocks are styled using highlight.js themes:
- Light and dark mode support
- Language-specific syntax coloring
- Proper handling of special characters
- Line numbers (optional)

## Tool Message Formatting

### Structure

Tool messages follow a consistent structure:
```typescript
interface MessageEntryTool {
    type: 'input' | 'output';
    toolName: string;
    content: any;
}
```

### Visual Design

Tool messages have distinct styling:
1. Header
   - Tool name
   - Message type indicator
   - Copy button

2. Content
   - Formatted JSON
   - Syntax highlighting
   - Collapsible for large payloads

## Message Type Styling

### Style System

Messages are styled based on their type using a consistent color scheme:

```typescript
const messageTypeStyles = {
    user: {
        container: 'bg-blue-50 border-blue-200',
        header: 'text-blue-700',
        content: 'prose-blue'
    },
    assistant: {
        container: 'bg-green-50 border-green-200',
        header: 'text-green-700',
        content: 'prose-green'
    },
    tool_use: {
        container: 'bg-yellow-50 border-yellow-200',
        header: 'text-yellow-700',
        content: 'prose-yellow'
    }
};
```

### Accessibility

- Color combinations meet WCAG contrast requirements
- Semantic HTML structure
- Screen reader friendly
- Keyboard navigation support

## Copy Functionality

### Implementation

Copy-to-clipboard functionality is implemented using the Clipboard API:

```typescript
const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        // Show success feedback
    } catch (error) {
        // Handle error
    }
};
```

### User Experience

- Visual feedback on copy
- Error handling with user notification
- Keyboard shortcuts support
- Clear copy button placement

## Testing

### Unit Tests

```typescript
// Message rendering tests
Deno.test("renders markdown correctly", async () => {
    // Test markdown rendering
});

// Code highlighting tests
Deno.test("highlights code with correct language", async () => {
    // Test syntax highlighting
});

// Tool message tests
Deno.test("formats tool messages properly", async () => {
    // Test tool message formatting
});
```

### Integration Tests

```typescript
// Full message flow tests
Deno.test("handles complete message flow", async () => {
    // Test end-to-end message handling
});
```

## Performance Considerations

1. Lazy Loading
   - Code highlighting loaded on demand
   - Large message content pagination
   - Deferred rendering for long conversations

2. Optimization
   - Memoized message rendering
   - Efficient DOM updates
   - Resource cleanup

## Future Improvements

1. Enhanced Features
   - Custom syntax highlighting themes
   - Additional markdown extensions
   - Message search/filter

2. Performance
   - Virtual scrolling for long conversations
   - Worker-based syntax highlighting
   - Improved caching

3. Accessibility
   - Enhanced screen reader support
   - Keyboard navigation improvements
   - High contrast themes