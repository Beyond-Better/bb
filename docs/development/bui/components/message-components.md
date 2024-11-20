# Message Components

This document describes the core message display components used in the BUI.

## MessageEntry Component

The `MessageEntry` component handles the rendering of individual conversation messages, including user input, assistant responses, and tool interactions.

### Features

- Markdown rendering with syntax highlighting
- Code block formatting with language detection
- Tool message formatting
- Copy-to-clipboard functionality
- Message type-specific styling

### Usage

```typescript
import { MessageEntry } from "../components/MessageEntry.tsx";

<MessageEntry 
    entry={conversationEntry}
    index={messageIndex}
    onCopy={(text) => /* handle copy */}
/>
```

### Props

```typescript
interface MessageEntryProps {
    entry: ConversationEntry;
    index: number;
    onCopy: (text: string) => void;
}
```

### Styling

Messages are styled based on their type using Tailwind CSS classes:
- User messages: Blue theme
- Assistant messages: Green theme
- Tool messages: Yellow theme

## MessageEntryTool Component

The `MessageEntryTool` component provides specialized rendering for tool input and output messages.

### Features

- Distinct styling for input vs output
- JSON formatting with syntax highlighting
- Copy button for tool content
- Collapsible content for large payloads

### Usage

```typescript
import { MessageEntryTool } from "../components/MessageEntryTool.tsx";

<MessageEntryTool
    type="input"
    toolName="search_project"
    content={toolInput}
/>
```

### Props

```typescript
interface MessageEntryToolProps {
    type: 'input' | 'output';
    toolName: string;
    content: any;
}
```

### Styling

Tool messages use a distinct visual style:
- Gray background with border
- Tool name in header
- Formatted JSON content
- Copy button in top-right

## Implementation Details

### Markdown Rendering

Uses the `marked` library with custom renderer configuration:

```typescript
const renderer = new marked.Renderer();
renderer.code = (code, language) => {
    const highlighted = language
        ? highlight(code, { language }).value
        : highlight(code).value;
    return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
};
```

### Message Type Styling

Consistent styling based on message type:

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

## Testing

Components include comprehensive test coverage:

```typescript
// tests/components/MessageEntry.test.ts
Deno.test("MessageEntry renders markdown with syntax highlighting", async () => {
    // Test implementation
});

// tests/components/MessageEntryTool.test.ts
Deno.test("MessageEntryTool renders input and output correctly", async () => {
    // Test implementation
});
```