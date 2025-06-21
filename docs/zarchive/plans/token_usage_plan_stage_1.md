# Token Usage Implementation - Phase 1 Plan

This document outlines the initial implementation phase for the new token usage tracking system. It focuses on establishing the core infrastructure and basic recording capabilities.

## Initial Tasks

### 1. Create Token Usage Storage Structure

Set up the new directory structure for token usage:
```
conversations/{collaborationId}/tokenUsage/
  - conversation.jsonl
  - chats.jsonl
```

Implementation tasks:
- Create directory creation utilities
  - Handle nested directory creation
  - Ensure proper permissions
  - Add error handling for file system operations

- Implement file handling utilities
  - Create append operations
  - Add atomic write capabilities
  - Implement file locking if needed
  - Add file rotation/cleanup utilities

- Set up error handling
  - Define specific error types
  - Add error recovery mechanisms
  - Implement logging for file operations

### 2. Define Core Types

Create the foundational type definitions:
```typescript
interface TokenUsageRecord {
  // Basic metadata
  messageId: string;        // Links to message in messages.jsonl
  timestamp: string;        // ISO timestamp
  role: 'user' | 'assistant' | 'system';  // Message role
  type: 'conversation' | 'chat';          // Interaction type
  
  // Raw usage from LLM
  rawUsage: {
    inputTokens: number;    // Total input tokens
    outputTokens: number;   // Total output tokens
    totalTokens: number;    // Combined total
    cacheCreationInputTokens: number;  // Cache write cost
    cacheReadInputTokens: number;      // Cache read cost
  };
}

interface TokenUsageError extends Error {
  code: 'WRITE_ERROR' | 'READ_ERROR' | 'VALIDATION_ERROR';
  filePath: string;
  operation: 'read' | 'write' | 'append';
}
```

Implementation tasks:
- Create type definitions
  - Define interfaces
  - Add JSDoc documentation
  - Include example usage

- Add validation functions
  - Validate record structure
  - Check required fields
  - Validate numeric values
  - Add type checking

- Create type guards
  - Implement isTokenUsageRecord
  - Add runtime type checking
  - Create validation utilities

### 3. Implement Token Usage Persistence

Create the core token usage handling in api/src/storage:

```typescript
// api/src/storage/tokenUsagePersistence.ts
class TokenUsagePersistence {
  constructor(private conversationDir: string) {}

  // Core file operations
  private async appendRecord(record: TokenUsageRecord, filePath: string): Promise<void>;
  private async readRecords(filePath: string): Promise<TokenUsageRecord[]>;
  
  // Public API
  async writeUsage(record: TokenUsageRecord, type: 'conversation' | 'chat'): Promise<void>;
  async getUsage(type: 'conversation' | 'chat'): Promise<TokenUsageRecord[]>;
}

// Update InteractionPersistence to use TokenUsageWriter
class InteractionPersistence {
  private tokenUsagePersistence: TokenUsagePersistence;

  async init(): Promise<InteractionPersistence> {
    this.tokenUsagePersistence = new TokenUsagePersistence(this.conversationDir);
    return this;
  }

  // Token usage methods
  async writeTokenUsage(record: TokenUsageRecord, type: 'conversation' | 'chat'): Promise<void>;
  async getTokenUsage(type: 'conversation' | 'chat'): Promise<TokenUsageRecord[]>;
}
```

Implementation tasks:
- Create TokenUsagePersistence class
  - Implement core file operations
  - Add atomic write handling
  - Create record validation
  - Add error handling
  - Implement file rotation if needed

- Update InteractionPersistence
  - Add TokenUsageWriter integration
  - Update initialization
  - Add token usage methods
  - Ensure proper error handling

- Extract existing usage data
  - Parse messages.jsonl records
  - Extract providerResponse.usage
  - Map to new structure
  - Handle missing data

- Add comprehensive error handling
  - Define specific error types
  - Implement recovery strategies
  - Add detailed logging
  - Create error responses

### 4. Update Interaction Classes

Update interaction classes to use the new token usage tracking:

```typescript
class BaseInteraction {
  // Update token usage handling to use new system
  protected async recordTokenUsage(usage: TokenUsage, type: 'conversation' | 'chat'): Promise<void> {
    const record = this.createTokenUsageRecord(usage);
    await this.interactionPersistence.writeTokenUsage(record, type);
  }
}
```

Implementation tasks:
- Update BaseInteraction
  - Add token usage record creation
  - Implement usage recording method
  - Update token tracking properties
  - Add type-specific handling

- Modify ChatInteraction
  - Implement chat-specific recording
  - Update token usage tracking
  - Ensure proper type flagging
  - Handle auxiliary messages

- Update ConversationInteraction
  - Add conversation-specific recording
  - Update token accumulation
  - Handle statement boundaries
  - Track component-level usage

- Add Integration Tests
  - Test both chat and conversation flows
  - Verify token accumulation
  - Test error conditions
  - Validate persistence

## Suggested Work Order

### 1. Analyze Current Token Usage
Start by understanding the existing token usage patterns:
- Use conversation_metrics tool to analyze current usage
  - Run on sample conversations
  - Identify usage patterns
  - Note edge cases
  - Document findings

- Map current usage to new structure
  - Create mapping documentation
  - Identify missing data
  - Plan data migration
  - Note potential issues

- Identify edge cases
  - List special cases
  - Document handling needs
  - Plan mitigation strategies

### 2. Create Core Types
Implement the foundational type system:
- Define interfaces
  - Create type definitions
  - Add documentation
  - Include examples

- Create helper functions
  - Add validation
  - Create utilities
  - Implement type guards

- Add validation
  - Create validators
  - Add error handling
  - Implement checks

### 3. Implement File Structure
Set up the basic file handling:
- Add directory creation
  - Create utilities
  - Handle permissions
  - Add error handling

- Set up persistence operations
  - Implement read/write operations
  - Add atomic file handling
  - Create utilities

- Add error handling
  - Define errors
  - Add recovery
  - Implement logging

### 4. Add Basic Recording
Implement the core recording functionality:
- Create persistence class
  - Implement constructor
  - Add read/write methods
  - Handle cleanup

- Implement basic operations
  - Add write methods
  - Create append functions
  - Handle concurrency

- Add initial tests
  - Create test suite
  - Add unit tests
  - Test edge cases

## Next Steps

After completing these initial tasks, we will:
1. Test the basic implementation
2. Validate token usage recording
3. Plan the next phase of development
4. Consider any needed adjustments

The next conversation should focus on analyzing current token usage patterns using the conversation_metrics tool to inform our implementation decisions.