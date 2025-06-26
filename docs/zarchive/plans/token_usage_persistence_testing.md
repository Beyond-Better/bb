# Token Usage Persistence Testing Plan

## Overview
This document outlines the testing strategy for the token usage persistence system, focusing on both TokenUsagePersistence and its integration with InteractionPersistence.

## Test Structure

### 1. Test Files Location
```
api/tests/t/storage/
  - tokenUsagePersistence.test.ts
  - interactionPersistence.test.ts
```

### 2. Test Setup
Using existing test helpers from `api/tests/lib/testSetup.ts`:

```typescript
// api/tests/t/storage/tokenUsagePersistence.test.ts
import {
  assert,
  assertEquals,
  assertRejects,
} from 'api/tests/deps.ts';
import {
  withTestProject,
  getProjectEditor,
  createTestInteraction,
  createTestChatInteraction,
} from 'api/tests/lib/testSetup.ts';

Deno.test({
  name: 'TokenUsagePersistence - Basic write and read operations',
  fn: async () => {
    await withTestProject(async (testProjectId, testProjectRoot) => {
      // Test setup using project structure
      const projectEditor = await getProjectEditor(testProjectId);
      const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

      // Test implementation
      const tokenUsagePersistence = interaction.interactionPersistence['tokenUsagePersistence'];
      
      // Create test record
      const record: TokenUsageRecord = {
        messageId: 'test-message-1',
        timestamp: new Date().toISOString(),
        role: 'assistant',
        type: 'conversation',
        rawUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          cacheCreationInputTokens: 10,
          cacheReadInputTokens: 5
        },
        differentialUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150
        },
        cacheImpact: {
          potentialCost: 100,
          actualCost: 85,
          savings: 15
        }
      };

      // Write record
      await tokenUsagePersistence.writeUsage(record, 'conversation');

      // Read records
      const records = await tokenUsagePersistence.getUsage('conversation');
      
      // Assertions
      assertEquals(records.length, 1);
      assertEquals(records[0], record);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
```

### 3. Test Categories

#### 3.1 TokenUsagePersistence Tests
Location: `api/tests/t/storage/tokenUsagePersistence.test.ts`

1. Basic Operations
```typescript
Deno.test('TokenUsagePersistence - Basic write and read operations', async (t) => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    await t.step('should write and read conversation token usage', async () => {
      // Test implementation
    });

    await t.step('should write and read chat token usage', async () => {
      // Test implementation
    });
  });
});
```

2. Error Handling
```typescript
Deno.test('TokenUsagePersistence - Error handling', async (t) => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    await t.step('should handle directory creation errors', async () => {
      // Test implementation
    });

    await t.step('should handle write errors', async () => {
      // Test implementation
    });
  });
});
```

3. Data Validation
```typescript
Deno.test('TokenUsagePersistence - Data validation', async (t) => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    await t.step('should validate record structure', async () => {
      // Test implementation
    });

    await t.step('should validate token calculations', async () => {
      // Test implementation
    });
  });
});
```

#### 3.2 InteractionPersistence Integration Tests
Location: `api/tests/t/storage/interactionPersistence.test.ts`

1. Token Usage Integration
```typescript
Deno.test('InteractionPersistence - Token usage integration', async (t) => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    await t.step('should initialize TokenUsagePersistence', async () => {
      // Test implementation
    });

    await t.step('should handle token usage in saveInteraction', async () => {
      // Test implementation
    });
  });
});
```

2. Analysis Methods
```typescript
Deno.test('InteractionPersistence - Token usage analysis', async (t) => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    await t.step('should analyze token usage', async () => {
      // Test implementation
    });

    await t.step('should calculate cache impact', async () => {
      // Test implementation
    });
  });
});
```

### 4. Test Scenarios

#### 4.1 Basic Functionality
- Write and read token usage records
- Separate conversation and chat records
- Handle different record types
- Validate record structure

#### 4.2 Error Handling
- Directory creation failures
- Write permission issues
- Invalid record data
- Missing required fields

#### 4.3 Data Analysis
- Token usage calculations
- Cache impact analysis
- Differential usage tracking
- Role-based metrics

#### 4.4 Integration Points
- InteractionPersistence integration
- Event handling
- Error propagation
- Resource cleanup

### 5. Test Utilities

#### 5.1 Mock Data Generation
```typescript
// api/tests/lib/mockData.ts
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
export function createMockTokenUsageRecord(
  role: 'user' | 'assistant' | 'system' = 'assistant',
  type: InteractionType = 'conversation'
): TokenUsageRecord {
  return {
    messageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    role,
    type,
    rawUsage: {
      inputTokens: Math.floor(Math.random() * 1000),
      outputTokens: Math.floor(Math.random() * 1000),
      totalTokens: 0, // Will be calculated
      cacheCreationInputTokens: Math.floor(Math.random() * 100),
      cacheReadInputTokens: Math.floor(Math.random() * 100)
    },
    differentialUsage: DEFAULT_TOKEN_USAGE(), // Will be calculated
    cacheImpact: DEFAULT_TOKEN_USAGE(), // Will be calculated
  };
}
```

## Implementation Steps

1. Create test files and structure
   - Set up test files in correct locations
   - Import required dependencies
   - Set up test project helpers

2. Implement basic tests
   - Write core functionality tests
   - Add error handling tests
   - Add validation tests

3. Add analysis tests
   - Implement metric calculation tests
   - Add cache analysis tests
   - Add differential tracking tests

4. Add integration tests
   - Test InteractionPersistence integration
   - Test event handling
   - Test resource management

5. Add edge case tests
   - Test error conditions
   - Test concurrent operations
   - Test large datasets

## Next Steps

1. Create test files in api/tests/t/storage/
2. Implement basic functionality tests
3. Add analysis and integration tests
4. Run tests and verify coverage
5. Update documentation with results