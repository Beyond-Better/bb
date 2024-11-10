# Rewrite File Tool Enhancement Plan

## Problem Statement

The `rewrite_file` tool is critical for file modifications, but there's a persistent issue where the AI sometimes attempts to use placeholder comments or partial content instead of providing the complete file content. This is particularly problematic because:

1. The tool completely replaces file contents, so any omitted content is permanently lost
2. Placeholder comments like "// Rest of file remains unchanged" result in data loss
3. This occurs despite clear instructions in the tool description
4. The issue appears in automated conversations where there's no human to catch the mistake
5. Current safeguards in the tool description aren't sufficient to prevent this behavior

## Current Tool Description

```
IMPORTANT:
- Must provide complete file content including ALL imports, types, and code
- Never use placeholder comments like "// Previous code remains..."
- Never assume code exists outside what is provided in content
- Cannot preserve any existing code that isn't explicitly included in content
- Will completely delete and replace the entire file
```

## Proposed Solution

Add two new required parameters to the tool to enforce complete content validation:

1. Explicit acknowledgment parameter
2. Expected line count parameter

### New Tool Interface

```typescript
interface RewriteFileParams {
  filePath: string;
  content: string;
  createIfMissing: boolean;
  acknowledgement: "I confirm this is the complete file content with no omissions or placeholders";
  expectedLineCount: number;  // Must match actual line count in content
}
```

### Validation Rules

1. The `acknowledgement` parameter:
   - Must be exactly the specified string
   - Cannot be omitted or modified
   - Forces explicit confirmation of completeness

2. The `expectedLineCount` parameter:
   - Must match the actual number of lines in the provided content
   - Provides a numerical validation of content completeness
   - Makes the AI explicitly count lines before submission

### Error Handling

The tool should:
1. Count newlines in the provided content
2. Compare against expectedLineCount
3. Verify the exact acknowledgement string
4. Reject the operation if either validation fails
5. Provide clear error messages indicating the mismatch

Example error messages:
```
Error: Content line count (150) does not match expectedLineCount (300)
Error: Invalid acknowledgement string. Must be exactly: "I confirm this is the complete file content with no omissions or placeholders"
```

## Implementation Plan

### Phase 1: Interface Update
1. Update tool schema to include new parameters
2. Make both parameters required
3. Update tool documentation
4. Update error type definitions

### Phase 2: Validation Implementation
1. Implement line counting function
2. Implement acknowledgement string validation
3. Add validation checks before file operations
4. Add error handling and messages

### Phase 3: Testing
1. Create test cases for:
   - Correct usage with matching line counts
   - Mismatched line counts
   - Invalid acknowledgement strings
   - Various file sizes and content types
2. Add tests for error conditions
3. Verify error messages

### Phase 4: Documentation
1. Update tool documentation with new parameters
2. Add examples of correct usage
3. Document error conditions and messages
4. Update any existing documentation referencing the tool

### Phase 5: Migration
1. Update existing tool uses in the codebase
2. Update automated processes using the tool
3. Add migration guide for manual tool usage

## Success Criteria

1. Zero instances of partial content submissions
2. Clear error messages for validation failures
3. No data loss from incomplete content
4. Successful validation in automated processes
5. Minimal impact on valid tool usage

## Timeline

1. Phase 1: 1 day
2. Phase 2: 2 days
3. Phase 3: 2 days
4. Phase 4: 1 day
5. Phase 5: 2 days

Total: 8 days

## Risks and Mitigation

### Risks
1. Impact on existing automation
2. Increased verbosity in tool usage
3. Line count mismatches from different line endings

### Mitigation
1. Comprehensive testing before deployment
2. Clear migration documentation
3. Normalize line endings in count function
4. Provide helper functions for line counting

## Future Enhancements

1. Add content hash validation
2. Add file size validation
3. Add content structure validation
4. Add automated line count calculation