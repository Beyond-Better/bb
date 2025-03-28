# BUI Component Patterns

## Important Update
This document has been updated to reflect the new dual-state architecture. Components now interact with either app state, chat state, or both, depending on their responsibilities.

## Component Hierarchy

```
Layout/
├── SideNav (island)/              # Uses app state
│   ├── Logo
│   ├── MainNavigation
│   ├── ProjectSelector            # Uses app state for projects
│   └── StatusFooter
│       ├── ServerStatus          # Uses app state
│       ├── VersionInfo          # Uses app state
│       └── ExternalLinks
│
├── MetadataBar (island)/         # Context-aware
│   ├── Chat/                    # Uses chat state
│   │   ├── ProjectMetadata
│   │   └── ConversationTools
│   ├── Projects/               # Uses app state
│   │   ├── ProjectStats
│   │   └── ProjectActions
│   └── Settings/              # Uses app state
│       ├── CategoryInfo
│       └── CategoryActions
│
└── MainContent               # Route-specific content
```

## Component Types

### 1. App-Level Components
Components that use app state for global features.

```typescript
// Example: ServerStatus component
function ServerStatus() {
    const appState = useAppState();
    
    return (
        <div class={`flex items-center ${
            appState.value.status.isReady ? "text-green-500" : "text-red-500"
        }`}>
            <StatusIndicator status={appState.value.status} />
            <span>{appState.value.status.isReady ? "Connected" : "Disconnected"}</span>
        </div>
    );
}
```

### 2. Chat-Specific Components
Components that use chat state for conversation features.

```typescript
// Example: ConversationTools component
function ConversationTools() {
    const chatState = useChatState();
    
    return (
        <div class="flex items-center space-x-2">
            <ToolStatus status={chatState.value.status} />
            <TokenDisplay usage={chatState.value.tokenUsage} />
        </div>
    );
}
```

### 3. Hybrid Components
Components that may use both app and chat state.

```typescript
// Example: ProjectSelector component
function ProjectSelector() {
    const appState = useAppState();
    const chatState = useChatState();
    
    return (
        <div>
            <ProjectList projects={appState.value.projects} />
            {chatState.value.status.isReady && (
                <CurrentProject project={chatState.value.currentProject} />
            )}
        </div>
    );
}
```

## State Access Patterns

### 1. App State Access
```typescript
function AppStateComponent() {
    const appState = useAppState();
    
    useEffect(() => {
        // Handle app-level effects
        if (appState.value.status.isReady) {
            // Perform app-level operations
        }
    }, [appState.value.status.isReady]);
    
    return (
        <div>
            <StatusDisplay status={appState.value.status} />
            <VersionInfo version={appState.value.version} />
        </div>
    );
}
```

### 2. Chat State Access
```typescript
function ChatStateComponent() {
    const chatState = useChatState();
    
    useEffect(() => {
        // Handle chat-specific effects
        if (chatState.value.status.isReady) {
            // Perform chat operations
        }
    }, [chatState.value.status.isReady]);
    
    return (
        <div>
            <ConversationDisplay entries={chatState.value.logDataEntries} />
            <ToolStatus status={chatState.value.status} />
        </div>
    );
}
```

## Error Handling

### 1. App-Level Errors
```typescript
function AppErrorBoundary() {
    const appState = useAppState();
    
    if (appState.value.error) {
        return (
            <div class="bg-red-50 p-4 rounded-md">
                <h3 class="text-red-800">Application Error</h3>
                <p class="text-red-600">{appState.value.error}</p>
            </div>
        );
    }
    
    return null;
}
```

### 2. Chat-Level Errors
```typescript
function ChatErrorDisplay() {
    const chatState = useChatState();
    
    if (chatState.value.error) {
        return (
            <div class="bg-yellow-50 p-4 rounded-md">
                <h3 class="text-yellow-800">Chat Error</h3>
                <p class="text-yellow-600">{chatState.value.error}</p>
            </div>
        );
    }
    
    return null;
}
```

## Component Best Practices

### 1. State Usage
- Use appropriate state layer (app vs chat)
- Keep state access close to usage
- Handle loading and error states
- Clean up subscriptions

### 2. Error Handling
- Use appropriate error boundary
- Handle layer-specific errors
- Provide recovery options
- Log errors appropriately

### 3. Performance
- Minimize state updates
- Use computed values
- Implement proper cleanup
- Monitor component lifecycle

## Implementation Examples

### 1. Home Page
```typescript
function HomePage() {
    const appState = useAppState();
    
    if (!appState.value.status.isReady) {
        return <DownloadGuide />;
    }
    
    return (
        <div>
            <ProjectList projects={appState.value.projects} />
            <QuickActions />
            <SystemStatus status={appState.value.status} />
        </div>
    );
}
```

### 2. Chat Page
```typescript
function ChatPage() {
    const appState = useAppState();
    const chatState = useChatState();
    
    return (
        <div>
            <MetadataBar>
                <ChatMetadata />
            </MetadataBar>
            <Chat />
            <StatusBar
                appStatus={appState.value.status}
                chatStatus={chatState.value.status}
            />
        </div>
    );
}
```

## Testing Components

### 1. App State Testing
```typescript
Deno.test("AppComponent: handles connection status", async () => {
    const component = new AppComponent();
    await component.connect();
    assertEquals(component.status, "connected");
});
```

### 2. Chat State Testing
```typescript
Deno.test("ChatComponent: handles message flow", async () => {
    const component = new ChatComponent();
    await component.sendMessage("test");
    assertEquals(component.messages.length, 1);
});
```

## Migration Guide

### 1. Converting Existing Components
- Identify state dependencies
- Choose appropriate state layer
- Update state access
- Add error handling
- Test new implementation

### 2. Creating New Components
- Determine state requirements
- Choose component type
- Implement state access
- Add error handling
- Write tests

## References

1. Architecture Documents
- [State Management Separation](./state_management_separation.md)
- [Testing Strategy](../testing/strategy.md)

2. Implementation Examples
- [Home Page Implementation](../features/home_page.md)
- [Progress Summary](../progress_summary.md)