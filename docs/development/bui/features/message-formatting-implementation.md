# Message Formatting Implementation

## Overview

This document details the implementation of message formatting features in the BUI refactor, comparing the original and new implementations.

## Components Structure

### Core Components

1. MessageEntry
- Handles all message types (user, assistant, tool)
- Implements Markdown rendering
- Manages code syntax highlighting
- Provides copy functionality with feedback

2. MessageEntryTool
- Specialized component for tool interactions
- Formats JSON content with syntax highlighting
- Shows parameters and results in collapsible sections
- Includes copy functionality with feedback

3. Supporting Components
- ErrorMessage: Consistent error display
- Toast: User action feedback
- LoadingSpinner: Loading state indicators

## Features Implementation

### 1. Markdown Rendering
```typescript
marked.setOptions({
    renderer,
    highlight: (code, lang) => highlight(code, { language: lang || 'plaintext' }).value,
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false,
    smartypants: false,
    xhtml: false
});
```

### 2. Code Syntax Highlighting
- Uses highlight.js for syntax highlighting
- Supports multiple languages
- Custom theme configuration in fresh.config.ts

### 3. Message Type Styling
```typescript
const messageTypeStyles = {
    user: {
        container: 'bg-blue-50 border-blue-200',
        header: 'text-blue-700',
    },
    assistant: {
        container: 'bg-green-50 border-green-200',
        header: 'text-green-700',
    },
    // ... other types
};
```

### 4. Tool Message Formatting
- Distinct styling for input/output
- JSON formatting with syntax highlighting
- Collapsible sections for parameters and results
- Copy functionality with feedback

### 5. User Feedback
- Toast notifications for actions
- Error messages with close button
- Loading states with custom spinner

## Configuration Updates

### 1. Tailwind Configuration
- Added typography plugin
- Custom code block styling
- Animation support for notifications

### 2. Fresh Configuration
- Highlight.js theme integration
- Custom styling for code blocks

## Testing Strategy

### Unit Tests
- MessageEntry component tests
- MessageEntryTool component tests
- Toast and ErrorMessage tests

### Integration Tests
- Complex message rendering
- Tool message interaction
- Copy functionality
- Error handling

## Improvements Over Original

### 1. Component Organization
- Separated concerns into dedicated components
- Better type safety with TypeScript interfaces
- More maintainable code structure

### 2. Enhanced Features
- Better Markdown rendering configuration
- Improved code syntax highlighting
- More consistent styling
- Better user feedback

### 3. User Experience
- Copy feedback with toast notifications
- Better error handling
- Improved loading states
- More responsive interactions

## Usage Examples

### Basic Message
```typescript
<MessageEntry 
    entry={{
        logEntry: {
            entryType: "assistant",
            content: "# Hello\nThis is a message",
            timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        tokenUsageConversation: {
            totalTokensTotal: 100
        }
    }}
    index={0}
    onCopy={(text) => console.log('Copied:', text)}
/>
```

### Tool Message
```typescript
<MessageEntryTool
    type="input"
    toolName="search_project"
    content={{
        parameters: {
            filePattern: "*.ts",
            contentPattern: "function"
        }
    }}
    onCopy={(text) => console.log('Copied:', text)}
/>
```

## Future Improvements

### 1. Performance
- Implement virtual scrolling for long conversations
- Lazy loading of syntax highlighting
- Memoization of rendered content

### 2. Features
- Dark mode support
- Custom syntax highlighting themes
- More interactive tool message displays
- Advanced copy options (partial selection)

### 3. Accessibility
- Enhanced keyboard navigation
- Better screen reader support
- ARIA live regions for updates
- High contrast themes