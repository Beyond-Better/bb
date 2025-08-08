# Unified Operations Architecture: Implementation Plan

**Date**: August 6, 2025  
**Status**: Ready for Implementation  
**Purpose**: Technical implementation guide for unified operations architecture

## Overview

This document provides detailed implementation specifications for the unified operations architecture. The core change is inverting the edit_resource tool schema from `{editType}.operations` to `operations[*].editType`, along with supporting changes across the content tools ecosystem.

## 1. Type System Updates

### 1.1 Core Operation Types

**Location**: `shared/types/dataSourceResource.ts`

```typescript
// Base operation type with prefixed properties for LLM clarity
export interface ResourceEditOperation {
  editType: 'searchReplace' | 'range' | 'block';
  
  // SearchReplace properties (use only when editType='searchReplace')
  searchReplace_search?: string;
  searchReplace_replace?: string;
  searchReplace_caseSensitive?: boolean;
  searchReplace_regexPattern?: boolean;
  searchReplace_replaceAll?: boolean;
  searchReplace_matchWholeWord?: boolean;
  
  // Range properties (use only when editType='range')
  range_rangeType?: RangeOperationType;
  range_location?: RangeLocation;
  range_range?: RangeCharacters;
  range_text?: string;
  range_textStyle?: TextStyle;
  range_paragraphStyle?: ParagraphStyle;
  range_fields?: string;  // For style update operations
  
  // Block properties (use only when editType='block')
  block_operationType?: BlockOperationType;
  block_selector?: BlockSelector;
  block_content?: PortableTextBlock | any;  // Content for insert/update
  block_destination?: BlockDestination;
}

export type RangeOperationType = 
  | 'insertText' 
  | 'deleteRange' 
  | 'replaceRange'
  | 'updateTextStyle' 
  | 'updateParagraphStyle';

export interface RangeLocation {
  index: number;
  tabId?: string;  // For multi-tab documents
}

export interface RangeCharacters {
  startIndex: number;
  endIndex: number;
  tabId?: string;
}

export type BlockOperationType = 'update' | 'insert' | 'delete' | 'move';

// Operation result types
export interface OperationResult {
  operationIndex: number;
  editType: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  details?: {
    matchCount?: number;        // For searchReplace
    affectedRange?: RangeCharacters;  // For range operations
    blockKey?: string;          // For block operations
    previousValue?: any;
    newValue?: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Enhanced TextStyle for rich formatting
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;        // Points
  fontFamily?: string;      // Standard font names
  color?: string;          // Hex color
  backgroundColor?: string; // Hex color
  link?: {
    url: string;
    title?: string;
  };
}

// Enhanced ParagraphStyle
export interface ParagraphStyle {
  namedStyleType?: 'NORMAL_TEXT' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6' | 'BLOCKQUOTE';
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  lineSpacing?: number;     // Multiplier (1.0 = single, 2.0 = double)
  spaceAbove?: number;      // Points
  spaceBelow?: number;      // Points
  indentation?: {
    firstLine?: number;     // Points
    left?: number;          // Points
    right?: number;         // Points
  };
}

// Type guards
export function isSearchReplaceOperation(op: ResourceEditOperation): op is SearchReplaceOperation {
  return op.editType === 'searchReplace';
}

export function isRangeOperation(op: ResourceEditOperation): op is RangeOperation {
  return op.editType === 'range';
}

export function isBlockOperation(op: ResourceEditOperation): op is BlockOperation {
  return op.editType === 'block';
}
```

### 1.2 Enhanced PortableText Types

```typescript
// Enhanced PortableText for rich content (extends existing types)
export interface EnhancedPortableTextBlock extends PortableTextBlock {
  // Additional properties for rich formatting
  paragraphStyle?: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;
    spacing?: { above?: number; below?: number };
    indentation?: { first?: number; left?: number; right?: number };
  };
  
  // Table support
  table?: {
    rows: number;
    columns: number;
    cells: EnhancedTableCell[][];
  };
}

export interface EnhancedPortableTextSpan extends PortableTextSpan {
  // Enhanced text formatting
  textStyle?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
  };
}
```

## 2. Tool Schema Updates

### 2.1 Edit Resource Tool

**Location**: `api/src/llms/tools/editResource.tool/tool.ts`

#### Input Schema Changes

```typescript
const inputSchema: ToolSchema = {
  type: 'object',
  properties: {
    dataSourceId: {
      type: 'string',
      description: 'Data source ID to operate on. Defaults to the primary data source if omitted.'
    },
    resourcePath: {
      type: 'string',
      description: 'The path of the resource to be edited, relative to the data source root.'
    },
    operations: {
      type: 'array',
      description: 'Array of edit operations to apply in sequence. Each operation sees the results of previous operations.',
      items: {
        type: 'object',
        properties: {
          editType: {
            type: 'string',
            enum: ['searchReplace', 'range', 'block'],
            description: 'Type of edit operation to perform. Use properties prefixed with this type (e.g., searchReplace_search for searchReplace operations).'
          },
          
          // SearchReplace properties - prefix: searchReplace_
          searchReplace_search: { 
            type: 'string', 
            description: 'Text to search for (only for editType="searchReplace")' 
          },
          searchReplace_replace: { 
            type: 'string', 
            description: 'Text to replace with (only for editType="searchReplace")' 
          },
          searchReplace_caseSensitive: { 
            type: 'boolean', 
            default: true,
            description: 'Case-sensitive search (only for editType="searchReplace")'
          },
          searchReplace_regexPattern: { 
            type: 'boolean', 
            default: false,
            description: 'Treat search as regex pattern (only for editType="searchReplace")'
          },
          searchReplace_replaceAll: { 
            type: 'boolean', 
            default: false,
            description: 'Replace all occurrences (only for editType="searchReplace")'
          },
          searchReplace_matchWholeWord: { 
            type: 'boolean', 
            default: false,
            description: 'Match whole words only (only for editType="searchReplace")'
          },
          
          // Range operation properties - prefix: range_
          range_rangeType: {
            type: 'string',
            enum: ['insertText', 'deleteRange', 'replaceRange', 'updateTextStyle', 'updateParagraphStyle'],
            description: 'Type of range operation (only for editType="range")'
          },
          range_location: {
            type: 'object',
            description: 'Character position for insertion (only for editType="range" with rangeType="insertText")',
            properties: {
              index: { type: 'number' },
              tabId: { type: 'string' }
            }
          },
          range_range: {
            type: 'object',
            description: 'Character range for operations (only for editType="range")',
            properties: {
              startIndex: { type: 'number' },
              endIndex: { type: 'number' },
              tabId: { type: 'string' }
            }
          },
          range_text: { 
            type: 'string',
            description: 'Text content for insert/replace operations (only for editType="range")'
          },
          range_textStyle: { 
            /* TextStyle schema */
            description: 'Text formatting to apply (only for editType="range" with rangeType="updateTextStyle")'
          },
          range_paragraphStyle: { 
            /* ParagraphStyle schema */
            description: 'Paragraph formatting to apply (only for editType="range" with rangeType="updateParagraphStyle")'
          },
          range_fields: { 
            type: 'string',
            description: 'Comma-separated fields to update (only for editType="range" style operations)'
          },
          
          // Block operation properties - prefix: block_
          block_operationType: {
            type: 'string',
            enum: ['update', 'insert', 'delete', 'move'],
            description: 'Type of block operation (only for editType="block")'
          },
          block_selector: { 
            /* BlockSelector schema */
            description: 'Block selection criteria (only for editType="block")'
          },
          block_content: { 
            /* Block content schema */
            description: 'Block content for insert/update operations (only for editType="block")'
          },
          block_destination: { 
            /* BlockDestination schema */
            description: 'Destination for move operations (only for editType="block")'
          }
        },
        required: ['editType']
      }
    }
  },
  required: ['resourcePath', 'operations']
};
```

#### Validation Logic

```typescript
private validateOperations(operations: ResourceEditOperation[]): ValidationResult {
  const errors: string[] = [];
  
  operations.forEach((op, index) => {
    try {
      switch (op.editType) {
        case 'searchReplace':
          if (!op.searchReplace_search || !op.searchReplace_replace) {
            errors.push(`Operation ${index}: searchReplace requires searchReplace_search and searchReplace_replace`);
          }
          break;
          
        case 'range':
          if (!op.range_rangeType) {
            errors.push(`Operation ${index}: range operations require range_rangeType`);
          }
          // Validate based on range_rangeType
          switch (op.range_rangeType) {
            case 'insertText':
              if (!op.range_location || op.range_location.index === undefined || !op.range_text) {
                errors.push(`Operation ${index}: insertText requires range_location.index and range_text`);
              }
              break;
            case 'deleteRange':
            case 'updateTextStyle':
            case 'updateParagraphStyle':
              if (!op.range_range || op.range_range.startIndex === undefined || op.range_range.endIndex === undefined) {
                errors.push(`Operation ${index}: ${op.range_rangeType} requires range_range with startIndex and endIndex`);
              }
              break;
            case 'replaceRange':
              if (!op.range_range || !op.range_text) {
                errors.push(`Operation ${index}: replaceRange requires range_range and range_text`);
              }
              break;
          }
          break;
          
        case 'block':
          if (!op.block_operationType) {
            errors.push(`Operation ${index}: block operations require block_operationType`);
          }
          if (!op.block_selector) {
            errors.push(`Operation ${index}: block operations require block_selector`);
          }
          break;
          
        default:
          errors.push(`Operation ${index}: Unknown editType '${(op as any).editType}'`);
      }
    } catch (e) {
      errors.push(`Operation ${index}: Validation error - ${e.message}`);
    }
  });
  
  // Validate no cross-type properties are used
  operations.forEach((op, index) => {
    const hasSearchReplaceProps = Object.keys(op).some(k => k.startsWith('searchReplace_'));
    const hasRangeProps = Object.keys(op).some(k => k.startsWith('range_'));
    const hasBlockProps = Object.keys(op).some(k => k.startsWith('block_'));
    
    if (op.editType === 'searchReplace' && (hasRangeProps || hasBlockProps)) {
      errors.push(`Operation ${index}: searchReplace operation contains properties for other operation types`);
    }
    if (op.editType === 'range' && (hasSearchReplaceProps || hasBlockProps)) {
      errors.push(`Operation ${index}: range operation contains properties for other operation types`);
    }
    if (op.editType === 'block' && (hasSearchReplaceProps || hasRangeProps)) {
      errors.push(`Operation ${index}: block operation contains properties for other operation types`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### Operation Processing

```typescript
async runTool(interaction: LLMConversationInteraction, toolUse: LLMAnswerToolUse, projectEditor: ProjectEditor): Promise<LLMToolRunResult> {
  const input = toolUse.toolInput as LLMToolEditResourceInput;
  
  // Validate operations
  const validation = this.validateOperations(input.operations);
  if (!validation.valid) {
    throw new Error(`Invalid operations: ${validation.errors.join('; ')}`);
  }
  
  // Get datasource and accessor
  const dsConnection = await projectEditor.datasourceManager.getConnection(input.dataSourceId);
  const accessor = await dsConnection.getAccessor();
  
  // Check provider capabilities
  const provider = dsConnection.getProvider();
  const unsupportedOps = await this.checkProviderSupport(input.operations, provider);
  if (unsupportedOps.length > 0) {
    throw new Error(`Provider '${provider.name}' doesn't support: ${unsupportedOps.join(', ')}`);
  }
  
  // Execute operations
  const results = await accessor.editResource(input.resourcePath, input.operations);
  
  // Format response
  return this.formatResponse(results, input.resourcePath);
}

private async checkProviderSupport(operations: ResourceEditOperation[], provider: DataSourceProvider): Promise<string[]> {
  const unsupported: string[] = [];
  const editTypes = new Set(operations.map(op => op.editType));
  
  editTypes.forEach(editType => {
    const supportedKey = `supports${editType.charAt(0).toUpperCase()}${editType.slice(1)}`;
    if (!provider.capabilities[supportedKey]) {
      unsupported.push(editType);
    }
  });
  
  return unsupported;
}
```

#### Response Structure

```typescript
interface EditResourceResponseData {
  dataSource: DataSourceInfo;
  resourcePath: string;
  operationsApplied: number;
  operationResults: OperationResult[];
  resourceUpdated: {
    lastModified: string;
    revision: string;
    size?: number;
  };
  summary: {
    successful: number;
    failed: number;
    skipped: number;
  };
}
```

### 2.2 Write Resource Tool Updates

**Enhanced PortableText Support**

```typescript
// In writeResource.tool input schema
structuredContent: {
  type: 'object',
  properties: {
    blocks: {
      type: 'array',
      description: 'Enhanced PortableText blocks with rich formatting support',
      items: { /* EnhancedPortableTextBlock schema */ }
    },
    acknowledgement: {
      type: 'string',
      description: 'Required acknowledgement for structured content'
    }
  },
  required: ['blocks', 'acknowledgement']
}
```

### 2.3 Load Resource Tool Updates

**Content Format for Range Operations**

```typescript
contentFormat: {
  type: 'string',
  enum: ['plainText', 'structured', 'both'],
  default: 'plainText',
  description: 'Content representation format. plainText=human-readable (markdown for structured sources), structured=raw blocks for editing, both=comprehensive access. Parameter ignored for filesystem sources which always return native content.'
}
```

### 2.4 Find Resource Tool Updates

**Complete Redesign for Multi-Datasource Support**

#### Input Schema

```typescript
interface FindResourceInput {
  dataSourceId?: string;
  
  // Search parameters (one required)
  contentPattern?: string;
  resourcePattern?: string;
  structuredQuery?: any;  // Provider-specific
  
  // Search options
  caseSensitive?: boolean;
  regexPattern?: boolean;
  
  // Result control
  resultLevel?: 'resource' | 'container' | 'fragment' | 'detailed';
  maxMatchesPerResource?: number;
  
  // Pagination
  pageSize?: number;        // Default: 20
  pageToken?: string;       // Continuation from previous results
  
  // Filtering
  dateAfter?: string;
  dateBefore?: string;
  sizeMin?: number;
  sizeMax?: number;
}
```

#### Output Structure

```typescript
interface FindResourceResult {
  dataSource: DataSourceInfo;
  searchCriteria: SearchCriteria;
  totalMatches: number;
  resources: ResourceMatch[];
  pagination: {
    pageSize: number;
    pageToken?: string;      // Token for next page
    hasMore: boolean;
    totalEstimate?: number;  // Optional estimate of total results
  };
}

interface ResourceMatch {
  resourceUri: string;
  resourcePath: string;  // For edit_resource
  resourceType: string;  // 'file', 'page', 'issue', 'task', 'row'
  resourceMetadata: {
    title?: string;
    lastModified?: string;
    author?: string;
    size?: number;
    // Provider-specific metadata
  };
  
  matches: Match[];  // Empty array if resultLevel='resource'
}
```

#### Polymorphic Match Types

```typescript
type Match = TextMatch | BlockMatch | RecordMatch | TaskMatch;

interface TextMatch {
  type: 'text';
  resourceUri: string;  // Same as parent, included for consistency
  lineNumber?: number;
  characterRange: { start: number; end: number };
  text: string;
  context?: {
    before: string;
    after: string;
  };
}

interface BlockMatch {
  type: 'block';
  resourceUri: string;
  blockId: string;      // For edit_resource block operations
  blockType: string;
  content: any;         // Full block content (PortableText or native)
  textMatches?: Array<{
    path: string[];     // Path within block structure
    range: { start: number; end: number };
    text: string;
  }>;
}

interface RecordMatch {
  type: 'record';
  resourceUri: string;
  recordId: string;     // Primary key or unique identifier
  tableName?: string;
  fields: Record<string, any>;
  matchedFields: string[];
}

interface TaskMatch {
  type: 'task';
  resourceUri: string;
  taskId: string;
  projectId?: string;
  status: string;
  title: string;
  matchedIn: 'title' | 'description' | 'comments';
  textMatch?: {
    text: string;
    context?: { before: string; after: string };
  };
}
```

#### Result Level Behavior

- **resource**: Just list matching resources (fastest, matches array empty)
- **container**: Include the container (block, row, task) with match
- **fragment**: Include text fragments around matches
- **detailed**: Full details including ranges, styling, metadata

#### Tool Implementation Changes

```typescript
class FindResourceTool extends LLMTool {
  async runTool(interaction, toolUse, projectEditor): Promise<LLMToolRunResult> {
    const input = toolUse.toolInput as FindResourceInput;
    
    // Get datasource and accessor
    const dsConnection = await projectEditor.datasourceManager.getConnection(input.dataSourceId);
    const accessor = await dsConnection.getAccessor();
    
    // Delegate to accessor-specific search
    const searchResult = await accessor.findResources({
      contentPattern: input.contentPattern,
      resourcePattern: input.resourcePattern,
      structuredQuery: input.structuredQuery,
      options: {
        caseSensitive: input.caseSensitive,
        regexPattern: input.regexPattern,
        resultLevel: input.resultLevel || 'fragment',
        maxMatchesPerResource: input.maxMatchesPerResource,
        pageSize: input.pageSize || 20,
        pageToken: input.pageToken,
        filters: {
          dateAfter: input.dateAfter,
          dateBefore: input.dateBefore,
          sizeMin: input.sizeMin,
          sizeMax: input.sizeMax
        }
      }
    });
    
    return this.formatResponse(searchResult);
  }
}
```

## 3. Datasource Accessor Updates

### 3.1 Base Accessor Interface

**Location**: `api/src/types/datasource.ts`

```typescript
export interface ResourceAccessor {
  // Existing methods...
  
  // New unified edit method
  editResource(
    resourcePath: string,
    operations: ResourceEditOperation[]
  ): Promise<ResourceEditResult>;
  
  // Capability checking
  supportsEditType(editType: 'searchReplace' | 'range' | 'block'): boolean;
}

export interface ResourceEditResult {
  success: boolean;
  operationResults: OperationResult[];
  resourceMetadata: {
    lastModified: Date;
    revision: string;
    size?: number;
  };
}
```

### 3.2 Filesystem Accessor Implementation

```typescript
class FilesystemResourceAccessor extends BBResourceAccessor {
  async editResource(resourcePath: string, operations: ResourceEditOperation[]): Promise<ResourceEditResult> {
    // Read current content
    let content = await this.readTextFile(resourcePath);
    const operationResults: OperationResult[] = [];
    
    // Process operations in sequence
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      try {
        switch (op.editType) {
          case 'searchReplace':
            const result = await this.applySearchReplace(content, op);
            content = result.content;
            operationResults.push({
              operationIndex: i,
              editType: 'searchReplace',
              status: 'success',
              details: { matchCount: result.matchCount }
            });
            break;
            
          case 'range':
            // Filesystem doesn't support range operations
            operationResults.push({
              operationIndex: i,
              editType: 'range',
              status: 'skipped',
              message: 'Filesystem doesn\'t support range operations'
            });
            break;
            
          case 'block':
            // Filesystem doesn't support block operations
            operationResults.push({
              operationIndex: i,
              editType: 'block',
              status: 'skipped',
              message: 'Filesystem doesn\'t support block operations'
            });
            break;
        }
      } catch (error) {
        operationResults.push({
          operationIndex: i,
          editType: op.editType,
          status: 'failed',
          error: {
            code: 'OPERATION_FAILED',
            message: error.message
          }
        });
        // Continue with remaining operations
      }
    }
    
    // Write updated content
    await this.writeTextFile(resourcePath, content);
    
    // Get updated metadata
    const metadata = await this.getResourceMetadata(resourcePath);
    
    return {
      success: operationResults.some(r => r.status === 'success'),
      operationResults,
      resourceMetadata: metadata
    };
  }
  
  private async applySearchReplace(content: string, op: ResourceEditOperation): Promise<{ content: string; matchCount: number }> {
    let pattern: RegExp;
    let matchCount = 0;
    
    if (op.searchReplace_regexPattern) {
      pattern = new RegExp(op.searchReplace_search!, op.searchReplace_caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex characters for literal search
      const escaped = op.searchReplace_search!.replace(/[.*+?^${}()|[\]\\]/g, '\\    if (op.regexPattern) {
      pattern = new RegExp(op.search, op.caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex characters for literal search
      const escaped = op.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundary = op.matchWholeWord ? '\\b' : '';
      pattern = new RegExp(`${wordBoundary}${escaped}${wordBoundary}`, op.caseSensitive ? 'g' : 'gi');
    }
    
    if (op.replaceAll) {
      content = content.replace(pattern, (match) => {
        matchCount++;
        return op.replace;
      });
    } else {
      let replaced = false;
      content = content.replace(pattern, (match) => {
        if (!replaced) {
          matchCount++;
          replaced = true;
          return op.replace;
        }
        return match;
      });
    }');
      const wordBoundary = op.searchReplace_matchWholeWord ? '\\b' : '';
      pattern = new RegExp(`${wordBoundary}${escaped}${wordBoundary}`, op.searchReplace_caseSensitive ? 'g' : 'gi');
    }
    
    if (op.searchReplace_replaceAll) {
      content = content.replace(pattern, (match) => {
        matchCount++;
        return op.searchReplace_replace!;
      });
    } else {
      let replaced = false;
      content = content.replace(pattern, (match) => {
        if (!replaced) {
          matchCount++;
          replaced = true;
          return op.searchReplace_replace!;
        }
        return match;
      });
    }
    
    return { content, matchCount };
  }
  
  supportsEditType(editType: string): boolean {
    return editType === 'searchReplace';
  }
}
```

### 3.3 Google Docs Accessor Implementation

```typescript
class GoogleDocsResourceAccessor extends BBResourceAccessor {
  async editResource(resourcePath: string, operations: ResourceEditOperation[]): Promise<ResourceEditResult> {
    const documentId = this.extractDocumentId(resourcePath);
    const batchRequests: any[] = [];
    const operationResults: OperationResult[] = [];
    
    // Pre-process operations to build batch requests
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      try {
        switch (op.editType) {
          case 'searchReplace':
            batchRequests.push({
              replaceAllText: {
                containsText: {
                  text: op.searchReplace_search,
                  matchCase: op.searchReplace_caseSensitive || false
                },
                replaceText: op.searchReplace_replace
              }
            });
            break;
            
          case 'range':
            const rangeRequest = this.buildRangeRequest(op);
            batchRequests.push(rangeRequest);
            break;
            
          case 'block':
            // Convert block operations to range operations
            const rangeRequests = await this.convertBlockToRange(documentId, op);
            batchRequests.push(...rangeRequests);
            break;
        }
      } catch (error) {
        operationResults.push({
          operationIndex: i,
          editType: op.editType,
          status: 'failed',
          error: {
            code: 'REQUEST_BUILD_FAILED',
            message: error.message
          }
        });
      }
    }
    
    // Execute batch update
    try {
      const response = await this.client.documents.batchUpdate({
        documentId,
        requests: batchRequests
      });
      
      // Process response to build operation results
      operations.forEach((op, i) => {
        operationResults.push({
          operationIndex: i,
          editType: op.editType,
          status: 'success',
          details: this.extractOperationDetails(op, response)
        });
      });
    } catch (error) {
      // Handle batch failure
      operations.forEach((op, i) => {
        if (!operationResults[i]) {
          operationResults.push({
            operationIndex: i,
            editType: op.editType,
            status: 'failed',
            error: {
              code: 'BATCH_UPDATE_FAILED',
              message: 'Batch update failed'
            }
          });
        }
      });
    }
    
    // Get updated metadata
    const metadata = await this.getDocumentMetadata(documentId);
    
    return {
      success: operationResults.some(r => r.status === 'success'),
      operationResults,
      resourceMetadata: metadata
    };
  }
  
  private buildRangeRequest(op: ResourceEditOperation): any {
    switch (op.range_rangeType) {
      case 'insertText':
        return {
          insertText: {
            location: { index: op.range_location!.index },
            text: op.range_text
          }
        };
        
      case 'deleteRange':
        return {
          deleteContentRange: {
            range: {
              startIndex: op.range_range!.startIndex,
              endIndex: op.range_range!.endIndex
            }
          }
        };
        
      case 'replaceRange':
        // Google Docs doesn't have direct replace range, so delete + insert
        return [
          {
            deleteContentRange: {
              range: {
                startIndex: op.range_range!.startIndex,
                endIndex: op.range_range!.endIndex
              }
            }
          },
          {
            insertText: {
              location: { index: op.range_range!.startIndex },
              text: op.range_text
            }
          }
        ];
        
      case 'updateTextStyle':
        return {
          updateTextStyle: {
            range: {
              startIndex: op.range_range!.startIndex,
              endIndex: op.range_range!.endIndex
            },
            textStyle: this.convertTextStyle(op.range_textStyle!),
            fields: op.range_fields || this.inferTextStyleFields(op.range_textStyle!)
          }
        };
        
      case 'updateParagraphStyle':
        return {
          updateParagraphStyle: {
            range: {
              startIndex: op.range_range!.startIndex,
              endIndex: op.range_range!.endIndex
            },
            paragraphStyle: this.convertParagraphStyle(op.range_paragraphStyle!),
            fields: op.range_fields || this.inferParagraphStyleFields(op.range_paragraphStyle!)
          }
        };
    }
  }
  
  supportsEditType(editType: string): boolean {
    return ['searchReplace', 'range', 'block'].includes(editType);
  }
}
```

### 3.4 Notion Accessor Implementation

```typescript
class NotionResourceAccessor extends BBResourceAccessor {
  async editResource(resourcePath: string, operations: ResourceEditOperation[]): Promise<ResourceEditResult> {
    const pageId = this.extractPageId(resourcePath);
    const operationResults: OperationResult[] = [];
    
    // Notion operations must be applied sequentially
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      try {
        switch (op.editType) {
          case 'searchReplace':
            // Search through blocks and update text content
            const searchResult = await this.searchAndReplaceInBlocks(pageId, op);
            operationResults.push({
              operationIndex: i,
              editType: 'searchReplace',
              status: 'success',
              details: { matchCount: searchResult.matchCount }
            });
            break;
            
          case 'block':
            const blockResult = await this.applyBlockOperation(pageId, op);
            operationResults.push({
              operationIndex: i,
              editType: 'block',
              status: 'success',
              details: { blockKey: blockResult.blockId }
            });
            break;
            
          case 'range':
            // Notion doesn't support character-range operations
            operationResults.push({
              operationIndex: i,
              editType: 'range',
              status: 'skipped',
              message: 'Notion doesn\'t support character-range operations'
            });
            break;
        }
      } catch (error) {
        operationResults.push({
          operationIndex: i,
          editType: op.editType,
          status: 'failed',
          error: {
            code: 'OPERATION_FAILED',
            message: error.message
          }
        });
      }
    }
    
    // Get updated metadata
    const metadata = await this.getPageMetadata(pageId);
    
    return {
      success: operationResults.some(r => r.status === 'success'),
      operationResults,
      resourceMetadata: metadata
    };
  }
  
  private async searchAndReplaceInBlocks(pageId: string, op: ResourceEditOperation): Promise<{ matchCount: number }> {
    // Get all blocks
    const blocks = await this.getPageBlocks(pageId);
    let matchCount = 0;
    
    // Search pattern
    const pattern = op.searchReplace_regexPattern 
      ? new RegExp(op.searchReplace_search!, op.searchReplace_caseSensitive ? 'g' : 'gi')
      : op.searchReplace_search!;
    
    // Process each block
    for (const block of blocks) {
      if (block.type === 'paragraph' || block.type === 'heading_1' /* etc */) {
        const richText = block[block.type].rich_text;
        let modified = false;
        
        for (const textElement of richText) {
          if (textElement.type === 'text') {
            const originalText = textElement.text.content;
            let newText = originalText;
            
            if (op.searchReplace_regexPattern) {
              newText = originalText.replace(pattern, (match) => {
                matchCount++;
                return op.searchReplace_replace!;
              });
            } else {
              // Case-sensitive or insensitive literal search
              const searchText = op.searchReplace_caseSensitive ? op.searchReplace_search! : op.searchReplace_search!.toLowerCase();
              const compareText = op.searchReplace_caseSensitive ? originalText : originalText.toLowerCase();
              
              if (compareText.includes(searchText)) {
                matchCount++;
                newText = originalText.replace(
                  op.searchReplace_search!,
                  op.searchReplace_replace!
                );
              }
            }
            
            if (newText !== originalText) {
              textElement.text.content = newText;
              modified = true;
            }
          }
        }
        
        if (modified) {
          // Update block
          await this.updateBlock(block.id, {
            [block.type]: { rich_text: richText }
          });
        }
      }
    }
    
    return { matchCount };
  }
  
  supportsEditType(editType: string): boolean {
    return ['searchReplace', 'block'].includes(editType);
  }
}
```

### 3.5 Find Resource Accessor Implementations

#### Filesystem Accessor

```typescript
class FilesystemResourceAccessor extends BBResourceAccessor {
  async findResources(params: FindResourceParams): Promise<FindResourceResult> {
    const resources: ResourceMatch[] = [];
    let totalMatches = 0;
    
    // Use ripgrep or similar for efficient search
    const searchPattern = params.regexPattern 
      ? params.contentPattern
      : this.escapeRegex(params.contentPattern);
    
    const files = await this.searchFiles({
      pattern: searchPattern,
      caseSensitive: params.options.caseSensitive,
      filePattern: params.resourcePattern,
      filters: params.options.filters
    });
    
    for (const file of files) {
      const matches: TextMatch[] = [];
      
      if (params.options.resultLevel !== 'resource') {
        // Read file and find matches
        const content = await this.readTextFile(file.path);
        const lines = content.split('\n');
        let charOffset = 0;
        
        lines.forEach((line, lineIndex) => {
          const regex = new RegExp(searchPattern, params.options.caseSensitive ? 'g' : 'gi');
          let match;
          
          while ((match = regex.exec(line)) !== null) {
            if (matches.length >= params.options.maxMatchesPerResource) break;
            
            matches.push({
              type: 'text',
              resourceUri: `filesystem-local:./${file.path}`,
              lineNumber: lineIndex + 1,
              characterRange: {
                start: charOffset + match.index,
                end: charOffset + match.index + match[0].length
              },
              text: match[0],
              context: params.options.resultLevel === 'fragment' ? {
                before: line.substring(Math.max(0, match.index - 30), match.index),
                after: line.substring(match.index + match[0].length, match.index + match[0].length + 30)
              } : undefined
            });
            totalMatches++;
          }
          
          charOffset += line.length + 1; // +1 for newline
        });
      }
      
      resources.push({
        resourceUri: `filesystem-local:./${file.path}`,
        resourcePath: file.path,
        resourceType: 'file',
        resourceMetadata: {
          lastModified: file.lastModified,
          size: file.size
        },
        matches
      });
    }
    
    return {
      dataSource: this.getDataSourceInfo(),
      searchCriteria: { pattern: params.contentPattern },
      totalMatches,
      resources,
      pagination: {
        pageSize: params.options.pageSize,
        hasMore: false  // Implement actual pagination
      }
    };
  }
}
```

#### Google Docs Accessor

```typescript
class GoogleDocsResourceAccessor extends BBResourceAccessor {
  async findResources(params: FindResourceParams): Promise<FindResourceResult> {
    const resources: ResourceMatch[] = [];
    let totalMatches = 0;
    
    // Use Google Drive API to search documents
    const query = this.buildDriveQuery(params);
    const documents = await this.client.files.list({ q: query });
    
    for (const doc of documents.files) {
      const matches: TextMatch[] = [];
      
      if (params.options.resultLevel !== 'resource' && params.contentPattern) {
        // Get document content
        const document = await this.client.documents.get({ documentId: doc.id });
        const text = this.extractText(document);
        
        // Search for matches
        const regex = new RegExp(
          params.regexPattern ? params.contentPattern : this.escapeRegex(params.contentPattern),
          params.options.caseSensitive ? 'g' : 'gi'
        );
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (matches.length >= params.options.maxMatchesPerResource) break;
          
          matches.push({
            type: 'text',
            resourceUri: `googledocs://document/${doc.id}`,
            characterRange: {
              start: match.index,
              end: match.index + match[0].length
            },
            text: match[0],
            context: params.options.resultLevel === 'fragment' ? {
              before: text.substring(Math.max(0, match.index - 50), match.index),
              after: text.substring(match.index + match[0].length, match.index + match[0].length + 50)
            } : undefined
          });
          totalMatches++;
        }
      }
      
      resources.push({
        resourceUri: `googledocs://document/${doc.id}`,
        resourcePath: `document/${doc.id}`,
        resourceType: 'document',
        resourceMetadata: {
          title: doc.name,
          lastModified: doc.modifiedTime,
          author: doc.lastModifyingUser?.displayName
        },
        matches
      });
    }
    
    return {
      dataSource: this.getDataSourceInfo(),
      searchCriteria: params,
      totalMatches,
      resources,
      pagination: {
        pageSize: params.options.pageSize,
        pageToken: documents.nextPageToken,
        hasMore: !!documents.nextPageToken
      }
    };
  }
}
```

#### Notion Accessor

```typescript
class NotionResourceAccessor extends BBResourceAccessor {
  async findResources(params: FindResourceParams): Promise<FindResourceResult> {
    const resources: ResourceMatch[] = [];
    let totalMatches = 0;
    
    // Use Notion search API
    const searchParams = {
      query: params.contentPattern,
      filter: this.buildNotionFilter(params),
      page_size: params.options.pageSize,
      start_cursor: params.options.pageToken
    };
    
    const searchResults = await this.client.search(searchParams);
    
    for (const result of searchResults.results) {
      const matches: BlockMatch[] = [];
      
      if (params.options.resultLevel !== 'resource' && result.object === 'page') {
        // Get page blocks
        const blocks = await this.getPageBlocks(result.id);
        
        for (const block of blocks) {
          if (this.blockContainsText(block, params.contentPattern)) {
            const textMatches = this.findTextInBlock(block, params.contentPattern);
            
            matches.push({
              type: 'block',
              resourceUri: `notion://page/${result.id}`,
              blockId: block.id,
              blockType: block.type,
              content: params.options.resultLevel === 'detailed' ? block : undefined,
              textMatches
            });
            totalMatches++;
            
            if (matches.length >= params.options.maxMatchesPerResource) break;
          }
        }
      }
      
      resources.push({
        resourceUri: `notion://page/${result.id}`,
        resourcePath: `page/${result.id}`,
        resourceType: 'page',
        resourceMetadata: {
          title: this.getPageTitle(result),
          lastModified: result.last_edited_time,
          author: result.last_edited_by?.name
        },
        matches
      });
    }
    
    return {
      dataSource: this.getDataSourceInfo(),
      searchCriteria: params,
      totalMatches,
      resources,
      pagination: {
        pageSize: params.options.pageSize,
        pageToken: searchResults.next_cursor,
        hasMore: searchResults.has_more
      }
    };
  }
  
  private findTextInBlock(block: any, pattern: string): Array<TextMatch> {
    const matches: Array<TextMatch> = [];
    const blockText = this.extractBlockText(block);
    const regex = new RegExp(pattern, 'gi');
    
    let match;
    while ((match = regex.exec(blockText)) !== null) {
      matches.push({
        path: ['rich_text', 0, 'text', 'content'],
        range: { start: match.index, end: match.index + match[0].length },
        text: match[0]
      });
    }
    
    return matches;
  }
}
```

## 4. Datasource Provider Updates

### 4.1 Provider Capability Declaration

```typescript
export interface DataSourceProviderCapabilities {
  // Existing capabilities...
  
  // Edit operation support
  supportsSearchReplace: boolean;
  supportsRangeOperations: boolean;
  supportsBlockOperations: boolean;
  
  // Rich content support
  supportsTextFormatting: boolean;
  supportsParagraphFormatting: boolean;
  supportsTables: boolean;
  supportsColors: boolean;
  supportsFonts: boolean;
}
```

### 4.2 Updated Provider Metadata

#### Filesystem Provider

```typescript
class FilesystemProvider extends BBDataSourceProvider {
  capabilities = {
    supportsSearchReplace: true,
    supportsRangeOperations: false,
    supportsBlockOperations: false,
    supportsTextFormatting: false,  // Plain text only
    supportsParagraphFormatting: false,
    supportsTables: false,
    supportsColors: false,
    supportsFonts: false
  };
  
  getContentTypeGuidance(): ContentTypeGuidance {
    return {
      primaryContentType: 'plain-text',
      acceptedContentTypes: ['plainTextContent', 'binaryContent'],
      acceptedEditTypes: ['searchReplace'],
      preferredContentType: 'plainTextContent',
      examples: [
        {
          description: 'Search and replace in code files',
          toolCall: {
            tool: 'edit_resource',
            input: {
              resourcePath: 'src/config.ts',
              operations: [
                {
                  editType: 'searchReplace',
                  search: 'localhost',
                  replace: 'production.example.com',
                  replaceAll: true
                }
              ]
            }
          }
        }
      ],
      searchCapabilities: {
        supportsTextSearch: true,
        supportsRegex: true,
        supportsStructuredQuery: true,
        structuredQuerySchema: {
          description: 'File search with filters',
          examples: [{
            description: 'Find TypeScript files modified this week containing TODO',
            query: {
              text: 'TODO',
              filters: {
                extension: '.ts',
                modifiedAfter: '2024-08-01',
                path: 'src/'
              }
            }
          }],
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              filters: {
                type: 'object',
                properties: {
                  extension: { type: 'string' },
                  path: { type: 'string' },
                  modifiedAfter: { type: 'string', format: 'date' },
                  modifiedBefore: { type: 'string', format: 'date' },
                  sizeMin: { type: 'number' },
                  sizeMax: { type: 'number' }
                }
              }
            }
          }
        }
      }
    };
  }
}
```

#### Google Docs Provider

```typescript
class GoogleDocsProvider extends BBDataSourceProvider {
  capabilities = {
    supportsSearchReplace: true,
    supportsRangeOperations: true,
    supportsBlockOperations: true,  // Via conversion
    supportsTextFormatting: true,
    supportsParagraphFormatting: true,
    supportsTables: true,
    supportsColors: true,
    supportsFonts: true
  };
  
  getContentTypeGuidance(): ContentTypeGuidance {
    return {
      primaryContentType: 'structured',
      acceptedContentTypes: ['plainTextContent', 'structuredContent'],
      acceptedEditTypes: ['searchReplace', 'range', 'block'],
      preferredContentType: 'structuredContent',
      loadFormats: {
        plainText: 'Returns markdown for reading',
        structured: 'Returns native Google Docs JSON for range operations'
      },
      examples: [
        {
          description: 'Complex document editing with multiple operations',
          toolCall: {
            tool: 'edit_resource',
            input: {
              resourcePath: 'document/quarterly-report',
              operations: [
                {
                  editType: 'searchReplace',
                  search: 'Q3 2024',
                  replace: 'Q4 2024',
                  replaceAll: true
                },
                {
                  editType: 'range',
                  rangeType: 'updateParagraphStyle',
                  range: { startIndex: 0, endIndex: 20 },
                  paragraphStyle: { namedStyleType: 'HEADING_1' }
                }
              ]
            }
          }
        }
      ],
      notes: [
        'Use contentFormat="structured" when loading for range operations',
        'Range operations provide precise character-level control',
        'All operations are applied atomically in a single batch'
      ],
      searchCapabilities: {
        supportsTextSearch: true,
        supportsRegex: true,
        supportsStructuredQuery: true,
        structuredQuerySchema: {
          description: 'Search Google Docs with filters',
          examples: [{
            description: 'Find documents modified this week containing specific text',
            query: {
              text: 'quarterly report',
              filters: {
                modifiedAfter: '2024-08-01',
                mimeType: 'application/vnd.google-apps.document'
              }
            }
          }],
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              filters: {
                type: 'object',
                properties: {
                  modifiedAfter: { type: 'string', format: 'date' },
                  modifiedBefore: { type: 'string', format: 'date' },
                  owner: { type: 'string' },
                  sharedWithMe: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    };
  }
}
```

#### Notion Provider

```typescript
class NotionProvider extends BBDataSourceProvider {
  capabilities = {
    supportsSearchReplace: true,  // Within blocks
    supportsRangeOperations: false,
    supportsBlockOperations: true,
    supportsTextFormatting: true,
    supportsParagraphFormatting: true,
    supportsTables: true,
    supportsColors: true,
    supportsFonts: false  // Limited font support
  };
  
  getContentTypeGuidance(): ContentTypeGuidance {
    return {
      primaryContentType: 'structured',
      acceptedContentTypes: ['plainTextContent', 'structuredContent'],
      acceptedEditTypes: ['searchReplace', 'block'],
      preferredContentType: 'structuredContent',
      examples: [
        {
          description: 'Edit Notion page with block operations',
          toolCall: {
            tool: 'edit_resource',
            input: {
              resourcePath: 'page/project-notes',
              operations: [
                {
                  editType: 'block',
                  blockOperationType: 'insert',
                  selector: { position: 0 },
                  content: {
                    _type: 'block',
                    style: 'h1',
                    children: [{ _type: 'span', text: 'Updated Title' }]
                  }
                },
                {
                  editType: 'searchReplace',
                  search: 'TODO',
                  replace: 'DONE',
                  replaceAll: true
                }
              ]
            }
          }
        }
      ],
      notes: [
        'Block operations require block identifiers (_key values)',
        'Search/replace works within block text content',
        'Use contentFormat="structured" to get block structure before editing'
      ],
      searchCapabilities: {
        supportsTextSearch: true,
        supportsRegex: false,
        supportsStructuredQuery: true,
        structuredQuerySchema: {
          description: 'Search Notion pages and databases',
          examples: [{
            description: 'Find pages with specific properties',
            query: {
              text: 'architecture',
              filters: {
                type: 'page',
                properties: {
                  'Status': 'In Progress',
                  'Tags': { contains: 'backend' }
                }
              }
            }
          }, {
            description: 'Search in specific database',
            query: {
              text: 'bug',
              filters: {
                type: 'database',
                databaseId: 'abc123',
                properties: {
                  'Priority': 'High'
                }
              }
            }
          }],
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              filters: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['page', 'database'] },
                  databaseId: { type: 'string' },
                  properties: { type: 'object' }
                }
              }
            }
          }
        }
      }
    };
  }
}
```

## 5. Migration and Compatibility

### 5.1 Legacy Support Layer

```typescript
// In edit_resource tool
private convertLegacyInput(input: any): EditResourceInput {
  // If old format detected, convert to new format
  if (input.searchAndReplaceEdits || input.blockEdits || input.rangeEdits) {
    const operations: ResourceEditOperation[] = [];
    
    // Convert searchAndReplaceEdits
    if (input.searchAndReplaceEdits?.operations) {
      operations.push(...input.searchAndReplaceEdits.operations.map(op => ({
        editType: 'searchReplace' as const,
        ...op
      })));
    }
    
    // Convert rangeEdits
    if (input.rangeEdits?.operations) {
      operations.push(...input.rangeEdits.operations.map(op => ({
        editType: 'range' as const,
        ...op
      })));
    }
    
    // Convert blockEdits
    if (input.blockEdits?.operations) {
      operations.push(...input.blockEdits.operations.map(op => ({
        editType: 'block' as const,
        ...op
      })));
    }
    
    return {
      dataSourceId: input.dataSourceId,
      resourcePath: input.resourcePath,
      operations
    };
  }
  
  return input;
}
```

### 5.2 Validation for Provider Compatibility

```typescript
// Strict validation mode
if (strictMode) {
  const unsupported = operations.filter(op => {
    switch (op.editType) {
      case 'searchReplace':
        return !provider.capabilities.supportsSearchReplace;
      case 'range':
        return !provider.capabilities.supportsRangeOperations;
      case 'block':
        return !provider.capabilities.supportsBlockOperations;
    }
  });
  
  if (unsupported.length > 0) {
    throw new Error(`Operations not supported by provider`);
  }
}
```

## 6. Testing Requirements

### 6.1 Operation Validation Tests

```typescript
Deno.test('EditResource - validates operation structure', async () => {
  // Test each operation type validation
  // Test missing required fields
  // Test invalid combinations
});

Deno.test('EditResource - validates operation sequence', async () => {
  // Test operations execute in order
  // Test each operation sees previous results
  // Test partial failure handling
});
```

### 6.2 Provider Compatibility Tests

```typescript
Deno.test('EditResource - provider capability checking', async () => {
  // Test unsupported operations are rejected/skipped
  // Test graceful degradation
  // Test clear error messages
});
```

### 6.3 Cross-Provider Tests

```typescript
Deno.test('EditResource - cross-provider consistency', async () => {
  // Test searchReplace works consistently across providers
  // Test Enhanced PortableText translation
  // Test operation result format consistency
});
```

## 7. Performance Considerations

### 7.1 Batch Optimization

- Google Docs: All operations in single batch request
- Notion: Operations may need sequential application
- Filesystem: Single read, multiple operations, single write

### 7.2 Large Document Handling

- Streaming support for large files
- Progress reporting for long operations
- Cancellation support for operation sequences

## 8. Error Handling Strategy

### 8.1 Operation-Level Errors

- Each operation reports individual success/failure
- Failed operations don't stop the sequence
- Clear error codes and messages

### 8.2 Rollback Capabilities

- Filesystem: Keep backup before modifications
- Google Docs: Use revision history
- Notion: Track changed block IDs for reversal

## 9. Documentation Updates

Update the following documentation:

1. `docs/development/reference/tools.md` - New operation structure
2. `docs/development/llm/tool-usage-guide.md` - Examples and patterns
3. `docs/development/api/edit-operations.md` - Detailed operation reference
4. Provider-specific guides with examples

## 10. Implementation Timeline

### Phase 1: Core Implementation (Week 1)
- Update type definitions
- Implement new edit_resource tool logic
- Update validation and error handling

### Phase 2: Accessor Updates (Week 2)  
- Update filesystem accessor
- Update Google Docs accessor
- Update Notion accessor

### Phase 3: Testing and Migration (Week 3)
- Comprehensive test suite
- Legacy compatibility layer
- Migration documentation

### Phase 4: Enhanced Features (Week 4)
- Enhanced PortableText implementation
- Rich formatting support
- Performance optimizations

## Summary

This implementation plan transforms the edit_resource tool to use an inverted operations structure, providing a more intuitive and flexible editing system. The key benefits are:

1. **Natural operation sequencing** with explicit ordering
2. **Provider-optimized implementations** while maintaining consistent interface
3. **Maximum flexibility** for complex editing workflows
4. **Clear validation and error handling** at the operation level
5. **Extensible architecture** for future operation types

The implementation maintains backward compatibility while providing a cleaner, more powerful editing interface for all datasources.