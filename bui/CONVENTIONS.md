# BB Browser User Interface (BUI) Component Conventions

## Overview
This document outlines specific conventions for the BB Browser User Interface component. These conventions MUST be followed in addition to the general project conventions.

## Architecture
- Built with Deno Fresh
- WebSocket-based real-time communication
- Island-based component architecture
- API integration patterns

## Directory Structure
```
bui/
├── src/
│   ├── components/    # Static components
│   ├── islands/      # Interactive components
│   ├── routes/       # Page routes
│   ├── utils/        # Helper functions
│   └── types/        # BUI-specific types
├── static/           # Static assets
└── tests/           # Test files
```

## Component Conventions

### Islands (Interactive Components)
- One component per file
- Clear state management
- WebSocket handling patterns
- Error boundary implementation

Example Pattern:
```typescript
// islands/Feature.tsx
export default function Feature() {
  // State management at the top
  const state = signal(initialValue);
  // Prefer signal over useState for Fresh applications
  // Bad: const [state, setState] = useState();
  // Good: const state = signal(initialValue);
  
  // WebSocket setup next
  useEffect(() => {
    setupWebSocket();
  }, []);

  // Helper functions
  const handleEvent = () => {
    // Implementation
  };

  // Render last
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Static Components
- Prefer static components where possible
- Clear prop interfaces
- Consistent styling patterns
- Accessibility attributes
 
## External Link Handling

### Using the ExternalLink Component
For all external links in the BUI, use the `ExternalLink` component instead of raw `<a>` tags to ensure consistent behavior across different environments (BUI/DUI).

```typescript
// BAD - Using raw anchor tags
<a href={url} target="_blank" rel="noopener noreferrer">Link</a>

// WORSE - Inconsistent environment handling
<a href={getExternalHref(url)} {...(!isDuiEnvironment() ? { target: '_blank' } : {})}>Link</a>

// GOOD - Using the ExternalLink component
<ExternalLink href={url}>Link</ExternalLink>
```

### Features
- Automatically handles environment differences (BUI vs DUI)
- Adds security attributes in browser environments
- Prevents navigation issues in DUI
- Provides toast notifications for better UX

See full documentation at `docs/development/bui/components/ExternalLink.md`

## LLM Guidelines for BUI Components

### Component Documentation for LLMs
When creating components that may be referenced by Large Language Models:

1. Include comprehensive JSDoc comments with:  
   - Purpose and use cases for the component
   - Detailed prop descriptions including types and defaults
   - Usage examples showing common patterns
   - Notes about special behavior or edge cases

2. Structure code for LLM readability:  
   - Clear prop interface definitions at the top
   - Logical organization of code sections (state, effects, helpers, render)
   - Meaningful variable and function names
   - Comments explaining non-obvious logic

3. For complex components:  
   - Create a separate markdown file in the `docs/development/bui/components/` directory
   - Link to the documentation in component JSDoc
   - Include migration guides if replacing older components

### Example of LLM-friendly Component Documentation
```typescript
/**
 * Component for consistently handling external links across BUI/DUI environments.
 * 
 * @example
 * <ExternalLink href="https://example.com">External Link</ExternalLink>
 * 
 * @see docs/development/bui/components/ExternalLink.md for complete documentation
 */
export function ExternalLink({
  href,
  showToast = true,
  useClickHandler = true,
  // Additional props with documentation...
}: ExternalLinkProps): JSX.Element {
  // Implementation...
}
```

## Future Improvements

1. Implement error handling for cases where the server rejects the projectId as invalid
2. Improve the UI/UX of the chat interface
3. Add more robust error handling and input validation
4. Implement additional features like conversation history or file uploads

## WebSocket Implementation

### Connection Setup
```typescript
const ws = new WebSocket(
  `ws://localhost:3162/ws/conversation/${conversationId}`
);

// Reconnection attempts should use exponential backoff with jitter 
// to avoid overwhelming the server during connection issues
// See Connection Management section below
```

### Message Structure
```typescript
interface WebSocketMessage {
  task: 'greeting' | 'converse' | 'cancel';
  statement?: string;
  projectId: string;
}
```

### Connection Management
- Implement retry logic with exponential backoff
- Handle connection state changes
- Provide user feedback
- Clean up on unmount

## State Management

### Component State
- Use Fresh signals for state management
- Prefer signal over useState:
  ```typescript
  // Good
  const count = signal(0);
  count.value++;

  // Bad
  const [count, setCount] = useState(0);
  setCount(count + 1);
  ```
- Clear state initialization
- Predictable update patterns
- Error state handling
- Loading state management

### Application State
- Project context management
- User preferences
- Connection status
- Error conditions

## Error Handling

### User-Facing Errors
```typescript
try {
  // Operation
} catch (error) {
  setError({
    message: "User-friendly message",
    details: error.message
  });
}
```

### Connection Errors
- Implement reconnection logic
- Show connection status
- Use exponential backoff with jitter for reconnection attempts
- Provide retry options
- Clear error messages

## Testing Focus Areas

1. Component Testing:
   - Render behavior
   - State updates
   - Event handling
   - Error boundaries

2. WebSocket Testing:
   - Connection management
   - Message handling
   - Reconnection logic
   - Error scenarios
   - Verify greeting message handling
   - Test intentional disconnection scenarios

3. Integration Testing:
   - API communication
   - State synchronization
   - Error propagation
   - User interactions

## API Integration

### WebSocket Communication
- Follow message format conventions
- Handle connection lifecycle
- Implement retry logic
- Ensure greeting message is sent on connection establishment
- Manage state updates

### Project Context
- Always include projectId
- Validate working directory
- Handle context changes
- Maintain consistency

## Performance

### Component Optimization
- Use static components where possible
- Implement proper memo usage
- Optimize re-renders
- Handle cleanup

### Connection Management
- Implement connection pooling
- Handle reconnection gracefully
- Manage message queues
- Clean up resources

## Accessibility

### Required Attributes
- Proper ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support

### Interactive Elements
- Clear focus states
- Proper tab order
- Error announcements
- Loading indicators

## Documentation

### Component Documentation
- Clear prop interfaces
- Usage examples
- State management
- Event handling

### Type Definitions
```typescript
interface ComponentProps {
  // Document each prop
  propName: string;  // Description of prop
}
```

## Important Notes

1. Always import shared utilities from correct paths
2. Maintain WebSocket connection patterns
3. The `projectId` is crucial for the BB system and must be sent with each message.
4. Follow error handling conventions
5. Keep accessibility in mind
6. Document significant changes
