# BUI State Management

## Important Update
This document has been superseded by the new dual-state architecture. Please refer to [State Management Separation](./state_management_separation.md) for the current architecture.

The information below is maintained for historical context and for understanding the evolution of the state management system.

## Historical Implementation

Beyond Better's UI previously used a single state management approach. This has been replaced by a dual-state architecture that separates application-level and chat-specific concerns.

### Previous State Categories

1. Global State (Now split between App and Chat states)
- User authentication
- Current project context
- Feature flags/billing plan status
- Global preferences

2. Local Island State (Still relevant)
- UI state
- Form data
- Temporary data
- Island-specific settings

3. Shared Component State (Still relevant)
- UI controls
- Common widgets
- Shared functionality

## Migration to New Architecture

### Current State Management
The BUI now implements a dual-state architecture:

1. App State
- Global application state
- Connection status
- Version information
- Project management

2. Chat State
- Chat-specific state
- Conversation management
- Tool execution
- Message handling

For current implementation details, see:
- [State Management Separation](./state_management_separation.md)
- [Progress Summary](../progress_summary.md)

### Key Changes

1. WebSocket Management
- Separate connections for app and chat
- Independent error handling
- Isolated state updates

2. Component Integration
- Components use appropriate state layer
- Clear separation of concerns
- Independent error handling

3. State Updates
- Targeted state updates
- Reduced coupling
- Better error isolation

## Best Practices

While some of these practices remain relevant, please refer to the new architecture documentation for current best practices:

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

## Next Steps

The BUI is transitioning to the new state management architecture. Key tasks include:

1. Implementation
- Complete app state implementation
- Add new WebSocket endpoint
- Update component integration
- Enhance error handling

2. Migration
- Move appropriate state to app level
- Update component dependencies
- Enhance error handling
- Add new features

3. Documentation
- Update component docs
- Add migration guides
- Document new patterns
- Provide examples

## References

1. Current Architecture
- [State Management Separation](./state_management_separation.md)
- [Progress Summary](../progress_summary.md)

2. Implementation Details
- [Home Page Implementation](../features/home_page.md)
- [Component Patterns](./components.md)

3. Testing
- [Testing Strategy](../testing/strategy.md)