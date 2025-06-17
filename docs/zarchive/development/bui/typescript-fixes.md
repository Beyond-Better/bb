# BUI TypeScript Fixes

## Type Union Handling
The `CollaborationLogDataEntry` type union needs proper handling in components. Current issues:

1. `CollaborationLogDataEntry = ConversationStart | ConversationContinue | ConversationResponse`
   - Properties like `logEntry` and `tokenUsageTurn` exist on `ConversationContinue` and `ConversationResponse`
   - But not on `ConversationStart`
   - Need to analyze usage and possibly create new union type

2. Affected Files:
   - `bui/src/components/MessageEntry.tsx`
   - `bui/src/islands/Chat.tsx`

3. Analysis Needed:
   - Determine which components truly need all entry types
   - Identify where we can narrow the type to exclude ConversationStart
   - Consider creating a new type like `ConversationActiveEntry = ConversationContinue | ConversationResponse`

## Markdown and Content Formatting
1. MarkedOptions Type Definition:
   ```typescript
   TS2353: Object literal may only specify known properties, and 'highlight' does not exist in type 'MarkedOptions'
   ```
   - Need proper type definitions for marked library
   - Handle async marked.parse properly

2. Content Type Safety:
   ```typescript
   TS2322: Type 'string | Promise<string>' is not assignable to type 'string'
   ```
   - Handle async content parsing
   - Ensure proper typing for dangerouslySetInnerHTML

## API Response Type Safety
1. Null Response Handling:
   ```typescript
   Type 'ConversationResponse | null' is not assignable to type 'ConversationResponse'
   ```
   Files affected:
   - `bui/src/utils/apiClient.utils.ts`
   
2. Required Changes:
   - Update return types to handle null responses
   - Add proper error handling for null cases
   - Consider using Option/Maybe pattern

## Interface Completeness
1. Missing Handler Methods:
   ```typescript
   Property 'clearError' does not exist on type 'ChatHandlers'
   ```
   - Add clearError to ChatHandlers interface
   - Implement missing handlers

2. Conversation Type Mismatches:
   ```typescript
   Type 'ConversationMetadata[]' is not assignable to type 'Conversation[]'
   ```
   - Align metadata and full conversation types
   - Add proper type transformations

## DOM and Browser APIs
1. Selection API Usage:
   ```typescript
   Cannot find name 'setSelection'. Did you mean 'getSelection'?
   ```
   - Use correct DOM API methods
   - Add proper type definitions
   - Consider abstracting selection handling

## Next Steps
1. Handle each category in separate tasks
2. Prioritize based on:
   - Impact on type safety
   - Frequency of issues
   - Complexity of fixes
3. Start with CollaborationLogDataEntry type union as it affects multiple components
4. Follow with API response safety as it's critical for reliability
5. Handle formatting issues last as they're more isolated

## Notes
- Keep changes minimal and focused
- Add tests for type narrowing functions
- Document type union decisions
- Consider adding runtime type checks where needed