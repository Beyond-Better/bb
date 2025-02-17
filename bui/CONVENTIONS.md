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
