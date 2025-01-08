# Auto-Complete File Suggestions

BB provides an intelligent file suggestion system to help you quickly and accurately reference project files in your conversations. This guide explains how to use this feature effectively.

## Triggering Suggestions

There are two ways to trigger the file suggestion system:

### 1. Slash Trigger (/)

The slash trigger is intuitive and works like many file browsers:

```
Type: /
Shows: Root directory contents

Type: /src/
Shows: Contents of src directory

Type: /src/comp
Shows: All items in src/ starting with "comp"
```

- Suggestions appear as soon as you type a forward slash
- Continue typing to refine the suggestions in real-time
- Works naturally for exploring directory structures
- Ideal when you're not sure of the exact file path

### 2. Tab Trigger

The tab key provides more flexible suggestion options:

```
Empty Input:
Press Tab -> Shows root directory contents

Partial Path:
Type: src
Press Tab -> Shows matches starting with "src"

Type: components/Button
Press Tab -> Shows matches containing "components/Button"
```

- Works with both empty input and partial paths
- Can trigger suggestions at any point in your typing
- Continues showing suggestions while you type to refine
- Particularly useful when you know part of the path

## Navigation and Selection

### Keyboard Controls

- **↑/↓ Arrow Keys**: Move through the suggestion list
- **Enter**: Select the highlighted suggestion
- **Tab**: 
  - First press: Show suggestions
  - Second press: Select first suggestion (if multiple)
  - Third press: Cycle through suggestions
- **Escape**: Close the suggestion list

### Suggestion Details

Each suggestion in the list shows:
```
ExampleFile.ts (src/components)
```
- Main part: File or directory name
- Parentheses: Parent directory path
- Trailing slash: Indicates directories (`components/`)

## Advanced Features

### Wildcard Patterns

Use asterisk (`*`) as a wildcard to match any characters:

```
Basic Patterns:
*.ts         -> All TypeScript files in current directory
test/*       -> All files in test directory
*test*       -> All files containing "test" in the name

Directory Patterns:
src/**/*.tsx    -> All TSX files in src and its subdirectories
**/*test.ts     -> All TypeScript test files at any depth
components/**/  -> All subdirectories under components

Multiple Patterns:
*.ts|*.tsx      -> All TypeScript and TSX files
src/*|test/*    -> Files in either src or test directories
```

### Directory Navigation

- Directories are indicated with a trailing slash (`/`)
- Can select directories to complete paths:
  ```
  1. Type: src/
  2. Select components/
  3. Results in: src/components/
  ```
- Use Tab completion to quickly navigate deep structures:
  ```
  1. Type: s
  2. Tab -> selects src/
  3. Type: c
  4. Tab -> selects components/
  5. Continue building path
  ```

## Best Practices

### 1. Multiple File References

When referencing multiple files, list them on separate lines:

```
I want to review these files:
- /src/components/Button.tsx
- /src/components/Input.tsx
- /src/styles/components.css
```

Benefits:
- Easier for BB to parse
- Clearer for reviewing
- Simpler to edit or remove entries
- Better conversation formatting

### 2. Efficient Path Navigation

Combine techniques for faster navigation:
```
1. Use Tab for quick directory completion:
   comp<Tab> -> completes to components/

2. Use wildcards for filtering:
   components/*.tsx -> shows all TSX files

3. Use partial paths with Tab:
   but<Tab> -> finds Button.tsx in current context
```

### 3. Search Strategies

Choose the best approach for your situation:

1. **Known Path**: Use Tab completion
   ```
   comp<Tab>/but<Tab>
   -> components/Button.tsx
   ```

2. **Browsing**: Use slash trigger
   ```
   /src/
   Then browse the list
   ```

3. **Pattern Matching**: Use wildcards
   ```
   **/*test.ts
   Finds all TypeScript test files
   ```

4. **Partial Knowledge**: Combine approaches
   ```
   src/*/button*
   Finds button-related files in src subdirectories
   ```

### 4. Context Awareness

- BB maintains awareness of the current directory context
- Suggestions are relative to:
  - Project root
  - Current directory in conversation
  - Recently referenced directories

### 5. Performance Tips

- Be specific in your patterns to reduce result sets
- Use directory prefixes to narrow scope
- Combine wildcards with partial paths
- Use Tab completion for known paths
- Close suggestion list with Escape if not needed

## Common Issues and Solutions

1. **Too Many Results**
   - Add more specific path prefixes
   - Use more specific patterns
   - Navigate into subdirectories first

2. **No Matches Found**
   - Check path spelling
   - Try broader patterns
   - Use Tab to verify directory names
   - Check if mixing forward/backward slashes

3. **Unexpected Matches**
   - Review wildcard patterns
   - Check current directory context
   - Verify path is relative to project root

4. **Performance Issues**
   - Avoid overly broad patterns (`**/*`)
   - Specify directory paths when possible
   - Use more specific search terms

## Examples of Common Tasks

### Finding Test Files
```
# All test files
**/*.test.ts

# Component tests
src/components/**/*.test.tsx

# Specific feature tests
**/auth/*.test.ts
```

### Working with Related Files
```
# Component and its test
src/components/Button.tsx
src/components/Button.test.tsx

# Style files
src/styles/components/
**/*.css
```

### Project Configuration
```
# Config files
*.config.ts
*rc.json

# Package files
package.json
package-lock.json
```

### Documentation
```
# Markdown files
docs/**/*.md

# API documentation
api/docs/
**/README.md
```