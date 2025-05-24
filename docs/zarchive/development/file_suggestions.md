# File Suggestions Implementation

This document outlines the design and implementation plan for the file suggestions feature in BB. The feature provides autocomplete functionality for file paths in the chat interface.

## Requirements

### Autocomplete Triggers and Behavior

1. **Trigger Methods**:
   - Typing slash (`/` or `\`): Start matching from project root
   - Pressing Tab: Use existing text or start from root
   - Note: Option+Tab used to cycle focus out of chat input

2. **Tab Behavior**:
   ```typescript
   const handleKeyDown = (e: KeyboardEvent) => {
     if (e.key === 'Tab') {
       e.preventDefault();
       if (!isShowingSuggestions) {
         // First tab: show suggestions
         const searchText = getSearchText(value, cursorPosition);
         triggerSuggestions(searchText || '/');
       } else if (suggestions.length === 1) {
         // Single match: apply and close
         applySuggestion(suggestions[0]);
       } else if (!selectedIndex) {
         // Second tab: select first item
         setSelectedIndex(0);
       } else {
         // Third tab: refresh suggestions
         const searchText = getSearchText(value, cursorPosition);
         triggerSuggestions(searchText || '/');
       }
     }
   };

   // Get text to search from, handling inline autocomplete
   const getSearchText = (text: string, pos: number): string => {
     const beforeCursor = text.slice(0, pos);
     const match = beforeCursor.match(/\S+$/);  // Match back to first space or start
     return match ? match[0] : '';
   };
   ```

3. **Inline Autocomplete**:
   ```typescript
   interface TextPosition {
     start: number;      // Start of text to replace
     end: number;        // End of text to replace
     beforeText: string; // Text before replacement
     afterText: string;  // Text after replacement
     isInline: boolean;  // True if cursor is not at end
   }

   const getTextPositions = (text: string, cursorPos: number): TextPosition => {
     const beforeCursor = text.slice(0, cursorPos);
     const afterCursor = text.slice(cursorPos);
     const match = beforeCursor.match(/\S*$/);

     if (!match) {
       return {
         start: cursorPos,
         end: cursorPos,
         beforeText: beforeCursor,
         afterText: afterCursor,
         isInline: cursorPos < text.length
       };
     }

     return {
       start: cursorPos - match[0].length,
       end: cursorPos,
       beforeText: text.slice(0, cursorPos - match[0].length),
       afterText: afterCursor,
       isInline: cursorPos < text.length
     };
   };

   const wrapPathInBackticks = (path: string, pos: TextPosition): string => {
     const wrappedPath = pos.isInline ? `\`${path}\`` : `\`${path}\``;
     
     // If on empty line, make it a list item
     if (pos.beforeText.trim() === '' && pos.afterText.trim() === '') {
       return `- ${wrappedPath}`;
     }

     return pos.beforeText + wrappedPath + pos.afterText;
   };
   ```

   Example scenarios:
   ```typescript
   // Scenario 1: Empty line
   "" -> "- `api/src/utils/`"

   // Scenario 2: End of line
   "Check the " -> "Check the `api/src/utils/`"

   // Scenario 3: Middle of line
   "Look in |, it's important"
   -> "Look in `api/src/utils/`, it's important"

   // Scenario 4: Replacing partial path
   "Look in api/sr|, it's important"
   -> "Look in `api/src/utils/`, it's important"
   ```
   - Works anywhere in text, not just at end
   - Preserves text after cursor
   - Example: "Look at api/src/u" -> "Look at `api/src/utils/` rest of text"
   - Always wraps inserted paths in backticks

4. **Tab Interaction States**:
   ```typescript
   enum TabState {
     INITIAL,       // No suggestions shown
     SUGGESTIONS,   // Suggestions shown, none selected
     SELECTED,      // First suggestion selected
     REFRESH        // Ready to refresh suggestions
   }

   const [tabState, setTabState] = useState(TabState.INITIAL);

   const handleTab = (e: KeyboardEvent) => {
     e.preventDefault();
     
     switch (tabState) {
       case TabState.INITIAL:
         // First tab press - show suggestions
         const searchText = getSearchText(value, cursorPosition);
         triggerSuggestions(searchText || '/');
         setTabState(TabState.SUGGESTIONS);
         break;

       case TabState.SUGGESTIONS:
         if (suggestions.length === 1) {
           // Single match - apply and close
           applySuggestion(suggestions[0]);
           setTabState(TabState.INITIAL);
         } else {
           // Multiple matches - select first
           setSelectedIndex(0);
           setTabState(TabState.SELECTED);
         }
         break;

       case TabState.SELECTED:
         // Third tab press - refresh suggestions
         const newSearchText = getSearchText(value, cursorPosition);
         triggerSuggestions(newSearchText || '/');
         setTabState(TabState.SUGGESTIONS);
         break;
     }
   };
   ```

5. **Input Handling and Pattern Updates**:
   ```typescript
   const handleInput = (e: Event) => {
     const target = e.target as HTMLTextAreaElement;
     const newValue = target.value;
     const newPosition = target.selectionStart;
     setCursorPosition(newPosition);

     // Check if we're in an active suggestion state
     if (isShowingSuggestions) {
       const searchText = getSearchText(newValue, newPosition);
       
       if (searchText.includes('*')) {
         // Switch to wildcard matching
         triggerSuggestions(searchText);
       } else if (searchText.includes('../') || searchText.includes('..\\')) {
         // Disable suggestions for relative paths
         setIsShowingSuggestions(false);
       } else {
         // Update suggestions with new search text
         triggerSuggestions(searchText);
       }
     }

     onChange(newValue);
   };

   const triggerSuggestions = async (searchText: string) => {
     // Reset selection state
     setSelectedIndex(-1);
     setTabState(TabState.SUGGESTIONS);

     if (!searchText) {
       // Empty search shows root directory contents
       searchText = '/';
     }

     try {
       const response = await apiClient.suggestFiles(searchText, projectId);
       if (!response) throw new Error('Failed to fetch suggestions');

       if (response.suggestions.length === 1) {
         // Auto-select single matches
         applySuggestion({
           path: response.suggestions[0].path,
           isDirectory: response.suggestions[0].isDirectory,
           display: basename(response.suggestions[0].path),
           parent: dirname(response.suggestions[0].path)
         });
         setIsShowingSuggestions(false);
       } else {
         processSuggestions(response);
         setIsShowingSuggestions(true);
       }
     } catch (error) {
       console.error('Error fetching suggestions:', error);
       setIsShowingSuggestions(false);
     }
   };
   ```

6. **Keyboard Navigation**:
   - Tab: Show suggestions -> Select first -> Refresh
   - Shift+Tab/Up Arrow: Move selection up
   - Down Arrow: Move selection down
   - Enter: Apply selected suggestion
   - Escape: Close suggestions

### Pattern Matching Rules

1. **Pattern Handling Utility** (`fileSuggestions.utils.ts`):
   ```typescript
   interface PatternOptions {
     caseSensitive?: boolean;
     type?: 'all' | 'file' | 'directory';
   }

   function createSuggestionPatterns(partialPath: string, options: PatternOptions = {}): RegExp[] {
     // Remove leading slash - it's just a trigger, not part of the pattern
     partialPath = partialPath.replace(/^\//, '');

     // Reject paths trying to escape project root
     if (partialPath.includes('../') || partialPath.includes('..\\')) {
       return [];
     }

     // Handle bare terms (no path separators or wildcards)
     if (!partialPath.includes('/') && !partialPath.includes('*')) {
       return [
         // Match directories that start with the pattern
         globToRegExp(`**/${partialPath}*/`, { extended: true, globstar: true }),
         // Match files under matching directories
         globToRegExp(`**/${partialPath}*/**/*`, { extended: true, globstar: true })
       ];
     }

     if (path.includes('/*/')) {
       // Convert lone /* to /**/* for depth matching
       path = path.replace('/*/g', '/**/*');
     }
     
     // Handle root-level and deep matches
     const patterns = [];
     if (!path.includes('**/')) {
       patterns.push(globToRegExp(path));
       patterns.push(globToRegExp(`**/${path}`));
     } else {
       patterns.push(globToRegExp(path));
     }
     return patterns;
   }
   ```

2. **Pattern Matching Examples**:

   a. **Directory Matches** (`/doc`):
   ```
   Input: "/doc" -> "doc" (after removing leading slash)
   Patterns generated:
   1. "**/*doc*/"           - Matches directories like "docs/"
   2. "**/*doc*/**/*"       - Matches files under matching directories

   Examples:
   ✓ docs/                  (matches pattern 1)
   ✓ docs/README.md         (matches pattern 2)
   ✓ api/docs/example.md    (matches pattern 2)
   ✓ src/docs/file.ts       (matches pattern 2)
   ✗ document.txt           (no match - not under a matching directory)
   ✗ docker-compose.yml     (no match - not under a matching directory)
   ```

   b. **Path Matches** (`/src/util`):
   ```
   Input: "/src/util" -> "src/util"
   Patterns:
   1. "**/src/util*/"       - Match directories
   2. "**/src/util*/**/*"   - Match contained files

   Examples:
   ✓ src/utils/            (directory match)
   ✓ src/utils/file.ts     (file under matching directory)
   ✓ api/src/utils/        (directory match at any depth)
   ✗ src/utilities/        (no match - must start with "util")
   ```


### Display Format

1. **Results Grouping**:
   ```
   utils/ (api/src/)              # Directory match with parent path
   fileHandling.utils.ts (api/src/utils/)   # File under matching directory
   error.utils.ts (api/src/utils/)          # File under matching directory
   ```

2. **Directory Indication**:
   - Add trailing slash for directory paths
   - When selecting a directory, append slash to input

### API Design

1. **Endpoint**: `POST /api/v1/files/suggest`

2. **Request**:
   ```typescript
   interface FileSuggestionsOptions {
     partialPath: string;    // The partial path or pattern to match
     projectId: string;       // Project ID
     limit?: number;         // default: 50
     caseSensitive?: boolean;  // default: false
     type?: 'all' | 'file' | 'directory';  // default: 'all'
   }
   ```

3. **Response**:
   ```typescript
   interface FileSuggestionsResponse {
     suggestions: Array<{
       path: string;         // Relative path from startDir
       isDirectory: boolean; // true if entry is a directory
       size?: number;       // File size in bytes (future use)
       modified?: string;   // ISO date string (future use)
     }>;
     hasMore: boolean;      // true if limit was reached
   }
   ```

4. **Implementation Flow**:
   ```typescript
   async function suggestFiles(options: FileSuggestionsOptions): Promise<FileSuggestionsResponse> {
     // 1. Get exclude patterns
     const excludeOptions = await getExcludeOptions(options.startDir);
     const excludePatterns = createExcludeRegexPatterns(excludeOptions);

     // 2. Create match patterns
     const matchPatterns = createSuggestionPatterns(options.partialPath);

     // 3. Configure walk options
     const walkOptions: WalkOptions = {
       match: matchPatterns,
       skip: excludePatterns,
       includeDirs: true,    // needed to match directory paths
       followSymlinks: false
     };

     // 4. Collect results
     const results = [];
     let reachedLimit = false;

     for await (const entry of walk(options.startDir, walkOptions)) {
       if (results.length >= options.limit) {
         reachedLimit = true;
         break;
       }
       results.push({
         path: relative(options.startDir, entry.path),
         isDirectory: entry.isDirectory
       });
     }

     return {
       suggestions: results,
       hasMore: reachedLimit
     };
   }
   ```

5. **Error Handling**:
   ```typescript
   // Handle common error cases
   if (!isPathWithinDataSource(startDir, partialPath)) {
     throw createError(ErrorType.FileHandling, 'Path outside project directory');
   }

   if (!await exists(startDir)) {
     throw createError(ErrorType.FileHandling, 'Start directory does not exist');
   }
   ```

1. **Endpoint**: `POST /api/v1/files/suggest`

2. **Request**:
   ```typescript
   interface FileSuggestionsOptions {
     partialPath: string;
     startDir: string;
     limit?: number;         // default: 50
     caseSensitive?: boolean;  // default: false
     type?: 'all' | 'file' | 'directory';  // default: 'all'
   }
   ```

3. **Response**:
   ```typescript
   interface FileSuggestionsResponse {
     suggestions: {
       path: string;
       isDirectory: boolean;
     }[];
     hasMore: boolean;  // true if limit was reached
   }
   ```

### Technical Decisions

1. **Result Collection Strategy**:
   - Decision: Use early exit with current results rather than a generator function
   - Rationale:
     * Simple to implement by breaking from walk loop when limit reached
     * Maintains clear control flow and error handling
     * Allows collecting results in standard array
     * Easy to add hasMore flag based on early exit

2. **Pattern Handling Utilities**:
   - Decision: Create new `fileSuggestions.utils.ts` instead of extending fileHandling.utils.ts
   - Rationale:
     * Keeps suggestion-specific logic separate from tool-focused utilities
     * Allows optimization for interactive use case
     * Reuses core functions from fileHandling.utils.ts where appropriate
     * Easier to modify suggestion behavior without affecting tools

3. **Directory Content Strategy**:
   - Decision: Include directory contents in initial walk
   - Rationale:
     * Simpler implementation for first version
     * Reduces number of file system operations
     * May be optimized later for directory-first results
     * Maintains consistent ordering with walk results

4. **Project Ignore Patterns**:
   - Implementation:
     * Use `getExcludeOptions` from fileHandling.utils.ts to read ignore files
     * Apply `createExcludeRegexPatterns` to generate WalkOptions skip patterns
     * Respect .gitignore, tags.ignore, and .bb/ignore files
     * Maintain consistency with other file operations

### Implementation Details

1. **Pattern Handling**:
   - Create new utility file for suggestion-specific pattern functions
   - Import and use exclude pattern functions from fileHandling.utils.ts
   - Support glob patterns in user input, convert to regex for WalkOptions

2. **File Walking**:
   - Use @std/fs WalkOptions for efficient file system traversal
   - Respect project's ignore files (tags.ignore, .gitignore, etc.)
   - Exit early when reaching result limit
   - Include files from matching directories in same walk

3. **UI Component Updates**:
   - Group results by type (files vs directories)
   - Display filename with parent directory path
   - Handle keyboard navigation
   - Format selected paths based on context (list item vs inline)

## Implementation Plan

1. **API Changes**:
   - Create new utility file `api/src/utils/fileSuggestions.utils.ts`
   - Add pattern conversion functions
   - Implement new endpoint in `api/src/routes/api/file.handlers.ts`
   - Add tests for pattern matching and response format

2. **File Walking**:
   - Use WalkOptions for efficient traversal
   - Implement early exit when limit reached
   - Ensure proper handling of ignore patterns
   - Add tests for file system operations

3. **UI Implementation Details**:

   a. **ChatInput Component State**:
   ```typescript
   interface DisplaySuggestion {
     path: string;         // Full relative path
     display: string;      // Filename or directory name
     parent: string;       // Parent directory path
     isDirectory: boolean; // For display formatting
   }

   const [suggestions, setSuggestions] = useState<DisplaySuggestion[]>([]);
   const [isShowingSuggestions, setIsShowingSuggestions] = useState(false);
   const [selectedIndex, setSelectedIndex] = useState(-1);
   ```

   b. **Suggestion Processing**:
   ```typescript
   const processSuggestions = (response: FileSuggestionsResponse) => {
     const processed = response.suggestions.map(suggestion => ({
       path: suggestion.path,
       display: suggestion.isDirectory 
         ? basename(suggestion.path) + '/'
         : basename(suggestion.path),
       parent: dirname(suggestion.path),
       isDirectory: suggestion.isDirectory
     }));

     // Sort: directories first, then files
     return processed.sort((a, b) => {
       if (a.isDirectory !== b.isDirectory) {
         return a.isDirectory ? -1 : 1;
       }
       return a.path.localeCompare(b.path);
     });
   };
   ```

   c. **Display Formatting**:
   ```tsx
   {suggestions.map((suggestion, index) => (
     <li
       key={suggestion.path}
       role='option'
       aria-selected={index === selectedIndex}
       className={`cursor-pointer py-2 pl-3 pr-9 ${
         index === selectedIndex
           ? 'bg-blue-600 text-white'
           : 'text-gray-900 hover:bg-blue-600 hover:text-white'
       }`}
       onClick={() => applySuggestion(suggestion)}
     >
       <div className='flex items-center'>
         <span className='truncate'>
           {suggestion.display}
         </span>
         <span className={`ml-2 truncate text-sm ${
           index === selectedIndex ? 'text-blue-200' : 'text-gray-500'
         }`}>
           ({suggestion.parent})
         </span>
       </div>
     </li>
   ))}
   ```

   d. **Path Insertion**:
   ```typescript
   const applySuggestion = (suggestion: DisplaySuggestion) => {
     // Get text before and after cursor
     const beforeCursor = value.slice(0, cursorPosition);
     const afterCursor = value.slice(cursorPosition);

     // Find the text to replace
     const match = beforeCursor.match(/\S*$/);
     if (!match) return;

     const partialPath = match[0];
     const start = cursorPosition - partialPath.length;

     // Format based on context
     const formattedPath = isLineEmpty(value, cursorPosition)
       ? `- \`${suggestion.path}\``
       : `\`${suggestion.path}\``;

     // Preserve text after cursor
     const newText = value.slice(0, start) + formattedPath + afterCursor;

     const beforeCursor = value.slice(0, cursorPosition);
     const match = beforeCursor.match(/\S*$/);
     if (!match) return;

     const partialPath = match[0];
     const start = cursorPosition - partialPath.length;
     const end = cursorPosition;

     // Format based on context
     const formattedPath = isLineEmpty(value, cursorPosition)
       ? `- \`${suggestion.path}\``
       : `\`${suggestion.path}\``;

     const newText = value.slice(0, start) + formattedPath + value.slice(end);
     onChange(newText);
     setIsShowingSuggestions(false);
   };
   ```

## Implementation Phases

1. **Phase 1: Core Functionality**
   - Create fileSuggestions.utils.ts with basic pattern handling
   - Implement API endpoint with file walking and ignore patterns
   - Add basic UI implementation with file/directory display
   - Focus on correct pattern matching behavior

2. **Phase 2: UI Refinement**
   - Implement keyboard navigation
   - Add proper formatting for selected paths
   - Handle edge cases in pattern matching
   - Add basic error handling

3. **Phase 3: Performance & Polish**
   - Add result limit handling
   - Implement hasMore indicator
   - Add loading states
   - Improve error messages

4. **Phase 4: Testing & Documentation**
   - Add comprehensive test suite
   - Document pattern matching rules
   - Add examples to documentation
   - Create test fixtures

## Future Considerations

1. **User Settings**:
   - Case sensitivity toggle
   - Display format options (filename+parent vs full path)
   - Result limit configuration
   - Type filtering (files only, directories only)

2. **Performance Optimizations**:
   - Debounce API calls
   - Cache recent results
   - Progressive loading for directory contents

3. **UI Enhancements**:
   - Loading indicators
   - Error handling
   - Match highlighting
   - File type icons

## Key Implementation Decisions Summary

1. **API Implementation Strategy**:
   - Chose simple array collection over generator function
   - Early exit from walk loop when limit reached
   - Set hasMore flag based on early exit condition
   - Rationale: Simpler implementation, clear control flow, easier error handling

2. **Pattern Handling Architecture**:
   - Created new fileSuggestions.utils.ts instead of modifying fileHandling.utils.ts
   - Reuses core functions from fileHandling.utils.ts where appropriate
   - Rationale: Separates interactive suggestion logic from tool-focused utilities

3. **Directory Content Strategy**:
   - Single walk operation includes both directory matches and their contents
   - No separate walks for directory contents
   - Rationale: Simpler initial implementation, fewer file system operations

4. **Project Ignore Handling**:
   - Reuses getExcludeOptions and createExcludeRegexPatterns
   - Maintains consistency with other file operations
   - Respects all project ignore files (.gitignore, tags.ignore, .bb/ignore)

5. **Response Format**:
   - Returns flat array of results with isDirectory flag
   - Includes hasMore boolean for UI feedback
   - UI handles grouping and formatting
   - Rationale: Flexible format allows different UI presentations

## Testing Strategy

1. **API Tests**:
   - Pattern matching with various inputs
   - Directory traversal with limits
   - Ignore pattern handling
   - Response format validation

2. **UI Tests**:
   - Input handling and pattern detection
   - Result display formatting
   - Keyboard navigation
   - Path insertion in different contexts

3. **Integration Tests**:
   - End-to-end suggestion workflow
   - Error handling and recovery
   - Performance with large directory structures


## Implementation Status

### Completed

1. **Core Pattern Handling**:
   - ✓ Leading slash removal (used only as trigger)
   - ✓ Directory-specific pattern generation
   - ✓ File pattern generation for directory contents
   - ✓ Proper handling of absolute paths in walk
   - ✓ Integration with project exclude patterns

2. **API Implementation**:
   - ✓ Basic endpoint structure
   - ✓ File walking with pattern matching
   - ✓ Result limiting
   - ✓ Error handling

3. **UI Components**:
   - ✓ Basic suggestion display
   - ✓ Directory indication
   - ✓ Path formatting

### In Progress

1. **UI Refinement**:
   - Tab state management
   - Keyboard navigation
   - Loading states
   - Error display

2. **Pattern Handling**:
   - Wildcard pattern support
   - Complex path matching
   - Performance optimization
   - Case sensitivity options

### Pending

1. **Testing**:
   - Unit tests for pattern generation
   - Integration tests for API
   - UI component tests
   - End-to-end tests

2. **Documentation**:
   - API documentation
   - Pattern matching examples
   - UI component usage
   - Test coverage

3. **Future Enhancements**:
   - Case sensitivity options
   - Display format options
   - Result limit configuration
   - Progressive loading

### Lessons Learned

1. **Pattern Generation**:
   - Leading slash is a trigger, not part of pattern
   - Directory patterns need explicit trailing slash
   - File patterns should be tied to directories
   - Pattern specificity prevents false matches

2. **Performance**:
   - Single walk operation is efficient
   - Early exit reduces processing
   - Specific patterns reduce false matches
   - Exclude patterns are important

3. **UI Considerations**:
   - Tab state needs careful management
   - Loading states are important
   - Error handling must be clear
   - Directory vs file display matters