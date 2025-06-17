# Message Formatting and Caching Strategy

## Overview

This document outlines the strategy for handling formatted log entries in the BUI chat interface, specifically focusing on tool use and tool result messages. It serves as a reference for future implementation of caching mechanisms and formatting optimizations.

## Current Implementation

### Message Entry Component
- Handles rendering of different message types
- Uses marked and hljs for basic formatting
- No API-based formatting for tool messages
- No caching mechanism

## Formatting Requirements

1. Tool Messages
   - Fetch formatted content from API for:
     - tool_use entries
     - tool_result entries
   - Maintain existing formatting for other entry types
   - Handle API request failures gracefully

2. API Integration
   ```typescript
   // Example API endpoint
   /api/v1/format_log_entry/browser/${entryType}
   
   // Request body
   {
     logEntry: CollaborationLogEntry;
     projectId: string;
   }
   ```

## Caching Considerations

### Initial Simple Implementation
```typescript
// In MessageEntry.tsx
const [formattedContent, setFormattedContent] = useState<string | null>(null);

useEffect(() => {
  if (logDataEntry.logEntry?.entryType === 'tool_use' || 
      logDataEntry.logEntry?.entryType === 'tool_result') {
    fetchFormattedContent();
  }
}, [logDataEntry.logEntry]);
```

### Future Caching Strategy

1. Cache Structure
   ```typescript
   interface FormattedContentCache {
     [conversationId: string]: {
       [entryIndex: number]: {
         formattedContent: string;
         timestamp: number;
         expiresAt: number;
       }
     }
   }
   ```

2. Storage Options
   - localStorage for persistence across page reloads
   - Memory cache for faster access during session
   - Consider IndexedDB for larger datasets

3. Cache Management
   - Set reasonable expiry times (e.g., 24 hours)
   - Clear old entries periodically
   - Implement size limits
   - Handle cache invalidation

4. Implementation Plan
   ```typescript
   class FormattingCache {
     private static CACHE_KEY = 'bb_formatted_content';
     private static MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
     private static MAX_SIZE = 5 * 1024 * 1024; // 5MB

     static async get(conversationId: string, entryIndex: number): Promise<string | null> {
       // Implementation
     }

     static async set(
       conversationId: string, 
       entryIndex: number, 
       content: string
     ): Promise<void> {
       // Implementation
     }

     static async clear(conversationId?: string): Promise<void> {
       // Implementation
     }

     private static async cleanup(): Promise<void> {
       // Remove expired entries
       // Enforce size limits
     }
   }
   ```

5. Cache Invalidation Triggers
   - Conversation switch
   - Cache expiry
   - Manual clear
   - Size limit reached

## Implementation Phases

### Phase 1: Basic API Integration
1. Add API client prop to MessageEntry
2. Implement formatting fetch for tool messages
3. Add loading states
4. Handle errors gracefully

### Phase 2: Basic Caching
1. Implement in-memory cache
2. Add cache hit/miss logging
3. Monitor performance impact
4. Gather usage metrics

### Phase 3: Advanced Caching
1. Implement localStorage persistence
2. Add cache management
3. Implement cleanup strategies
4. Add monitoring and metrics

### Phase 4: Optimization
1. Analyze cache hit rates
2. Optimize cache strategies
3. Implement prefetching if beneficial
4. Add cache warming strategies

## Testing Strategy

1. Unit Tests
   ```typescript
   Deno.test({
     name: "FormattingCache: basic operations",
     async fn() {
       // Test cache operations
     }
   });
   ```

2. Integration Tests
   - Cache persistence
   - Error handling
   - Cache invalidation
   - Size limits

3. Performance Tests
   - Cache hit rates
   - Loading times
   - Memory usage
   - Storage usage

## Metrics and Monitoring

1. Cache Performance
   - Hit/miss rates
   - Average load times
   - Storage usage
   - Memory usage

2. API Performance
   - Request times
   - Error rates
   - Bandwidth usage

## Future Considerations

1. Prefetching Strategies
   - Preload on conversation load
   - Background loading of visible messages
   - Predictive loading based on scroll direction

2. Advanced Caching
   - Shared worker for cache management
   - Service worker integration
   - Cross-tab cache coordination

3. Performance Optimizations
   - Compression of cached content
   - Partial content updates
   - Differential loading strategies

## References

- [BUI Overview](../overview.md)
- [State Management](../architecture/state-management.md)
- [Testing Strategy](../testing/strategy.md)