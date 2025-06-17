# BUI State Management Separation

## Overview

The BUI implements a dual-state architecture that separates application-level state from chat-specific state. This separation allows for independent operation of core application features and chat functionality, while maintaining clear boundaries between concerns.

## State Layers

### Application State
Manages application-wide features and status that are relevant across all routes.

#### WebSocket Connection
- **Endpoint**: `/v1/ws/app`
- **Purpose**: Handle application-level events and updates
- **Connection Timing**: Establishes immediately on app load via AppStateProvider
- **Connection Status**: Used to determine if BB app is running
- **Primary Responsibility**: Version info management

#### Implementation
```typescript
interface AppState {
    wsManager: WebSocketManagerBase | null;
    apiClient: ApiClient | null;
    status: WebSocketStatus;
    error: string | null;
    versionInfo?: VersionInfo;
}

// Managed by AppStateProvider island
const appState = signal<AppState>({
    wsManager: null,
    apiClient: null,
    status: {
        isConnecting: false,
        isReady: false,
        isLoading: false,
        error: null
    },
    error: null,
    versionInfo: undefined
});
```

### Chat State
Manages chat-specific functionality and maintains its own independent connection.

#### WebSocket Connection
- **Endpoint**: `/v1/ws/conversation/<id>`
- **Purpose**: Handle conversation-specific messages and updates
- **Connection Timing**: Establishes when entering chat route with conversation
- **Connection Status**: Independent from app connection
- **Primary Responsibility**: Chat functionality

#### Implementation
```typescript
interface ChatState {
    conversationId: string | null;
    apiClient: ApiClient | null;
    wsManager: WebSocketManager | null;
    logDataEntries: CollaborationLogDataEntry[];
    conversations: ConversationMetadata[];
    status: ChatStatus;
    error: string | null;
}

interface ChatStatus {
    cacheStatus: CacheStatus;
    lastApiCallTime: number | null;
    isConnecting: boolean;
    isLoading: boolean;
    apiStatus: ApiStatus;
    toolName?: string;
    isReady: boolean;
}
```

## WebSocket Manager Implementation

### Base Manager
Provides common WebSocket functionality:
```typescript
abstract class WebSocketManagerBaseImpl implements WebSocketManagerBase {
    protected socket: WebSocket | null = null;
    protected _status = {
        isConnecting: false,
        isReady: false,
    };

    // Common functionality
    connect(): Promise<void>;
    disconnect(): void;
    protected abstract getWebSocketUrl(): string;
    protected abstract handleMessage(event: MessageEvent): void;
}
```

### App-Specific Manager
Handles app-level WebSocket communication:
```typescript
class WebSocketManagerApp extends WebSocketManagerBaseImpl {
    protected getWebSocketUrl(): string {
        return `${this.wsUrl}/app`;
    }

    protected override onSocketOpen(): void {
        this.sendGreeting();
    }

    protected handleMessage(event: MessageEvent): void {
        // Handle hello message with version info
    }
}
```

### Chat-Specific Manager
Handles chat-level WebSocket communication:
```typescript
class WebSocketManagerChat extends WebSocketManagerBaseImpl {
    private conversationId: ConversationId | null = null;

    protected getWebSocketUrl(): string {
        return `${this.wsUrl}/conversation/${this.conversationId}`;
    }

    protected override onSocketOpen(): void {
        this.sendGreeting();
    }

    protected handleMessage(event: MessageEvent): void {
        // Handle chat-specific messages
    }
}
```

## Key Architectural Principles

### 1. Independence
- Each state layer operates independently
- No waiting dependencies between states
- Each layer maintains its own error states
- Separate WebSocket managers prevent message cross-talk

### 2. Connection Management
- App connection indicates BB app availability
- Chat connection manages conversation-specific state
- Each layer handles its own reconnection logic
- Connection status is maintained separately

### 3. Error Handling
- App errors don't affect chat functionality
- Chat errors don't affect app-level features
- Each layer implements its own error recovery
- Error states are isolated between layers

### 4. State Updates
- App state updates affect global UI elements
- Chat state updates affect only chat functionality
- State changes respect layer boundaries
- Cross-layer communication is explicit and controlled

## Component Integration

### AppStateProvider
Root-level island that initializes and manages app state:
```typescript
function AppStateProvider({ wsUrl, apiUrl }: AppStateProviderProps) {
    const appState = useAppState();

    useEffect(() => {
        initializeAppState({ url: wsUrl, apiUrl });
    }, [wsUrl, apiUrl]);

    return null;
}
```

### Version Info Flow
1. App WebSocket receives version info in hello message
2. App state updates with version info
3. Components access version info from app state
4. Version compatibility checks handled by useVersion hook

## Implementation Considerations

### 1. Island Lifecycle
- AppStateProvider included in Layout for global presence
- Chat manages its own connection lifecycle
- WebSocket connections clean up properly
- State persists appropriately across routes

### 2. API Client Usage
- Each layer creates its own API client instance
- API client maintains no state
- Lightweight client creation is efficient
- No shared state between clients

### 3. Message Routing
- Messages are routed to appropriate handlers
- No cross-talk between app and chat messages
- Each layer processes only relevant messages
- Message types are distinct between layers

### 4. Error Boundaries
- App errors shown in global context
- Chat errors shown in chat context
- Each layer handles its own recovery
- No error propagation between layers