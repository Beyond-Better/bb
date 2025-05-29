# Enhanced Search Implementation Guide

## 🎯 Project Overview

This document outlines the completion of the enhanced `findResources` tool that provides contextual content extraction for search results. The core implementation (Phases 1 & 2) is complete, with formatter updates and testing remaining.

## ✅ Completed Implementation (Phases 1 & 2)

### Current State
- **TypeScript validation**: ✅ All type errors resolved
- **Core functionality**: ✅ Content extraction with context implemented
- **Tool interface**: ✅ Enhanced input schema with context parameters
- **Backward compatibility**: ✅ Metadata-only searches unchanged

### Key Files Modified

1. **`api/src/utils/fileHandling.utils.ts`**
   - Enhanced `searchFilesContent()` function
   - New interfaces: `ContentMatch`, `ResourceMatch`, `ContentSearchResult`
   - Separate execution paths for content vs metadata searches
   - New `processFileWithContent()` function

2. **`api/src/llms/tools/findResources.tool/tool.ts`**
   - Updated input schema with `contextLines` and `maxMatchesPerFile`
   - Enhanced search options processing
   - Mode-aware result handling

3. **`api/src/llms/tools/findResources.tool/types.ts`**
   - Updated `LLMToolFindResourcesInput` interface

## 📊 Enhanced Data Structures

### New Interfaces

```typescript
interface ContentMatch {
  lineNumber: number;        // 1-based line numbers
  content: string;          // The matching line
  contextBefore: string[];  // Lines before the match
  contextAfter: string[];   // Lines after the match
  matchStart: number;       // Character position of match start
  matchEnd: number;         // Character position of match end
}

interface ResourceMatch {
  resourcePath: string;
  contentMatches?: ContentMatch[]; // Only present for content searches
}

interface ContentSearchResult {
  matches: ResourceMatch[];
  errorMessage: string | null;
}
```

### Search Modes

**Content Search Mode** (when `contentPattern` is provided):
- Returns `ResourceMatch[]` with `contentMatches` populated
- Includes line numbers, matching content, and surrounding context
- Configurable context lines and match limits

**Metadata Search Mode** (when only file patterns/dates/sizes provided):
- Returns `ResourceMatch[]` with only `resourcePath` 
- No content extraction (maintains performance)
- Uses existing caching mechanisms

### Enhanced Input Parameters

```typescript
interface LLMToolFindResourcesInput {
  // Existing parameters...
  dataSourceIds?: string[];
  contentPattern?: string;
  caseSensitive?: boolean;
  resourcePattern?: string;
  dateAfter?: string;
  dateBefore?: string;
  sizeMin?: number;
  sizeMax?: number;
  
  // NEW: Context parameters
  contextLines?: number;        // Default: 2, Range: 0-10
  maxMatchesPerFile?: number;   // Default: 5, Range: 1-20
}
```

## 🚧 Remaining Work (Phases 3 & 4)

### Phase 3: Formatter Updates

#### Files to Update:
1. `api/src/llms/tools/findResources.tool/formatter.browser.tsx`
2. `api/src/llms/tools/findResources.tool/formatter.console.ts`

#### Current Formatter Behavior
Both formatters currently expect simple resource lists and display them as basic file paths. They need enhancement to:

1. **Detect search mode** (content vs metadata)
2. **Display enhanced results** for content searches
3. **Maintain compatibility** for metadata searches

### Phase 4: Testing Updates

#### Files to Update:
1. `api/src/llms/tools/findResources.tool/tests/tool.test.ts`

#### Required Test Updates:
- Update existing tests for new return format
- Add tests for context extraction
- Test new input parameters
- Verify backward compatibility

## 📋 Detailed Formatter Specifications

### Browser Formatter (`formatter.browser.tsx`)

#### Current Implementation Analysis
The current browser formatter:
- Parses resource list from `<resources>` XML tags
- Displays simple file paths
- Uses `LLMTool.TOOL_TAGS_BROWSER.content.filename()` for styling

#### Enhanced Requirements

**For Content Searches:**
```typescript
// Expected enhanced display format
<div className="search-results">
  <div className="resource-match">
    <h4 className="resource-path">src/utils/helper.ts</h4>
    <div className="content-matches">
      <div className="match">
        <span className="line-number">42</span>
        <div className="context">
          <div className="context-before">// Helper function</div>
          <div className="match-line">export const <mark>searchFiles</mark> = () => {</div>
          <div className="context-after">  return results;</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Key Features Needed:**
- Syntax highlighting for code content
- Clear visual separation between matches
- Line number display
- Context indication (before/after)
- Match highlighting within lines
- Collapsible/expandable content sections

**Implementation Approach:**
```typescript
export const formatLogEntryToolResult = (
  resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
  const { toolResult, bbResponse } = resultContent;
  
  // Detect search mode by checking for enhanced content
  const hasContentMatches = /* detection logic */;
  
  if (hasContentMatches) {
    return formatEnhancedContentResults(toolResult, bbResponse);
  } else {
    return formatSimpleResourceList(toolResult, bbResponse);
  }
};
```

### Console Formatter (`formatter.console.ts`)

#### Current Implementation Analysis
The current console formatter:
- Uses `LLMTool.TOOL_STYLES_CONSOLE` for styling
- Displays simple file lists
- Creates basic text output

#### Enhanced Requirements

**For Content Searches:**
```
📁 src/utils/helper.ts
   42│ // Helper function
 → 43│ export const searchFiles = () => {
   44│   return results;
   
📁 src/components/Search.tsx  
   156│ const handleSearch = () => {
 → 157│   const files = searchFiles(pattern);
   158│   setResults(files);
```

**Key Features Needed:**
- Clear file path headers with icons
- Line numbers with alignment
- Match indication with arrows (→)
- Context indentation
- ANSI color coding for highlights
- Compact but readable format

**Implementation Approach:**
```typescript
export const formatLogEntryToolResult = (
  resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
  // Similar mode detection as browser formatter
  // Use TOOL_STYLES_CONSOLE for consistent styling
  // Generate text-based output with proper alignment
};
```

## 🔧 Implementation Details

### Mode Detection Logic

Both formatters need to detect whether results contain enhanced content:

```typescript
function detectSearchMode(toolResult: string): 'content' | 'metadata' {
  // Check if toolResult contains content matches
  // This could be done by:
  // 1. Parsing the toolResult structure
  // 2. Looking for content match indicators
  // 3. Checking result format patterns
  
  // Example detection:
  if (toolResult.includes('content matches') || 
      toolResult.includes('line number')) {
    return 'content';
  }
  return 'metadata';
}
```

### Result Parsing Strategy

The tool currently returns results in a specific format. Formatters need to:

1. **Parse the aggregated results** from multiple data sources
2. **Extract resource matches** with content if available
3. **Handle error messages** and status information
4. **Maintain data source prefixes** (`[local]`, `[notion]`, etc.)

### Backward Compatibility

Critical requirement: **All existing functionality must continue to work exactly as before** for:
- Metadata-only searches
- Existing test cases
- Current user workflows

## 🧪 Testing Strategy

### Test File Structure

The existing test file `tool.test.ts` has comprehensive coverage:
- Basic content search functionality
- Date-based search
- Resource-only search (metadata)
- Edge cases (empty files, large files)
- Complex regex patterns
- Multiple criteria combinations

### Required Test Updates

#### 1. Modify Existing Tests

Many existing tests need updates to handle the new return format:

```typescript
// BEFORE: Expected simple resource list
const expectedResources = ['file1.txt', 'file2.js'];
const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
const foundResources = resourceContent.split('\n');

// AFTER: Handle enhanced or simple format
if (isEnhancedFormat(toolResults)) {
  // Parse enhanced content matches
  const enhancedResults = parseEnhancedResults(toolResults);
  // Verify content matches, line numbers, context
} else {
  // Existing simple parsing logic
}
```

#### 2. Add New Test Cases

**Context Extraction Tests:**
```typescript
Deno.test({
  name: 'FindResourcesTool - Content search with context extraction',
  fn: async () => {
    // Test content pattern with contextLines parameter
    const toolUse: LLMAnswerToolUse = {
      toolInput: {
        contentPattern: 'function.*search',
        contextLines: 3,
        maxMatchesPerFile: 2
      }
    };
    
    const result = await tool.runTool(conversation, toolUse, projectEditor);
    
    // Verify enhanced results format
    // Check line numbers are correct
    // Verify context lines are included
    // Confirm match limits are respected
  }
});
```

**Parameter Validation Tests:**
```typescript
Deno.test({
  name: 'FindResourcesTool - Context parameter validation',
  fn: async () => {
    // Test contextLines bounds (0-10)
    // Test maxMatchesPerFile bounds (1-20)
    // Test parameter defaults
  }
});
```

**Backward Compatibility Tests:**
```typescript
Deno.test({
  name: 'FindResourcesTool - Backward compatibility for metadata search',
  fn: async () => {
    // Ensure existing metadata searches work unchanged
    // Verify no performance regression
    // Check output format consistency
  }
});
```

### Test Data Setup

The existing test setup functions need potential updates:

```typescript
async function createTestResourcesWithContent(testProjectRoot: string) {
  // Create files with specific patterns for context testing
  await Deno.writeTextFile(join(testProjectRoot, 'search-test.ts'), `
// This is a test file
function searchFiles(pattern: string) {
  // Implementation here
  return results;
}

export { searchFiles };
  `);
  
  // Create more test files with varying content patterns
}
```

## 📝 Implementation Checklist

### Phase 3: Formatter Updates

#### Browser Formatter
- [ ] Add mode detection logic
- [ ] Create enhanced content display components
- [ ] Implement syntax highlighting
- [ ] Add line number display
- [ ] Create context visualization
- [ ] Add match highlighting
- [ ] Ensure backward compatibility
- [ ] Test with various result formats

#### Console Formatter
- [ ] Add mode detection logic
- [ ] Create enhanced text formatting
- [ ] Implement ANSI color coding
- [ ] Add line number alignment
- [ ] Create context indentation
- [ ] Add match indicators
- [ ] Ensure backward compatibility
- [ ] Test output readability

### Phase 4: Testing Updates

#### Test Modifications
- [ ] Update result parsing in existing tests
- [ ] Modify assertion logic for new format
- [ ] Ensure all existing tests pass
- [ ] Add enhanced result validation

#### New Test Cases
- [ ] Context extraction functionality
- [ ] Parameter boundary testing
- [ ] Multiple match scenarios
- [ ] Large file handling
- [ ] Performance regression tests
- [ ] Backward compatibility validation

#### Test Infrastructure
- [ ] Update test data creation
- [ ] Add helper functions for result parsing
- [ ] Create mock data with specific patterns
- [ ] Add performance benchmarks

## 🚀 Success Criteria

### Functional Requirements
1. **Enhanced Search Results**: Content searches show matching lines with context
2. **Configurable Context**: Users can specify context lines (0-10) and max matches (1-20)
3. **Backward Compatibility**: All existing functionality works unchanged
4. **Performance**: No significant performance regression for metadata searches
5. **Error Handling**: Graceful handling of malformed patterns and large files

### User Experience Requirements
1. **Readable Output**: Both formatters provide clear, scannable results
2. **Syntax Highlighting**: Code content is properly highlighted (browser)
3. **Line Numbers**: Easy identification of match locations
4. **Context Clarity**: Clear distinction between matches and context
5. **Responsive Design**: Browser formatter works on various screen sizes

### Technical Requirements
1. **Type Safety**: All TypeScript checks pass
2. **Test Coverage**: All existing tests pass, new functionality covered
3. **Code Quality**: Consistent with existing codebase patterns
4. **Documentation**: Clear inline documentation for new features
5. **Performance**: Memory efficient for large result sets

## 💡 Implementation Tips

### Formatter Development
1. **Start with mode detection**: Implement reliable detection first
2. **Preserve existing paths**: Ensure metadata searches use existing code
3. **Incremental enhancement**: Add features gradually and test each
4. **Mobile-friendly**: Consider responsive design for browser formatter

### Testing Strategy
1. **Test existing first**: Ensure no regressions before adding new tests
2. **Use real patterns**: Test with actual regex patterns from usage
3. **Edge case focus**: Large files, many matches, complex patterns
4. **Performance baseline**: Measure current performance before changes

### Debug and Validation
1. **Visual verification**: Manually test formatter output
2. **Cross-platform testing**: Test on different operating systems
3. **Integration testing**: Test with actual BB workflows
4. **User feedback**: Consider usability of the enhanced output

This implementation will provide users with the exact enhancement requested: **seeing actual matching content with context before deciding to load full files**, significantly improving the search and discovery workflow in BB.
