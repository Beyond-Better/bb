# Beyond Better UI (BUI) Development Guide

## Introduction

This document serves as the primary reference for BUI development conversations. It outlines the architecture, patterns, and considerations for developing the Beyond Better user interface using Deno Fresh.

## Key Principles

1. Island-First Development
   - Components are isolated JavaScript contexts
   - State management respects island boundaries
   - Features are organized around islands
   - Testing focuses on island behavior

2. Deno/Fresh Priority
   - Use Deno native solutions when available
   - Prefer web standards over framework-specific patterns
   - Consider Fresh's specific limitations and features
   - Maintain SSR compatibility

3. Modular Architecture
   - Clear separation of concerns
   - Reusable components and utilities
   - Well-defined state management
   - Testable code structure

## Project Structure

```
bui/
├── src/
│   ├── islands/        # Interactive components
│   ├── components/     # Shared UI components
│   ├── hooks/         # Custom hooks
│   ├── types/         # TypeScript definitions
│   └── utils/         # Shared utilities
└── tests/            # Test files
```

## Development Process

### 1. Starting New Features

Before implementation:
1. Review this document and referenced guides
2. Identify island boundaries
3. Plan state management approach
4. Consider testing strategy

### 2. Conversation Structure

Each development conversation should:
1. State clear objectives
2. Reference relevant documentation
3. Follow established patterns
4. Include testing considerations

Example conversation start:
```
Objective: Add user settings panel
References: 
- docs/bui/features/user-settings.md
- docs/bui/architecture/state-management.md
Considerations:
- Island isolation
- State persistence
- Testing strategy
```

### 3. Code Organization

Follow these patterns:
1. Types and interfaces first
2. Utility functions
3. State management
4. Component implementation
5. Tests

## Core Technologies

### 1. Deno Fresh
- Island architecture
- No client-side routing
- Server-side rendering
- Limited React feature set

### 2. Preact
- Lightweight React alternative
- Signal-based state management
- Limited hook availability
- Fresh-specific constraints

### 3. TypeScript
- Strict type checking
- Interface-driven development
- Type-safe state management
- Clear API contracts

## Feature Development

### 1. Planning
1. Identify island requirements
2. Plan state management
3. Design component structure
4. Consider testing approach

### 2. Implementation
1. Create type definitions
2. Implement utilities
3. Add state management
4. Build components
5. Write tests

### 3. Testing
1. Unit tests for utilities
2. Island-specific tests
3. State management tests
4. Integration tests

## State Management

See [State Management](architecture/state-management.md) for detailed patterns.

Key points:
1. Use local state within islands
2. Signals for shared state
3. URL parameters for configuration
4. localStorage for persistence

## Testing Strategy

See [Testing Strategy](testing/testing/strategy.md) for detailed patterns.

Key points:
1. Focus on island testing
2. Use Deno's native testing
3. Test state management
4. Mock external services

## Current Features

### 1. Chat Interface
- Main interaction point
- WebSocket communication
- Conversation management
- Real-time updates

### 2. Project Management (Planned)
- Project workspace selection
- Multiple project types
- Project settings
- Access management

### 3. User Settings (Planned)
- User preferences
- Theme management
- Notification settings
- Account management

## Best Practices

### 1. Code Organization
- Clear file structure
- Consistent naming
- Proper typing
- Comprehensive documentation

### 2. State Management
- Minimal shared state
- Clear state ownership
- Proper cleanup
- Error handling

### 3. Testing
- Comprehensive coverage
- Clear test cases
- Proper mocking
- Performance consideration

### 4. Error Handling
- Type-safe errors
- User feedback
- Error recovery
- Proper logging

## Common Patterns

### 1. Island Creation
```typescript
// islands/SomeFeature.tsx
export default function SomeFeature() {
    // 1. URL parameters
    const params = IS_BROWSER ? 
        new URLSearchParams(window.location.hash.slice(1)) : 
        null;

    // 2. State management
    const [state, handlers] = useSomeState(config);

    // 3. Effects
    useEffect(() => {
        // Setup and cleanup
    }, []);

    // 4. Render
    return (
        <div>
            {/* Components */}
        </div>
    );
}
```

### 2. State Management
```typescript
// hooks/useSomeState.ts
function useSomeState(config: Config) {
    // 1. Local state
    const [state, setState] = useState(initial);

    // 2. Effects
    useEffect(() => {
        // Initialize
        return () => {
            // Cleanup
        };
    }, []);

    // 3. Handlers
    const handlers = {
        someAction: () => {},
    };

    return [state, handlers];
}
```

### 3. Testing
```typescript
// tests/islands/someFeature.test.ts
Deno.test({
    name: 'Feature: specific functionality',
    async fn() {
        // Setup
        // Test
        // Assert
    },
});
```

## Next Steps

1. Review [Current Refactor](architecture/current-refactor.md)
2. Implement project management
3. Add user settings
4. Expand testing coverage

## References

- [Current Refactor](architecture/current-refactor.md)
- [State Management](architecture/state-management.md)
- [Testing Strategy](testing/strategy.md)
- [Project Management](features/project-management.md)
- [User Settings](features/user-settings.md)