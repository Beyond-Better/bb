# BUI State Management

## Overview

Beyond Better's UI requires careful state management due to Fresh's island architecture. This document outlines the hybrid approach to state management, balancing local island state with global application needs.

## State Categories

### 1. Global State
Required for:
- User authentication
- Current project context
- Feature flags/billing plan status
- Global preferences

Implementation:
```typescript
// Using Preact signals for reactivity
import { signal } from '@preact/signals';

export const userContext = signal({
    authenticated: false,
    preferences: {},
    currentProject: null,
    plan: 'free'
});
```

### 2. Local Island State
Specific to individual islands:
- UI state
- Form data
- Temporary data
- Island-specific settings

Example from Chat.tsx:
```typescript
interface ChatState {
    conversationId: string | null;
    entries: ConversationEntry[];
    isConnected: boolean;
    isReady: boolean;
    isWorking: boolean;
    error: string | null;
}
```

### 3. Shared Component State
For reusable components:
- UI controls
- Common widgets
- Shared functionality

## State Management Patterns

### 1. Hook-based State Management
```typescript
function useChatState(config: ChatConfig) {
    // Local state
    const [state, setState] = useState<ChatState>(initialState);
    
    // Initialization
    useEffect(() => {
        // Setup and cleanup
    }, []);
    
    // Event handlers
    const handlers = {
        sendConverse: async () => {},
        clearConversation: () => {},
    };
    
    return [state, handlers];
}
```

### 2. Signal-based Reactivity
```typescript
// Shared state with signals
const sharedState = signal({
    theme: 'light',
    language: 'en'
});

// Component usage
function ThemeToggle() {
    return (
        <button onClick={() => sharedState.value.theme = 
            sharedState.value.theme === 'light' ? 'dark' : 'light'}>
            Toggle Theme
        </button>
    );
}
```

### 3. WebSocket State Management
```typescript
class WebSocketManager {
    // Reactive state
    public isConnected = signal<boolean>(false);
    public isReady = signal<boolean>(false);
    
    // Event handling
    private eventHandlers = new Map<EventType, Set<Function>>();
    
    // State updates
    private handleStateChange(connected: boolean) {
        this.isConnected.value = connected;
        this.emit('statusChange', connected);
    }
}
```

## Fresh-specific Considerations

### 1. Island Boundaries
- Islands are isolated JavaScript contexts
- No direct state sharing between islands
- Must use signals or events for cross-island communication

### 2. State Initialization
```typescript
// In island component
export default function SomeIsland() {
    // Initialize on client side only
    const params = IS_BROWSER ? 
        new URLSearchParams(window.location.hash.slice(1)) : 
        null;
}
```

### 3. State Persistence
- Use localStorage for client-side persistence
- Consider server-side state for critical data
- Handle hydration carefully

## State Sharing Strategies

### 1. URL Parameters
```typescript
// Extract state from URL
const getUrlParams = () => {
    if (!IS_BROWSER) return null;
    const hash = window.location.hash.slice(1);
    return new URLSearchParams(hash);
};
```

### 2. Local Storage
```typescript
// Persist state locally
const [projectId, setProjectId] = useState(() => {
    if (IS_BROWSER) {
        return localStorage.getItem('projectId') || '.';
    }
    return '.';
});
```

### 3. Event-based Communication
```typescript
// Event emitter pattern
class StateManager {
    private eventHandlers = new Map<string, Set<Function>>();
    
    on(event: string, handler: Function) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler);
    }
    
    emit(event: string, data: any) {
        this.eventHandlers.get(event)?.forEach(handler => handler(data));
    }
}
```

## Best Practices

1. State Location
   - Keep state close to where it's used
   - Lift state only when necessary
   - Use signals for shared state
   - Consider state persistence needs

2. State Updates
   - Use immutable updates
   - Batch related changes
   - Handle side effects in useEffect
   - Clean up subscriptions

3. Error Handling
   - Track error states
   - Provide recovery mechanisms
   - Log state transitions
   - Handle edge cases

4. Performance
   - Minimize state updates
   - Use appropriate state granularity
   - Consider memoization
   - Profile state changes

## Decision Tree

When to use different state management approaches:

1. Use Local State when:
   - State is only used in one component
   - No other components need the data
   - State is temporary
   - UI-specific state

2. Use Signals when:
   - State needs to be shared
   - Multiple components need updates
   - Cross-island communication
   - Global settings

3. Use URL Parameters when:
   - State needs to be bookmarkable
   - Sharing state between sessions
   - Deep linking requirements
   - Configuration state

4. Use Local Storage when:
   - State persistence between sessions
   - User preferences
   - Cache-like data
   - Non-critical application state

## Next Steps

1. Implement global state management
2. Add state persistence where needed
3. Create shared component library
4. Document state flow patterns