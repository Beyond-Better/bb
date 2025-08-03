# Unified Content Tools: Implementation Plan

## Overview

This document provides the detailed implementation plan for consolidating BB's content editing tools into a unified, content-type-aware architecture. The plan includes new tool specifications, system changes, test requirements, and migration strategy.

## Tool Specifications

### 1. Create Resource Tool

**Location**: `api/src/llms/tools/createResource.tool/`
**Reference Tool**: Use `rewriteResource.tool` as the primary template

#### Tool Metadata (`info.json`)
```json
{
  "name": "create_resource",
  "version": "1.0.0",
  "description": "Create new resources with content-type-aware input handling",
  "author": "BB Core",
  "license": "MIT",
  "toolSets": ["core"],
  "enabled": true,
  "mutates": true,
  "category": ["file_management", "content_creation"],
  "capabilities": ["create", "write", "overwrite"]
}
```

#### Input Schema
```typescript
interface CreateResourceInput {
  dataSourceId?: string;
  resourcePath: string;
  overwriteExisting?: boolean; // Default: false
  createMissingDirectories?: boolean; // Default: true
  
  // Content type options (exactly one required)
  plainTextContent?: {
    content: string;
    expectedLineCount: number;
    allowEmptyContent?: boolean; // Default: false
  };
  
  structuredContent?: {
    blocks: PortableTextBlock[];
    acknowledgement: string; // Required for structured content
  };
  
  binaryContent?: {
    data: Uint8Array;
    mimeType: string;
  };
}

type PortableTextBlock = {
  _type: string;
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  children: PortableTextSpan[];
};

type PortableTextSpan = {
  _type: "span";
  _key?: string;
  text: string;
  marks?: string[];
};
```

#### Implementation Details
- **Validation**: Exactly one content type must be provided
- **Provider compatibility check**: Validate content type against datasource provider's accepted types
- **Accessor delegation**: Pass content to accessor, which handles content type internally
- **Error handling**: Clear error messages for incompatible content types

```typescript
class CreateResourceTool extends LLMTool {
  async runTool(interaction, toolUse, projectEditor): Promise<LLMToolRunResult> {
    const input = toolUse.toolInput as CreateResourceInput;
    
    // Get datasource provider and accessor
    const provider = await getDataSourceProvider(input.dataSourceId);
    const accessor = await getResourceAccessor(input.dataSourceId);
    
    // Validate exactly one content type
    const contentTypes = [input.plainTextContent, input.structuredContent, input.binaryContent]
      .filter(Boolean);
    if (contentTypes.length !== 1) {
      throw new Error("Exactly one content type must be provided");
    }
    
    // Validate content type against provider capabilities
    const providedContentType = input.plainTextContent ? 'plainTextContent' 
      : input.structuredContent ? 'structuredContent' 
      : 'binaryContent';
    
    if (!provider.acceptedContentTypes.includes(providedContentType)) {
      throw new Error(
        `Datasource ${provider.name} doesn't accept ${providedContentType}. ` +
        `Accepted types: ${provider.acceptedContentTypes.join(', ')}`
      );
    }
    
    // Delegate to accessor - accessor handles content type internally
    const result = await accessor.createResource(
      input.resourcePath, 
      contentTypes[0], // The actual content object
      {
        overwriteExisting: input.overwriteExisting,
        createMissingDirectories: input.createMissingDirectories
      }
    );
    
    return result;
  }
}
```

#### Expected Output
```typescript
interface CreateResourceResult {
  success: boolean;
  resourcePath: string;
  contentType: 'plain-text' | 'structured' | 'binary';
  size: number;
  lastModified: string;
  revision: string;
  datasourceUsed: string;
}
```

### 2. Edit Resource Tool

**Location**: `api/src/llms/tools/editResource.tool/`
**Reference Tools**: Combine patterns from `searchAndReplace.tool`, `blockEdit.tool`

#### Tool Metadata (`info.json`)
```json
{
  "name": "edit_resource", 
  "version": "1.0.0",
  "description": "Edit existing resources with multiple editing approaches and content-type awareness",
  "author": "BB Core",
  "license": "MIT",
  "toolSets": ["core"],
  "enabled": true,
  "mutates": true,
  "category": ["file_management", "content_editing"],
  "capabilities": ["edit", "search", "replace", "block_edit"]
}
```

#### Input Schema
```typescript
interface EditResourceInput {
  dataSourceId?: string;
  resourcePath: string;
  createIfMissing?: boolean; // Default: false
  
  // Editing approach options (exactly one required)
  searchAndReplaceEdits?: {
    operations: SearchReplaceOperation[];
    caseSensitive?: boolean; // Default: true
    regexPattern?: boolean; // Default: false
    replaceAll?: boolean; // Default: false
  };
  
  blockEdits?: {
    operations: PortableTextOperation[];
  };
  
  structuredDataEdits?: {
    operations: (RowOperation | ColumnOperation | CellOperation)[];
  };
}

interface SearchReplaceOperation {
  search: string;
  replace: string;
  caseSensitive?: boolean;
  regexPattern?: boolean;
  replaceAll?: boolean;
}

interface PortableTextOperation {
  operationType: "update" | "insert" | "delete" | "move";
  selector: {
    blockIndex?: number;
    blockKey?: string;
    path?: string;
    textMatch?: {
      pattern: string;
      matchType: "prefix" | "exact" | "contains" | "regex";
    };
  };
  value?: any;
  destination?: {
    beforeBlockKey?: string;
    afterBlockKey?: string;
    parentBlockKey?: string;
  };
}
```

#### Implementation Details
- **Provider compatibility check**: Validate edit approach against datasource provider's accepted types
- **Accessor delegation**: Pass edit operations to accessor, which handles content type internally
- **Operation validation**: Ensure operations are compatible with target content type
- **Transaction-like behavior**: All operations succeed or all fail (where possible)

```typescript
class EditResourceTool extends LLMTool {
  async runTool(interaction, toolUse, projectEditor): Promise<LLMToolRunResult> {
    const input = toolUse.toolInput as EditResourceInput;
    
    // Get datasource provider and accessor
    const provider = await getDataSourceProvider(input.dataSourceId);
    const accessor = await getResourceAccessor(input.dataSourceId);
    
    // Validate exactly one edit approach
    const editApproaches = [input.searchAndReplaceEdits, input.blockEdits, input.structuredDataEdits]
      .filter(Boolean);
    if (editApproaches.length !== 1) {
      throw new Error("Exactly one edit approach must be provided");
    }
    
    // Validate edit approach against provider capabilities
    const providedEditType = input.searchAndReplaceEdits ? 'searchAndReplaceEdits'
      : input.blockEdits ? 'blockEdits'
      : 'structuredDataEdits';
    
    if (!provider.acceptedEditTypes.includes(providedEditType)) {
      throw new Error(
        `Datasource ${provider.name} doesn't support ${providedEditType}. ` +
        `Supported types: ${provider.acceptedEditTypes.join(', ')}`
      );
    }
    
    // Delegate to accessor - accessor handles edit type internally
    const result = await accessor.editResource(
      input.resourcePath,
      editApproaches[0], // The actual edit operations
      {
        createIfMissing: input.createIfMissing
      }
    );
    
    return result;
  }
}
```

#### Expected Output
```typescript
interface EditResourceResult {
  success: boolean;
  resourcePath: string;
  editType: 'search-replace' | 'block-edit' | 'structured-data';
  operationsApplied: number;
  operationResults: OperationResult[];
  resourceUpdated: {
    lastModified: string;
    revision: string;
    size: number;
  };
}

interface OperationResult {
  operationIndex: number;
  status: 'success' | 'failed';
  details: {
    previousValue?: any;
    newValue?: any;
    errorMessage?: string;
  };
}
```

## System Changes

### 1. DataSource Provider Enhancements

**Enhancement**: Update datasource providers to declare accepted content types and edit approaches.

#### Enhanced Provider Interface
```typescript
interface DataSourceProvider {
  // Existing fields...
  
  // New: Content type capabilities
  acceptedContentTypes: ('plainTextContent' | 'structuredContent' | 'binaryContent')[];
  acceptedEditTypes: ('searchAndReplaceEdits' | 'blockEdits' | 'structuredDataEdits')[];
  preferredContentType: 'plainTextContent' | 'structuredContent' | 'binaryContent';
  
  // Content type guidance for LLM
  getContentTypeGuidance(): ContentTypeGuidance;
}

interface ContentTypeGuidance {
  primaryContentType: 'plain-text' | 'structured' | 'binary' | 'database';
  acceptedContentTypes: string[];
  acceptedEditTypes: string[];  
  examples: {
    description: string;
    toolCall: any;
  }[];
}
```

### 2. Load Datasource Tool Enhancement

**Enhancement**: Include provider content type guidance in `load_datasource` results.

#### Modified Output
```typescript
interface DataSourceMetadata {
  // Existing fields...
  
  // New: Content type guidance from provider
  contentTypeGuidance?: ContentTypeGuidance;
}
```

#### Provider Implementations
```typescript
// Filesystem Provider - Accepts plain text, can handle basic structured conversion
class FilesystemProvider extends BBDataSourceProvider {
  acceptedContentTypes = ['plainTextContent', 'binaryContent'];
  acceptedEditTypes = ['searchAndReplaceEdits'];
  preferredContentType = 'plainTextContent';
  
  getContentTypeGuidance(): ContentTypeGuidance {
    return {
      primaryContentType: 'plain-text',
      acceptedContentTypes: this.acceptedContentTypes,
      acceptedEditTypes: this.acceptedEditTypes,
      examples: [
        {
          description: "Create a new TypeScript file",
          toolCall: {
            tool: "create_resource",
            input: {
              resourcePath: "src/newFile.ts",
              plainTextContent: {
                content: "export const config = {};",
                expectedLineCount: 1
              }
            }
          }
        }
      ]
    };
  }
}

// Notion Provider - Prefers structured content, can accept plain text and convert
class NotionProvider extends BBDataSourceProvider {
  acceptedContentTypes = ['plainTextContent', 'structuredContent'];
  acceptedEditTypes = ['blockEdits'];
  preferredContentType = 'structuredContent';
  
  getContentTypeGuidance(): ContentTypeGuidance {
    return {
      primaryContentType: 'structured',
      acceptedContentTypes: this.acceptedContentTypes,
      acceptedEditTypes: this.acceptedEditTypes,
      examples: [
        {
          description: "Create Notion page with structured content",
          toolCall: {
            tool: "create_resource",
            input: {
              resourcePath: "page/new-page",
              structuredContent: {
                blocks: [{
                  _type: "block",
                  style: "h1",
                  children: [{ _type: "span", text: "New Page Title", marks: [] }]
                }],
                acknowledgement: "Creating structured Notion content"
              }
            }
          }
        },
        {
          description: "Create Notion page with plain text (auto-converted)",
          toolCall: {
            tool: "create_resource",
            input: {
              resourcePath: "page/simple-page",
              plainTextContent: {
                content: "This will be converted to Notion blocks automatically",
                expectedLineCount: 1
              }
            }
          }
        }
      ]
    };
  }
}
```

#### Accessor Implementations
```typescript
// Filesystem Accessor - Handles plain text natively
class FilesystemResourceAccessor extends BBResourceAccessor {
  async createResource(path: string, content: PlainTextContent | BinaryContent, options: any) {
    if (isPlainTextContent(content)) {
      return this.writeTextFile(path, content.content, options);
    } else if (isBinaryContent(content)) {
      return this.writeBinaryFile(path, content.data, options);
    }
    throw new Error('Unsupported content type for filesystem');
  }
  
  async editResource(path: string, editOps: SearchReplaceEdits, options: any) {
    // Handle search and replace operations
    return this.applySearchReplaceEdits(path, editOps.operations, options);
  }
}

// Notion Accessor - Handles structured content natively, converts plain text
class NotionBlockResourceAccessor extends NotionResourceAccessor {
  async createResource(path: string, content: PlainTextContent | StructuredContent, options: any) {
    if (isStructuredContent(content)) {
      // Handle structured content natively
      return this.createNotionPage(path, content.blocks, options);
    } else if (isPlainTextContent(content)) {
      // Convert plain text to basic Portable Text blocks
      const blocks = this.convertPlainTextToPortableText(content.content);
      return this.createNotionPage(path, blocks, options);
    }
    throw new Error('Unsupported content type for Notion');
  }
  
  async editResource(path: string, editOps: BlockEdits, options: any) {
    // Handle block edit operations
    return this.applyPortableTextOperations(path, editOps.operations, options);
  }
  
  private convertPlainTextToPortableText(text: string): PortableTextBlock[] {
    // Convert plain text to basic blocks
    const lines = text.split('\n');
    return lines.map(line => ({
      _type: 'block',
      style: 'normal',
      children: [{ _type: 'span', text: line, marks: [] }]
    }));
  }
}
```

### 2. Legacy Tool Management

#### Option A: Tool Metadata Approach (Recommended)
Update `info.json` for legacy tools:

```json
// api/src/llms/tools/searchAndReplace.tool/info.json
{
  "name": "search_and_replace",
  "version": "1.0.0", 
  "description": "[LEGACY] Use edit_resource with searchAndReplaceEdits instead",
  "enabled": false,
  "toolSets": ["legacy"],
  "category": ["deprecated"]
}

// api/src/llms/tools/rewriteResource.tool/info.json
{
  "name": "rewrite_resource",
  "version": "1.0.0",
  "description": "[LEGACY] Use create_resource with overwriteExisting=true instead", 
  "enabled": false,
  "toolSets": ["legacy"],
  "category": ["deprecated"]
}

// api/src/llms/tools/blockEdit.tool/info.json  
{
  "name": "block_edit",
  "version": "1.0.0",
  "description": "[LEGACY] Use edit_resource with blockEdits instead",
  "enabled": false,
  "toolSets": ["legacy"], 
  "category": ["deprecated"]
}
```

#### Option B: Tool Set Filtering (Alternative)
Modify LLMToolManager to automatically exclude legacy tools from new conversations:

```typescript
class LLMToolManager {
  private isToolInSet(metadata: ToolMetadata): boolean {
    const metadataSets = metadata.toolSets
      ? (Array.isArray(metadata.toolSets) ? metadata.toolSets : [metadata.toolSets])
      : ['core'];
    const requestedSets = Array.isArray(this.toolSet) ? this.toolSet : [this.toolSet];
    
    // Automatically exclude legacy tools unless explicitly requested
    if (metadataSets.includes('legacy') && !requestedSets.includes('legacy')) {
      return false;
    }
    
    return metadataSets.some((set) => requestedSets.includes(set as LLMToolManagerToolSetType));
  }
}
```

### 3. System Prompt Updates

No changes needed to system prompt - content type guidance will be provided dynamically through `load_datasource` results.

## Testing Requirements

Following the guidelines from `docs/development/llm/new_tool.md` and existing BB testing patterns:

### 1. Create Resource Tool Tests

**Location**: `api/src/llms/tools/createResource.tool/tests/`

#### Test Files Structure
```
createResource.tool/tests/
├── tool.test.ts              # Main tool functionality
├── filesystem.test.ts        # Filesystem-specific tests  
├── notion.test.ts           # Notion-specific tests (mocked)
├── validation.test.ts       # Input validation tests
└── formatter.test.ts        # Formatter tests
```

#### Main Test Cases (`tool.test.ts`)
**Pattern**: Follow existing tool test structure from `api/src/llms/tools/searchAndReplace.tool/tests/tool.test.ts`

```typescript
import { assertEquals, assertRejects, assertThrows } from '@std/assert';
import { join } from '@std/path';
import CreateResourceTool from '../tool.ts';
import { createTestProjectEditor, createTestLLMConversationInteraction } from 'api/tests/testSetup.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';

Deno.test({
  name: "CreateResourceTool - Basic functionality with filesystem",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Setup test project using existing pattern
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      const toolUse: LLMAnswerToolUse = {
        toolUseId: 'test-1',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: 'test-file.ts',
          plainTextContent: {
            content: 'export const test = "hello";',
            expectedLineCount: 1
          }
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, toolUse, projectEditor);
      
      assertEquals(result.success, true);
      // Verify file was created using projectEditor.readFile
      const content = await projectEditor.readFile('test-file.ts');
      assertEquals(content, 'export const test = "hello";');
    } finally {
      await cleanup();
    }
  }
});

Deno.test({
  name: "CreateResourceTool - Provider compatibility validation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      // Test unsupported content type for filesystem
      const toolUse: LLMAnswerToolUse = {
        toolUseId: 'test-2',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: 'test-file.ts',
          structuredContent: {
            blocks: [{ _type: 'block', children: [] }],
            acknowledgement: 'test'
          }
        },
        toolValidation: { validated: true, results: '' }
      };
      
      // Should throw error for unsupported content type
      await assertRejects(
        () => tool.runTool(interaction, toolUse, projectEditor),
        Error,
        "doesn't accept structuredContent"
      );
    } finally {
      await cleanup();
    }
  }
});

Deno.test({
  name: "CreateResourceTool - Directory creation and overwrite behavior",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      // Test nested directory creation
      const toolUse: LLMAnswerToolUse = {
        toolUseId: 'test-3',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: 'nested/deep/test-file.ts',
          plainTextContent: {
            content: 'export const nested = true;',
            expectedLineCount: 1
          },
          createMissingDirectories: true
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, toolUse, projectEditor);
      assertEquals(result.success, true);
      
      // Test overwrite behavior
      const overwriteToolUse: LLMAnswerToolUse = {
        ...toolUse,
        toolUseId: 'test-4',
        toolInput: {
          ...toolUse.toolInput,
          plainTextContent: {
            content: 'export const overwritten = true;',
            expectedLineCount: 1
          },
          overwriteExisting: true
        }
      };
      
      const overwriteResult = await tool.runTool(interaction, overwriteToolUse, projectEditor);
      assertEquals(overwriteResult.success, true);
      
      const finalContent = await projectEditor.readFile('nested/deep/test-file.ts');
      assertEquals(finalContent, 'export const overwritten = true;');
    } finally {
      await cleanup();
    }
  }
});
```

#### Filesystem-Specific Tests (`filesystem.test.ts`)
**Pattern**: Follow existing filesystem testing patterns from `api/tests/t/dataSources/filesystem/filesystemAccessor.test.ts`

```typescript
import { assertEquals, assertRejects } from '@std/assert';
import { join } from '@std/path';
import CreateResourceTool from '../tool.ts';
import { createTestProjectEditor } from 'api/tests/testSetup.ts';
import { FilesystemResourceAccessor } from 'api/dataSources/filesystem/filesystemAccessor.ts';

Deno.test({
  name: "CreateResourceTool - Filesystem security and path validation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      // Test that paths outside project are rejected
      const maliciousToolUse = {
        toolUseId: 'test-security',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: '../../../etc/passwd',
          plainTextContent: {
            content: 'malicious content',
            expectedLineCount: 1
          }
        },
        toolValidation: { validated: true, results: '' }
      };
      
      await assertRejects(
        () => tool.runTool(interaction, maliciousToolUse, projectEditor),
        Error,
        'Path is outside project directory'
      );
      
      // Test valid relative paths work
      const validToolUse = {
        toolUseId: 'test-valid',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: 'src/utils/helper.ts',
          plainTextContent: {
            content: 'export function helper() { return "help"; }',
            expectedLineCount: 1
          },
          createMissingDirectories: true
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, validToolUse, projectEditor);
      assertEquals(result.success, true);
      
      // Verify file exists using projectEditor patterns
      const exists = await projectEditor.fileExists('src/utils/helper.ts');
      assertEquals(exists, true);
    } finally {
      await cleanup();
    }
  }
});

Deno.test({
  name: "CreateResourceTool - Binary content handling",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      // Create simple binary content (PNG header)
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      const binaryToolUse = {
        toolUseId: 'test-binary',
        toolName: 'create_resource',
        toolInput: {
          resourcePath: 'assets/test.png',
          binaryContent: {
            data: pngHeader,
            mimeType: 'image/png'
          },
          createMissingDirectories: true
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, binaryToolUse, projectEditor);
      assertEquals(result.success, true);
      
      // Verify binary file was created correctly
      const fileContent = await projectEditor.readBinaryFile('assets/test.png');
      assertEquals(fileContent.length, pngHeader.length);
      assertEquals(fileContent[0], 0x89); // PNG signature
    } finally {
      await cleanup();
    }
  }
});
```

#### Notion-Specific Tests (`notion.test.ts`)
**Pattern**: Follow existing mocking patterns from `api/tests/t/dataSources/notion/notionAccessor.test.ts`

```typescript
import { assertEquals, assertRejects } from '@std/assert';
import { stub, spy, returnsNext } from '@std/testing/mock';
import CreateResourceTool from '../tool.ts';
import { createTestProjectEditor } from 'api/tests/testSetup.ts';
import { NotionBlockResourceAccessor } from 'api/dataSources/notion/notionBlockResourceAccessor.ts';

Deno.test({
  name: "CreateResourceTool - Notion structured content creation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      // Mock Notion accessor following existing patterns
      const mockNotionAccessor = {
        createResource: stub(returnsNext([
          Promise.resolve({
            success: true,
            resourcePath: 'page/test-page',
            contentType: 'structured',
            revision: 'test-revision'
          })
        ])),
        hasCapability: stub(() => true),
        connection: {
          name: 'test-notion',
          providerType: 'notion'
        }
      };
      
      // Mock the provider to accept structured content
      const mockProvider = {
        acceptedContentTypes: ['plainTextContent', 'structuredContent'],
        acceptedEditTypes: ['blockEdits'],
        name: 'Test Notion'
      };
      
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      // Override accessor retrieval (following BB test patterns)
      const originalGetAccessor = tool.getResourceAccessor;
      tool.getResourceAccessor = stub(() => mockNotionAccessor);
      tool.getDataSourceProvider = stub(() => mockProvider);
      
      const toolUse = {
        toolUseId: 'test-notion',
        toolName: 'create_resource',
        toolInput: {
          dataSourceId: 'notion-work',
          resourcePath: 'page/test-page',
          structuredContent: {
            blocks: [
              {
                _type: 'block',
                style: 'h1',
                children: [{
                  _type: 'span',
                  text: 'Test Page',
                  marks: []
                }]
              }
            ],
            acknowledgement: 'Creating test Notion page'
          }
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, toolUse, projectEditor);
      
      assertEquals(result.success, true);
      assertEquals(mockNotionAccessor.createResource.calls.length, 1);
      
      // Verify the accessor was called with correct structured content
      const call = mockNotionAccessor.createResource.calls[0];
      assertEquals(call.args[0], 'page/test-page');
      assertEquals(call.args[1].blocks[0].style, 'h1');
    } finally {
      await cleanup();
    }
  }
});

Deno.test({
  name: "CreateResourceTool - Notion plain text conversion",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { projectEditor, cleanup } = await createTestProjectEditor();
    const interaction = createTestLLMConversationInteraction(projectEditor);
    
    try {
      // Mock accessor that handles plain text conversion
      const mockNotionAccessor = {
        createResource: spy(async (path: string, content: any) => {
          // Verify accessor receives plain text and should convert internally
          assertEquals(content.content, 'This is plain text that should be converted');
          assertEquals(content.expectedLineCount, 1);
          
          return {
            success: true,
            resourcePath: path,
            contentType: 'structured', // Accessor converted to structured
            revision: 'converted-revision'
          };
        }),
        hasCapability: stub(() => true),
        connection: { name: 'test-notion', providerType: 'notion' }
      };
      
      const mockProvider = {
        acceptedContentTypes: ['plainTextContent', 'structuredContent'],
        acceptedEditTypes: ['blockEdits'],
        name: 'Test Notion'
      };
      
      const tool = new CreateResourceTool('create_resource', 'Test tool', {});
      await tool.init();
      
      tool.getResourceAccessor = stub(() => mockNotionAccessor);
      tool.getDataSourceProvider = stub(() => mockProvider);
      
      const toolUse = {
        toolUseId: 'test-conversion',
        toolName: 'create_resource',
        toolInput: {
          dataSourceId: 'notion-work',
          resourcePath: 'page/plain-text-page',
          plainTextContent: {
            content: 'This is plain text that should be converted',
            expectedLineCount: 1
          }
        },
        toolValidation: { validated: true, results: '' }
      };
      
      const result = await tool.runTool(interaction, toolUse, projectEditor);
      
      assertEquals(result.success, true);
      assertEquals(result.resourceUpdated.contentType, 'structured');
      assertEquals(mockNotionAccessor.createResource.calls.length, 1);
    } finally {
      await cleanup();
    }
  }
});
```

### 2. Edit Resource Tool Tests

**Location**: `api/src/llms/tools/editResource.tool/tests/`

#### Test Files Structure  
```
editResource.tool/tests/
├── tool.test.ts              # Main tool functionality
├── searchReplace.test.ts     # Search and replace specific tests
├── blockEdit.test.ts         # Block editing specific tests
├── structuredData.test.ts    # Structured data editing tests
├── contentTypeRouting.test.ts # Content type detection and routing
└── formatter.test.ts         # Formatter tests
```

#### Main Test Cases (`tool.test.ts`)
```typescript
Deno.test({
  name: "EditResourceTool - Input validation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test exactly one edit type required
    // Test invalid edit type combinations
    // Test missing required parameters
  }
});

Deno.test({
  name: "EditResourceTool - Provider compatibility validation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test validation against provider acceptedEditTypes
    // Test clear error messages for unsupported edit types
    // Test successful validation for supported edit types
  }
});

Deno.test({
  name: "EditResourceTool - Accessor delegation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test that tool delegates to accessor without routing
    // Test that accessor handles content type conversion
    // Test error handling when accessor fails
  }
});

Deno.test({
  name: "EditResourceTool - Transaction behavior",
  sanitizeResources: false,
  sanitizeOps: false,  
  async fn() {
    // Test all operations succeed together
    // Test rollback when one operation fails
    // Test partial success reporting
  }
});
```

#### Search Replace Tests (`searchReplace.test.ts`)
```typescript
Deno.test({
  name: "EditResourceTool - Search and replace operations",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test literal text replacement
    // Test regex pattern replacement  
    // Test case sensitivity options
    // Test replace all vs single replace
    // Test edge cases (empty strings, special characters)
  }
});
```

#### Block Edit Tests (`blockEdit.test.ts`)
```typescript
Deno.test({
  name: "EditResourceTool - Block editing operations",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test update operations
    // Test insert operations
    // Test delete operations
    // Test move operations
    // Test block selector matching (index, key, text match)
  }
});
```

### 3. Integration Tests

**Location**: `api/tests/t/llms/tools/integration/`

```typescript
Deno.test({
  name: "Tool Integration - Create and Edit workflow",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test create_resource followed by edit_resource
    // Test content type consistency across operations
    // Test revision tracking and updates
  }
});

Deno.test({
  name: "Tool Integration - Legacy tool replacement",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test that new tools can handle patterns from legacy tools
    // Test error handling for deprecated tool usage
  }
});
```

### 4. Formatter Tests

Each tool needs comprehensive formatter tests for both browser and console output:

```typescript
Deno.test({
  name: "CreateResourceTool - Console formatter",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    // Test formatLogEntryToolUse console output
    // Test formatLogEntryToolResult console output
    // Test different content types formatting
    // Test error state formatting
  }
});

Deno.test({
  name: "CreateResourceTool - Browser formatter", 
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    // Test formatLogEntryToolUse JSX output
    // Test formatLogEntryToolResult JSX output  
    // Test styling and structure
    // Test accessibility
  }
});
```

## Implementation Phases

### Phase 1: Core Tool Implementation (Week 1-2)
1. Create `createResource.tool` directory structure
2. Implement main tool functionality using `rewriteResource.tool` as template
3. Create `editResource.tool` directory structure  
4. Implement main tool functionality combining patterns from legacy tools
5. Create basic formatter implementations for both tools

### Phase 2: Content Type System (Week 2-3)
1. Enhance `load_datasource` tool with content type guidance
2. Update datasource providers with content type metadata
3. Implement content type validation in new tools
4. Add graceful degradation logic for incompatible operations

### Phase 3: Testing Implementation (Week 3-4)
1. Create comprehensive test suites for both tools
2. Implement filesystem-specific tests
3. Create mocked tests for structured content (Notion, Google Docs)
4. Add integration tests for tool workflows
5. Test formatter implementations

### Phase 4: Legacy Tool Management (Week 4)
1. Update legacy tool metadata to mark as deprecated
2. Test tool set filtering functionality
3. Verify legacy tools are excluded from new conversations
4. Update any existing tool documentation

### Phase 5: Documentation and Rollout (Week 5)
1. Update tool documentation in `docs/development/reference/tools.md`
2. Create migration guide for existing workflows
3. Test with actual LLM conversations
4. Monitor for issues and iterate based on feedback

## Migration Strategy

### Backward Compatibility
- Legacy tools remain functional but are marked as deprecated
- Existing conversations can continue using old tools
- New conversations automatically use new tools

### Error Handling for Legacy Usage
If a user manually specifies a legacy tool name:
```typescript
// In LLMToolManager.getTool()
if (legacyToolMap.has(name)) {
  const newToolName = legacyToolMap.get(name);
  logger.warn(`Tool ${name} is deprecated. Use ${newToolName} instead.`);
  // Could either return undefined or redirect to new tool
}
```

### Documentation Updates
- Update `docs/development/reference/tools.md` with new tool sections
- Mark legacy tools as deprecated with migration guidance
- Add content type guidance examples

## Success Metrics

1. **Tool Usage**: New tools adopted by LLM in >90% of content editing scenarios
2. **Error Reduction**: <5% content type compatibility errors
3. **Functionality Parity**: All existing use cases supported by new tools
4. **Performance**: No regression in tool execution time
5. **Code Quality**: >95% test coverage for new tools

## Risk Mitigation

### Risk: LLM Confusion with New Schema
**Mitigation**: Comprehensive examples in tool descriptions, content type guidance in load_datasource results

### Risk: Breaking Existing Workflows
**Mitigation**: Legacy tools remain available, gradual migration approach

### Risk: Content Type Detection Failures
**Mitigation**: Clear error messages, fallback to plain text where appropriate

### Risk: Performance Regression
**Mitigation**: Benchmark testing, caching of content type detection results

This implementation plan provides a comprehensive roadmap for transitioning to the unified content tools architecture while maintaining backward compatibility and ensuring robust functionality across all supported content types.