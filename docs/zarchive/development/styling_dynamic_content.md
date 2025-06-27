# Styling Dynamically Generated Content

## Challenge

BB generates HTML content in several places:
1. Log entry formatting in the API (`api/src/logEntries/formatters.browser.tsx`)
2. Tool tag generation (`api/src/llms/llmToolTags.tsx`)
3. Individual tool formatters (`api/src/llms/tools/*.tool/formatter.browser.tsx`)

This presents challenges with Tailwind CSS:
- Content is generated at runtime by the API
- Some tools are loaded dynamically
- Tailwind's JIT compiler only processes files it knows about at build time
- Utility classes used in API-generated HTML might not be included in the final CSS

## Current Solutions

### 1. Tool Formatting Patterns

Current tools use a combination of approaches for styling, as seen in the runCommand tool:

```typescript
// 1. Predefined components with built-in styles
LLMTool.TOOL_TAGS_BROWSER.base.container(
  <>
    {LLMTool.TOOL_TAGS_BROWSER.base.label('Command:')}
    {LLMTool.TOOL_TAGS_BROWSER.base.code(command)}
  </>
);

// 2. Predefined style combinations
`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`

// 3. Direct utility class usage
<span className={code === 0 ? 'text-green-600' : 'text-red-600'}>
```

This approach works well for static tools but presents challenges for dynamic tools.

### 2. Tailwind Configuration
Add API formatting files to Tailwind's content configuration:
```js
// bui/src/tailwind.config.ts
{
  content: [
    '{routes,islands,components}/**/*.{ts,tsx}',
    // API formatters that generate HTML with Tailwind classes
    '../../api/src/logEntries/formatters.browser.tsx',
    '../../api/src/llms/llmToolTags.tsx',
    '../../api/src/llms/tools/*.tool/formatter.browser.tsx'
  ]
}
```

### 2. Predefined Components
- Use `TOOL_TAGS_BROWSER` from `llmToolTags.tsx`
- Provides consistent styling through predefined components
- Encapsulates commonly used utility combinations
- Reduces need for direct utility class usage

### 3. Semantic Classes
Define semantic classes for common patterns:
```css
.bb-tool-use { @apply p-4 rounded-lg border bg-white; }
.bb-tool-result { @apply p-4 rounded-lg border bg-white; }
.bb-metrics-section { @apply mt-4 first:mt-0; }
```

## Runtime CSS-in-JS Solution

For cases where static configuration isn't sufficient (like dynamically loaded tools), a runtime CSS-in-JS solution could be implemented:

### 1. Implementation with Twind

```typescript
import { twind } from '@twind/core'

// Initialize with Tailwind config
const tw = twind({
  theme: {
    extend: {
      // Match your Tailwind config
    }
  }
})

// Style manager for dynamic tools
class DynamicStyleManager {
  private styleCache = new Map<string, string>();

  generateStyles(toolName: string, utilityClasses: string[]): string {
    const cacheKey = `${toolName}:${utilityClasses.join('_')}`;
    
    if (!this.styleCache.has(cacheKey)) {
      const className = tw(utilityClasses.join(' '));
      this.styleCache.set(cacheKey, className);
    }
    
    return this.styleCache.get(cacheKey)!;
  }
}

// Usage in dynamic tool formatter
export function formatToolContent(content: string, styleManager: DynamicStyleManager): string {
  const className = styleManager.generateStyles('customTool', [
    'bg-blue-500',
    'rounded-lg',
    'p-4'
  ]);
  return `<div class="${className}">${content}</div>`;
}
```

### 2. Integration with Dynamic Tools

```typescript
interface DynamicTool {
  name: string;
  formatter: {
    browser: {
      styles: string[];  // Required utility classes
      generate: (content: unknown, styleManager: DynamicStyleManager) => string;
    };
  };
}

// When loading a dynamic tool
const styleManager = new DynamicStyleManager();
const tool = await loadDynamicTool('customTool');

if (tool.formatter.browser.styles.length > 0) {
  // Pre-generate styles for better performance
  styleManager.generateStyles(tool.name, tool.formatter.browser.styles);
}
```

### 3. Performance Optimizations

```typescript
// Batch style processing
class BatchStyleManager extends DynamicStyleManager {
  private pendingStyles = new Set<string>();
  private processingScheduled = false;

  queueStyles(toolName: string, styles: string[]): void {
    styles.forEach(style => this.pendingStyles.add(style));
    
    if (!this.processingScheduled) {
      this.processingScheduled = true;
      requestAnimationFrame(() => this.processQueue());
    }
  }

  private processQueue(): void {
    const styles = Array.from(this.pendingStyles);
    this.generateStyles('batch', styles);
    this.pendingStyles.clear();
    this.processingScheduled = false;
  }
}
```

### 4. Benefits

- Works with dynamically loaded tools
- No build-time configuration needed
- Supports all Tailwind utilities
- Can be scoped to specific tools
- Styles can be generated based on tool configuration
- Supports theme customization
- Can be cached for performance

### 5. Drawbacks

- Additional runtime overhead
- Larger bundle size
- Potential flash of unstyled content
- More complex setup and maintenance
- Need to manage style injection
- Possible performance impact with many dynamic tools

### 6. Example: Dynamic Tool Implementation

#### Current Approach
```typescript
// dynamicTool/formatter.browser.tsx
export const formatLogEntryToolResult = (
  resultContent: CollaborationLogEntryContentToolResult
): LLMToolLogEntryFormattedResult => {
  // Styles must be included in Tailwind config or they won't work
  const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
    <>
      <div className="bg-purple-100 rounded-lg p-4"> {/* May not work if not in config */}
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Dynamic Content')}
      </div>
    </>
  );

  return {
    title: LLMTool.TOOL_TAGS_BROWSER.content.title('Dynamic Tool'),
    content,
    preview: 'Dynamic content'
  };
};
```

#### With Runtime CSS-in-JS
```typescript
// dynamicTool/formatter.browser.tsx
export const formatLogEntryToolResult = (
  resultContent: CollaborationLogEntryContentToolResult,
  styleManager: DynamicStyleManager
): LLMToolLogEntryFormattedResult => {
  // Styles are generated at runtime
  const dynamicClass = styleManager.generateStyles('dynamicTool', [
    'bg-purple-100',
    'rounded-lg',
    'p-4'
  ]);

  const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
    <>
      <div className={dynamicClass}>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Dynamic Content')}
      </div>
    </>
  );

  return {
    title: LLMTool.TOOL_TAGS_BROWSER.content.title('Dynamic Tool'),
    content,
    preview: 'Dynamic content'
  };
};
```

This example shows how the runtime solution provides more flexibility for dynamic tools while maintaining compatibility with existing components.

### 7. Usage Guidelines

1. Prefer static solutions when possible:
   - Use predefined components from TOOL_TAGS_BROWSER
   - Add commonly used styles to Tailwind config
   - Create semantic classes for repeated patterns

2. Use runtime CSS-in-JS for:
   - Dynamically loaded tools
   - User-configurable styling
   - Complex conditional styles
   - Theme-dependent styles

3. Performance considerations:
   - Cache generated styles
   - Batch style injections
   - Lazy load tool-specific styles
   - Monitor runtime performance
   - Clean up unused styles

### 8. Testing Considerations

1. Unit Testing:
```typescript
// Test style generation
describe('DynamicStyleManager', () => {
  it('should generate consistent class names', () => {
    const manager = new DynamicStyleManager();
    const class1 = manager.generateStyles('tool', ['bg-blue-500']);
    const class2 = manager.generateStyles('tool', ['bg-blue-500']);
    expect(class1).toBe(class2);
  });

  it('should handle multiple utility classes', () => {
    const manager = new DynamicStyleManager();
    const className = manager.generateStyles('tool', [
      'bg-blue-500',
      'rounded-lg',
      'p-4'
    ]);
    expect(className).toContain('bg-blue-500');
  });
});
```

2. Integration Testing:
```typescript
// Test tool formatting with styles
describe('DynamicTool Formatter', () => {
  it('should generate valid HTML with styles', () => {
    const manager = new DynamicStyleManager();
    const result = formatToolContent('test', manager);
    expect(result).toContain('class=');
    expect(result).toContain('bg-blue-500');
  });
});
```

3. Visual Testing:
- Use screenshot testing for style verification
- Test in both light and dark modes
- Verify dynamic style changes
- Test style transitions and animations

4. Performance Testing:
- Measure style generation time
- Monitor memory usage with many dynamic styles
- Test style cleanup and garbage collection
- Verify caching effectiveness

## Recommendations

1. Structural Changes:
- Move all HTML generation to dedicated formatter files
- Keep these files in sync with Tailwind config
- Use semantic class names where possible
- Document required utility classes

2. For Dynamic Tools:
- Prefer predefined components from `TOOL_TAGS_BROWSER`
- Use semantic classes for common patterns
- Consider runtime CSS-in-JS only if needed
- Document any new utility patterns

3. Maintenance:
- Update Tailwind config when adding new formatters
- Review and consolidate utility patterns
- Monitor CSS bundle size
- Consider splitting CSS by feature

## Required Actions

When adding new formatters or tools:
1. Add new formatter files to Tailwind content config
2. Use existing TOOL_TAGS_BROWSER components when possible
3. Document any new utility classes needed
4. Consider impact on CSS bundle size
5. Test generated HTML styling in both light and dark modes