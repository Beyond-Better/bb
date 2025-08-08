# Notion BlockEdit Tool - Integration Example

This document demonstrates a complete workflow of using the `blockEdit` tool with Notion data sources to edit document blocks using Portable Text operations.

## Overview

The `blockEdit` tool allows you to programmatically edit structured document content in Notion pages by applying Portable Text operations. It supports four main operations:

- **Update**: Modify existing blocks
- **Insert**: Add new blocks at specific positions
- **Delete**: Remove blocks from the document
- **Move**: Reorder blocks within the document

## Prerequisites

1. Notion data source configured and connected
2. Access to a Notion page or document
3. BB tool with `blockEdit` capability enabled

## Complete Workflow Example

### Step 1: Load and Inspect Notion Page

First, load the Notion page to see its current structure:

```typescript
// Load a Notion page to see its structure
await load_resources({
  mode: 'template',
  uriTemplate: 'notion://{resourcePath}',
  templateResources: [
    { resourcePath: 'page/abc123-your-page-id' }
  ]
});
```

This will return the page content in Portable Text format, which might look like:

```json
[
  {
    "_type": "block",
    "_key": "block-1",
    "style": "h1",
    "children": [
      {
        "_type": "span",
        "_key": "span-1",
        "text": "Project Overview",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "_key": "block-2",
    "style": "normal",
    "children": [
      {
        "_type": "span",
        "_key": "span-2",
        "text": "This document outlines the key objectives and deliverables for our upcoming project.",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "_key": "block-3",
    "style": "normal",
    "children": [
      {
        "_type": "span",
        "_key": "span-3",
        "text": "We need to complete the following tasks:",
        "marks": []
      }
    ]
  }
]
```

### Step 2: Update Existing Content

Update the heading to be more specific:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'update',
      index: 0,
      content: {
        _type: 'block',
        _key: 'block-1',
        style: 'h1',
        children: [
          {
            _type: 'span',
            _key: 'span-1-updated',
            text: 'Q4 2024 Project Overview',
            marks: ['strong']
          }
        ]
      }
    }
  ]
});
```

**Expected Result:**
```
✅ Operation 1 (update): Updated block at index 0
Block edit operations applied to resource: page/abc123-your-page-id. All operations succeeded. 1/1 operations succeeded.
```

### Step 3: Insert New Content

Add a new section with a subheading and bullet points:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'insert',
      position: 3,
      block: {
        _type: 'block',
        _key: 'block-new-heading',
        style: 'h2',
        children: [
          {
            _type: 'span',
            _key: 'span-new-heading',
            text: 'Key Deliverables',
            marks: []
          }
        ]
      }
    },
    {
      type: 'insert',
      position: 4,
      block: {
        _type: 'block',
        _key: 'block-bullet-1',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        children: [
          {
            _type: 'span',
            _key: 'span-bullet-1',
            text: 'Complete system architecture design',
            marks: []
          }
        ]
      }
    },
    {
      type: 'insert',
      position: 5,
      block: {
        _type: 'block',
        _key: 'block-bullet-2',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        children: [
          {
            _type: 'span',
            _key: 'span-bullet-2',
            text: 'Implement core functionality',
            marks: []
          }
        ]
      }
    }
  ]
});
```

**Expected Result:**
```
✅ Operation 1 (insert): Inserted block at position 3
✅ Operation 2 (insert): Inserted block at position 4
✅ Operation 3 (insert): Inserted block at position 5
Block edit operations applied to resource: page/abc123-your-page-id. All operations succeeded. 3/3 operations succeeded.
```

### Step 4: Move Content

Reorder sections by moving a block:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'move',
      from: 2,
      to: 5
    }
  ]
});
```

**Expected Result:**
```
✅ Operation 1 (move): Moved block from index 2 to 4
Block edit operations applied to resource: page/abc123-your-page-id. All operations succeeded. 1/1 operations succeeded.
```

### Step 5: Delete Unwanted Content

Remove a block that's no longer needed:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'delete',
      index: 1
    }
  ]
});
```

**Expected Result:**
```
✅ Operation 1 (delete): Deleted block at index 1
Block edit operations applied to resource: page/abc123-your-page-id. All operations succeeded. 1/1 operations succeeded.
```

## Advanced Examples

### Working with Block Keys

Instead of using indices, you can target blocks by their `_key` property:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'update',
      _key: 'block-specific-key',
      content: {
        _type: 'block',
        _key: 'block-specific-key',
        style: 'blockquote',
        children: [
          {
            _type: 'span',
            _key: 'span-quote',
            text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
            marks: ['em']
          }
        ]
      }
    }
  ]
});
```

### Complex Formatting

Create richly formatted content with multiple text spans:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'insert',
      position: 0,
      block: {
        _type: 'block',
        _key: 'block-rich-format',
        style: 'normal',
        children: [
          {
            _type: 'span',
            _key: 'span-normal',
            text: 'This project will be completed by ',
            marks: []
          },
          {
            _type: 'span',
            _key: 'span-bold',
            text: 'December 31, 2024',
            marks: ['strong']
          },
          {
            _type: 'span',
            _key: 'span-normal-2',
            text: ' and will require ',
            marks: []
          },
          {
            _type: 'span',
            _key: 'span-code',
            text: 'significant resources',
            marks: ['code']
          },
          {
            _type: 'span',
            _key: 'span-normal-3',
            text: ' to complete successfully.',
            marks: []
          }
        ]
      }
    }
  ]
});
```

### Adding Code Blocks

Insert a code block with syntax highlighting:

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'insert',
      position: 2,
      block: {
        _type: 'code',
        _key: 'code-block-example',
        language: 'typescript',
        code: `// Example TypeScript function
function calculateProjectCost(hours: number, rate: number): number {
  return hours * rate;
}

const totalCost = calculateProjectCost(120, 85);
console.log(\`Total project cost: $\${totalCost}\`);`
      }
    }
  ]
});
```

## Error Handling Examples

### Invalid Operation Example

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'update',
      index: 999, // Invalid index
      content: {
        _type: 'block',
        _key: 'invalid-block',
        style: 'normal',
        children: []
      }
    }
  ]
});
```

**Expected Result:**
```
❌ Operation 1 (update): Block not found for update operation
Block edit operations applied to resource: page/abc123-your-page-id. All operations failed. 0/1 operations succeeded.
```

### Mixed Success and Failure

```typescript
await blockEdit({
  dataSourceId: 'notion-work',
  resourcePath: 'page/abc123-your-page-id',
  operations: [
    {
      type: 'update',
      index: 0,
      content: {
        _type: 'block',
        _key: 'valid-update',
        style: 'h1',
        children: [
          {
            _type: 'span',
            _key: 'span-valid',
            text: 'Valid Update',
            marks: []
          }
        ]
      }
    },
    {
      type: 'delete',
      index: 999 // Invalid index
    },
    {
      type: 'insert',
      position: 1,
      block: {
        _type: 'block',
        _key: 'valid-insert',
        style: 'normal',
        children: [
          {
            _type: 'span',
            _key: 'span-insert',
            text: 'Valid insertion',
            marks: []
          }
        ]
      }
    }
  ]
});
```

**Expected Result:**
```
✅ Operation 1 (update): Updated block at index 0
❌ Operation 2 (delete): Block not found for delete operation
✅ Operation 3 (insert): Inserted block at position 1
Block edit operations applied to resource: page/abc123-your-page-id. Partial operations succeeded. 2/3 operations succeeded.
```

## Supported Block Types

The `blockEdit` tool supports various Portable Text block types commonly used in Notion:

### Basic Text Blocks
- `block` with `style: "normal"` - Regular paragraph
- `block` with `style: "h1"`, `"h2"`, `"h3"` - Headings
- `block` with `style: "blockquote"` - Quote blocks

### List Blocks
- `block` with `listItem: "bullet"` - Bullet points
- `block` with `listItem: "number"` - Numbered lists
- Use `level` property for nested lists

### Special Blocks
- `code` blocks with `language` property
- `divider` blocks for horizontal rules
- `image` blocks with `asset` references

### Text Formatting Marks
- `strong` - Bold text
- `em` - Italic text
- `code` - Inline code
- `underline` - Underlined text
- `strike` - Strikethrough text

## Best Practices

1. **Always inspect first**: Load the resource to understand its current structure before making changes.

2. **Use meaningful keys**: Generate unique `_key` values for all new blocks and spans.

3. **Batch operations**: Combine related operations in a single call for better performance.

4. **Handle errors gracefully**: Check operation results and handle partial failures appropriately.

5. **Preserve structure**: Maintain the document's logical structure when inserting or moving blocks.

6. **Test operations**: Use the test script to validate operations before applying them to important documents.

## Troubleshooting

### Common Issues

1. **"Data source does not support block editing"**
   - Ensure you're using a Notion data source
   - Verify the data source has `blockEdit` capability

2. **"Block not found for operation"**
   - Check that the index or `_key` exists in the current document
   - Remember that indices change after insert/delete operations

3. **"Access denied: resource is outside the data source"**
   - Verify the resource path is correct and within the configured data source

4. **"Invalid insert position"**
   - Ensure insert positions are within valid range (0 to document length)

### Debugging Tips

1. Load the resource first to see current structure
2. Use the browser formatter for better visualization
3. Check the operation results for detailed error messages
4. Start with simple operations before attempting complex batch updates

## Conclusion

The `blockEdit` tool provides powerful capabilities for programmatically editing Notion documents using Portable Text operations. By following the patterns and examples in this guide, you can effectively automate document editing workflows while maintaining document structure and formatting.