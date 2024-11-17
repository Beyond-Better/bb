# BUI Testing Strategy

## Overview

Testing the Browser User Interface (BUI) requires special consideration of Fresh's island architecture and Deno's testing capabilities. This document outlines testing strategies that align with existing project patterns while addressing Fresh-specific concerns.

## Testing Priorities

1. Island Testing
   - Component isolation
   - State management
   - Event handling
   - WebSocket interactions

2. State Management Testing
   - Local state behavior
   - Signal updates
   - State initialization
   - Cleanup handling

3. Component Testing
   - Shared components
   - UI interactions
   - Event handlers
   - Rendering logic

## Test Structure

### Island Tests
```typescript
import { assertEquals, assertExists } from '@deno/testing/asserts.ts';

Deno.test({
    name: 'Island: specific functionality being tested',
    async fn() {
        // Setup
        const island = new IslandComponent({...});

        // Test execution
        await island.someAction();

        // Assertions
        assertEquals(island.state.value, expected);
    },
    sanitizeResources: false,
    sanitizeOps: false,
});
```

### State Management Tests
```typescript
Deno.test({
    name: 'State: specific behavior being tested',
    async fn() {
        // Setup state
        const { state, handlers } = useSomeState();

        // Execute state changes
        await handlers.someAction();

        // Assert state updates
        assertEquals(state.value, expected);
    }
});
```

## Testing Patterns

### 1. Test Setup
- Use helper functions for common setup
- Create mock data and services
- Initialize test environment
- Handle cleanup

### 2. Mock Implementation
```typescript
// Mock service class
class MockWebSocket {
    private handlers = new Map<string, Function>();
    
    send(message: string) {
        // Mock implementation
    }
    
    on(event: string, handler: Function) {
        this.handlers.set(event, handler);
    }
}
```

### 3. Assertion Patterns
- Use specific assertions
- Include meaningful messages
- Test both success and failure cases
- Verify state changes

### 4. Fresh/Island Considerations
- Test island initialization
- Verify island boundaries
- Test state isolation
- Handle server/client differences

## WebSocket Testing

### 1. Connection Testing
```typescript
Deno.test({
    name: 'WebSocket: establishes connection',
    async fn() {
        const ws = new WebSocketManager(config);
        await ws.connect();
        assertExists(ws.isConnected.value);
    }
});
```

### 2. Message Handling
```typescript
Deno.test({
    name: 'WebSocket: handles messages',
    async fn() {
        const ws = new WebSocketManager(config);
        const message = { type: 'test', data: 'content' };
        
        // Setup message handler
        let received = null;
        ws.on('message', (msg) => {
            received = msg;
        });
        
        // Simulate message
        await ws.handleMessage(message);
        
        assertEquals(received, message);
    }
});
```

### 3. Error Handling
```typescript
Deno.test({
    name: 'WebSocket: handles errors',
    async fn() {
        const ws = new WebSocketManager(config);
        
        await assertThrows(
            () => ws.connect('invalid-url'),
            Error,
            'Expected error message'
        );
    }
});
```

## Test Organization

```
bui/tests/
  islands/           # Island-specific tests
    chat.test.ts
    settings.test.ts
  components/        # Shared component tests
    input.test.ts
    status.test.ts
  state/            # State management tests
    chatState.test.ts
    userState.test.ts
  utils/            # Utility function tests
    websocket.test.ts
    api.test.ts
  mocks/            # Mock implementations
    websocket.mock.ts
    api.mock.ts
```

## Best Practices

1. Test Organization
   - Group related tests
   - Clear test descriptions
   - Consistent file naming
   - Logical test order

2. Test Coverage
   - Core functionality
   - Edge cases
   - Error conditions
   - State transitions

3. Fresh Specifics
   - Test island boundaries
   - Verify state isolation
   - Handle SSR cases
   - Test client hydration

4. Performance
   - Minimize test setup
   - Clean up resources
   - Batch related tests
   - Use appropriate timeouts

## Next Steps

1. Implement test infrastructure
2. Create initial island tests
3. Add state management tests
4. Develop component tests
5. Set up CI integration