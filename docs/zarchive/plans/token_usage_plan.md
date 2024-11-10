# Token Usage Tracking System Design

This document outlines the design and implementation plan for BB's token usage tracking system. The system aims to provide comprehensive, granular tracking of token usage across different interaction types while maintaining clear separation of concerns and detailed analytics capabilities.

## 1. Current Implementation

### 1.1 Token Usage Sources
The primary source of token usage data comes from the Anthropic LLM response, which provides:
- `input_tokens`: Tokens used in sending the request
- `output_tokens`: Tokens generated in the response
- `cache_creation_input_tokens`: Tokens used when writing to the cache
- `cache_read_input_tokens`: Tokens used when reading from cache

### 1.2 Token Usage Tracking Levels
The system currently tracks token usage at multiple levels:
- **Per Turn**: `_tokenUsageTurn` in baseInteraction.ts
  - Tracks usage for individual message exchanges
  - Reset after each turn
  - Used for immediate cost tracking

- **Per Statement**: `_tokenUsageStatement` in baseInteraction.ts
  - Accumulates usage across multiple turns within a statement
  - Reset when a new statement begins
  - Used for statement-level cost analysis

- **Per Conversation**: `_tokenUsageInteraction` in baseInteraction.ts
  - Maintains running totals for the entire conversation
  - Never reset during the conversation
  - Used for overall cost tracking

- **Chat Interactions**: Tracked in chatInteraction.ts
  - Currently mixed with main conversation totals
  - No clear separation between chat and conversation costs
  - Used for auxiliary operations like git commits and objectives

### 1.3 Current Storage
Token usage data is currently stored across multiple files:
- `messages.jsonl`: Contains raw token usage in `providerResponse.usage` - the canonical source of token metrics
- `metadata.json`: Contains conversation-level token metrics
- `conversations.json`: Stores basic usage metrics for listing/overview
- `conversation.log`: Human-readable log including token usage
- `conversation.jsonl`: Machine-readable log entries

## 2. Issues and Limitations

### 2.1 Token Usage Separation
Current limitations in usage separation:
- Chat interaction costs are mixed with main conversation totals
- No clear distinction between different types of token usage
- Auxiliary message costs affect conversation totals
- Difficult to analyze costs by interaction type

### 2.2 Cache Token Handling
Issues with current cache token handling:
- Cache tokens are tracked but not clearly differentiated
- No clear visualization of cache-related cost savings
- Cache tokens not properly factored into differential costs
- Cache creation costs (most expensive) not separately analyzed

### 2.3 Usage Recording
Limitations in current usage recording:
- No dedicated token usage storage file
- Limited granularity in usage reporting
- System prompt and tool token costs not tracked separately
- File content token usage not distinguished from message content
- No historical analysis capabilities

## 3. Proposed Changes

### 3.1 File Structure
New directory structure for token usage tracking:
```
conversations/
  {conversationId}/
    metadata.json           # Overall conversation metadata
    messages.jsonl         # Message content and basic metadata
    conversation.jsonl     # Conversation log entries
    tokenUsage/
      conversation.jsonl   # Main conversation token usage
      chats.jsonl         # Auxiliary chat token usage
```

This structure provides:
- Clear separation of concerns
- Independent tracking of different interaction types
- Easier analysis and reporting
- Better organization of token usage data

### 3.2 Token Usage Record Structure
Comprehensive token usage tracking structure:
```typescript
interface TokenUsageRecord {
  // Basic Metadata
  messageId: string;        // Links to message in messages.jsonl
  timestamp: string;        // ISO timestamp
  role: 'user' | 'assistant' | 'system';  // Message role
  type: 'conversation' | 'chat';          // Interaction type
  
  // Raw Usage from LLM
  rawUsage: {
    inputTokens: number;    // Total input tokens
    outputTokens: number;   // Total output tokens
    totalTokens: number;    // Combined total
    cacheCreationInputTokens: number;  // Cache write cost
    cacheReadInputTokens: number;      // Cache read cost
  };
  
  // Calculated Differential Costs
  differentialUsage: {
    inputTokens: number;    // Current - Previous for user messages
    outputTokens: number;   // Direct from LLM for assistant messages
    totalTokens: number;    // Combined differential
  };
  
  // Cache Impact Analysis
  cacheImpact: {
    potentialCost: number;  // Cost without cache
    actualCost: number;     // Cost with cache
    savings: number;        // Calculated savings
  };
  
  // Component-Level Breakdown
  components?: {
    systemPrompt?: number;  // System prompt tokens
    tools?: number;         // Tool-related tokens
    fileContent?: number;   // File content tokens
    baseContent?: number;   // Basic message content
  };
}
```

### 3.3 Tracking Improvements

#### 3.3.1 Separate Conversation and Chat Tracking
- Independent tracking for main conversation and auxiliary chats
- Separate storage in conversation.jsonl and chats.jsonl
- Roll-up totals for overall cost analysis
- Clear labeling of usage source and purpose
- Ability to analyze costs by interaction type

#### 3.3.2 Differential Cost Calculation
Accurate tracking of incremental token usage:
- **Assistant Messages**:
  - Use output tokens directly from LLM
  - No differential calculation needed
  - Clear cost per response

- **User Messages**:
  - Calculate input token difference from previous message
  - Account for message history growth
  - Track actual incremental cost

#### 3.3.3 Cache Token Handling
Comprehensive cache impact analysis:
- Record both potential and actual costs
- Calculate and store token savings
- Track cache creation costs separately
- Analyze cache efficiency over time
- Provide insights for cache optimization

#### 3.3.4 Component-Level Tracking
Granular tracking of token usage by component:
- **System Prompt**:
  - Track initial system prompt cost
  - Monitor system prompt updates
  - Analyze impact on conversation

- **Tool Usage**:
  - Track tokens for tool descriptions
  - Monitor tool invocation costs
  - Analyze tool result processing

- **File Content**:
  - Track tokens used for file content
  - Monitor file hydration costs
  - Analyze content caching effectiveness

- **Base Content**:
  - Track core message content
  - Separate from auxiliary content
  - Analyze conversation efficiency

## 4. Implementation Plan

### Phase 1: File Structure and Basic Recording
Initial implementation focus:
1. Create new token usage directory structure
   - Set up tokenUsage directory
   - Implement file handlers
   - Ensure proper permissions

2. Implement basic token usage recording
   - Create TokenUsageRecord interface
   - Implement basic recording functions
   - Add error handling and validation

3. Separate conversation and chat tracking
   - Split tracking logic
   - Implement separate storage
   - Add roll-up calculations

### Phase 2: Enhanced Token Calculations
Advanced token tracking features:
1. Implement differential cost calculations
   - Add calculation logic
   - Implement storage
   - Add validation

2. Add cache token tracking
   - Implement cache analysis
   - Add savings calculations
   - Track creation costs

3. Develop component-level tracking
   - Add component identification
   - Implement tracking logic
   - Add component analysis

### Phase 3: Reporting and Analysis
Integration with existing analysis tools:
1. Enhance conversation_metrics tool
   - Add detailed token analysis
   - Include cache impact metrics
   - Add component-level reporting
   - Provide historical analysis
   - Support custom date ranges
   - Add trend analysis

2. Add token usage analysis tools
   - Create usage pattern analysis
   - Add cost optimization suggestions
   - Implement usage forecasting

3. Create usage reporting commands
   - Add CLI commands
   - Implement export functions
   - Add formatting options

### Phase 4: Integration and Testing
System integration and validation:
1. Update existing logging systems
   - Modify log formatters
   - Update event handlers
   - Ensure backward compatibility

2. Add migration for existing conversations
   - Create migration scripts
   - Handle legacy data
   - Validate converted data

3. Implement comprehensive testing
   - Add unit tests
   - Create integration tests
   - Add performance benchmarks
   - Validate accuracy

## 5. Usage and Analysis

### 5.1 Using conversation_metrics
The conversation_metrics tool provides comprehensive token usage analysis:
```typescript
// Example usage
await conversation_metrics({
  includeTokens: true,      // Include token usage analysis
  includeTools: true,       // Include tool usage impact
  startTurn: 1,            // Analysis start point
  endTurn: 10             // Analysis end point
});
```

Key metrics provided:
- Total token usage by type
- Cache impact and savings
- Component-level breakdown
- Usage patterns and trends
- Cost optimization suggestions

### 5.2 Analysis Capabilities
The enhanced system will provide:
- Historical usage analysis
- Cost optimization insights
- Usage pattern detection
- Efficiency recommendations
- Cache effectiveness metrics
- Component-level analysis

## 6. Future Considerations

### 6.1 Scalability
- Handle increasing conversation sizes
- Optimize storage for large histories
- Implement efficient querying

### 6.2 Analytics
- Add machine learning analysis
- Implement predictive modeling
- Create cost optimization algorithms

### 6.3 Integration
- Support additional LLM providers
- Add external analytics tools
- Implement reporting APIs

This design provides a comprehensive foundation for token usage tracking while maintaining flexibility for future enhancements and optimizations.