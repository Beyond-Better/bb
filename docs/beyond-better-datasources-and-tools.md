# Beyond Better: Data Sources and Tools

## Overview

This document summarizes key findings and recommendations for enhancing Beyond Better (BB) with flexible data sources and specialized tools. The goal is to create an assistant that works effectively with diverse content types and services while maintaining a consistent, powerful toolset.

## Current Data Source Architecture

BB already has a sophisticated data source architecture with clear separation of concerns:

### Core Components

1. **DataSourceProvider**:
   - Defines the capabilities and characteristics of a type of data source
   - Declares supported capabilities (read, write, search, etc.)
   - Declares access method ('bb' or 'mcp')
   - Provides factory methods for creating ResourceAccessors

2. **DataSourceConnection**:
   - Represents a specific configured instance of a data source
   - Stores connection details (paths, credentials, etc.)
   - Associates with a specific DataSourceProvider

3. **ResourceAccessor**:
   - Provides access to resources within a data source
   - Handles provider-specific resource formats and operations
   - Implements capabilities based on the provider's declared support

4. **DataSourceRegistry**:
   - Manages available data source providers
   - Creates new DataSourceConnections
   - Handles provider registration and lookup

5. **DataSourceFactory**:
   - Creates and caches ResourceAccessor implementations
   - Routes to appropriate implementation based on access method

### Access Method Distinction

BB maintains a fundamental architectural boundary between two categories:

1. **BB-managed data sources** (`accessMethod: 'bb'`):
   - Directly controlled by BB's internal code
   - Full access to all operations and capabilities
   - Examples: filesystem, internal Notion integration

2. **MCP-managed data sources** (`accessMethod: 'mcp'`):
   - Delegated to external Model Context Protocol servers
   - Limited to capabilities defined by the MCP server
   - Examples: Supabase, external services

## Portable Text as the Block Content Standard

After evaluating multiple approaches for representing rich, block-based document content, **Portable Text** emerges as the ideal format for BB's block editing capabilities.

### What is Portable Text?

Portable Text is a JSON-based specification for structured content that was originally developed by Sanity.io. It provides a standardized way to represent rich text content with formatting, links, and other elements.

```json
[
  {
    "_type": "block",
    "style": "h1",
    "children": [
      {
        "_type": "span",
        "text": "Document Title",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "style": "normal",
    "children": [
      {
        "_type": "span",
        "text": "This is a paragraph with ",
        "marks": []
      },
      {
        "_type": "span",
        "text": "bold",
        "marks": ["strong"]
      },
      {
        "_type": "span",
        "text": " and ",
        "marks": []
      },
      {
        "_type": "span",
        "text": "italic",
        "marks": ["em"]
      },
      {
        "_type": "span",
        "text": " text.",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "style": "normal",
    "listItem": "bullet",
    "level": 1,
    "children": [
      {
        "_type": "span",
        "text": "A bullet point",
        "marks": []
      }
    ]
  }
]
```

### Key Advantages for BB

1. **JSON-Based and LLM-Friendly**:
   - Clear structure that's easy for AI to parse and modify
   - Predictable format for generating changes
   - No HTML or markup parsing required

2. **System-to-System Exchange Format**:
   - Designed specifically for content exchange between systems
   - No UI or visual rendering assumptions
   - Perfect for BB's non-visual, programmatic editing needs

3. **Strong Typing with Clear Semantics**:
   - Explicit block types with consistent structure
   - Standard way to represent formatting (marks)
   - Clear parent-child relationships

4. **Service-Agnostic but Extensible**:
   - Works across different platforms (Notion, Google Docs, etc.)
   - Can be extended with service-specific attributes
   - Maintains core compatibility while allowing customization

5. **Mature Specification**:
   - Well-documented format with established patterns
   - Existing libraries for conversion to/from other formats
   - Proven in production environments

### Block Resource Accessors with Portable Text

Extend the ResourceAccessor interface with Portable Text-based methods:

```typescript
interface BlockResourceAccessor extends ResourceAccessor {
  // Get document as Portable Text
  getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]>;
  
  // Apply operations to Portable Text
  applyPortableTextOperations(
    resourceUri: string, 
    operations: PortableTextOperation[]
  ): Promise<PortableTextOperationResult[]>;
  
  // Convert to/from service-specific formats
  convertToPortableText(nativeDocument: any): PortableTextBlock[];
  convertFromPortableText(blocks: PortableTextBlock[]): any;
}

// Portable Text typings
type PortableTextBlock = {
  _type: string;          // "block", "image", etc.
  _key?: string;          // Unique identifier
  style?: string;         // "normal", "h1", "h2", etc.
  listItem?: string;      // "bullet", "number", etc.
  level?: number;         // List nesting level
  children: PortableTextSpan[];
};

type PortableTextSpan = {
  _type: "span";
  _key?: string;          // Unique identifier
  text: string;
  marks?: string[];       // ["strong", "em", "link", etc.]
};
```

Implementations would be provider-specific but share the Portable Text format:

```typescript
class NotionBlockAccessor extends NotionResourceAccessor implements BlockResourceAccessor {
  // Convert Notion blocks to Portable Text
  convertToPortableText(notionBlocks: any[]): PortableTextBlock[] {
    // Map Notion blocks to Portable Text
    return notionBlocks.map(block => {
      // Conversion logic here
    });
  }
  
  // Convert Portable Text back to Notion format
  convertFromPortableText(blocks: PortableTextBlock[]): any[] {
    // Conversion logic here
  }
}
```

## Block Edit Tool with Portable Text

The `block_edit` tool would work with Portable Text format:

```typescript
interface BlockEditTool {
  dataSourceId: string;       // Target data source
  resourcePath: string;       // Document path/ID
  operations: PortableTextOperation[];
}

type PortableTextOperation = {
  operationType: "update" | "insert" | "delete" | "move";
  selector: {
    blockIndex?: number;      // Target by position
    blockKey?: string;        // Target by ID
    path?: string;            // JSON path within block
    textMatch?: {             // Match text content
      pattern: string;
      matchType: "prefix" | "exact" | "contains" | "regex";
    };
  };
  value?: any;                // New content for update/insert
  destination?: {             // For move operations
    beforeBlockKey?: string;
    afterBlockKey?: string;
    parentBlockKey?: string;
  };
};
```

**Example Operation:**

```json
{
  "dataSourceId": "ds-notion",
  "resourcePath": "bb+notion+notion-work://page/1a436d1afcff8044815bc50bc0eff3f9",
  "operations": [
    {
      "operationType": "update",
      "selector": {
        "blockKey": "paragraph-123",
        "path": "children[0].text"
      },
      "value": "Updated paragraph text"
    },
    {
      "operationType": "insert",
      "selector": {
        "afterBlockKey": "paragraph-123"
      },
      "value": {
        "_type": "block",
        "style": "normal",
        "children": [
          {
            "_type": "span",
            "text": "New paragraph added after the previous one.",
            "marks": []
          }
        ]
      }
    }
  ]
}
```

**Response Format:**

```json
{
  "success": true,
  "results": [
    {
      "operationIndex": 0,
      "status": "success",
      "details": {
        "previousValue": "Original paragraph text",
        "newValue": "Updated paragraph text"
      }
    },
    {
      "operationIndex": 1,
      "status": "success",
      "details": {
        "insertedBlockKey": "new-block-456"
      }
    }
  ],
  "resourceUpdated": {
    "path": "bb+notion+notion-work://page/1a436d1afcff8044815bc50bc0eff3f9",
    "lastModified": "2025-05-13T01:10:00.000Z",
    "revision": "01JV3GH5DTCA84CXCEE6GVVTD3"
  }
}
```

## Structured Data Edit Tool

A `structured_data_edit` tool would handle tabular and database-like content:

```typescript
interface StructuredDataEditTool {
  dataSourceId: string;
  resourcePath: string;
  operations: (
    | RowOperation
    | ColumnOperation 
    | CellOperation
    | FilterOperation
    | SortOperation
  )[];
}

interface CellOperation {
  operationType: "updateCell";
  selector: {
    rowIdentifier: string;    // "id:5" | "index:3" | "where:name=John"
    columnIdentifier: string; // "name" | "index:2" | "id:col_abc123"
  };
  value: any;
}

interface RowOperation {
  operationType: "addRow" | "deleteRow" | "updateRow";
  position?: string;         // "end" | "start" | "after:id:5"
  rowIdentifier?: string;    // For update/delete
  values?: Record<string, any>; // For add/update
}

interface ColumnOperation {
  operationType: "addColumn" | "deleteColumn" | "updateColumn";
  columnIdentifier?: string; // For update/delete
  position?: string;         // For add
  properties?: {             // Column definition
    name: string;
    type: string;
    options?: any[];
  };
}
```

**Example Operation:**

```json
{
  "dataSourceId": "ds-airtable",
  "resourcePath": "bb+airtable+my-base://base/table/Projects",
  "operations": [
    {
      "operationType": "updateCell",
      "selector": {
        "rowIdentifier": "where:name=Alpha Project",
        "columnIdentifier": "status"
      },
      "value": "Completed"
    },
    {
      "operationType": "addRow",
      "position": "end",
      "values": {
        "name": "New Feature",
        "status": "Planning",
        "dueDate": "2025-06-15"
      }
    }
  ]
}
```

## Comparison with Existing Tools

### search_and_replace vs. block_edit

| Feature | search_and_replace | block_edit with Portable Text |
|---------|-------------------|------------------------------|
| **Best for** | Plain text, code, simple markup | Structured documents with rich formatting |
| **Targeting** | Text patterns (literal or regex) | Blocks, spans, attributes with IDs |
| **Formatting** | No formatting preservation | Preserves rich formatting |
| **Structure** | No structure awareness | Preserves document structure |
| **Complexity** | Simple operations, complex patterns | Complex operations, simple targeting |
| **Ideal use case** | "Replace all occurrences of X with Y" | "Make this heading bold" or "Update this list item" |

### rewrite_resource vs. block_edit

| Feature | rewrite_resource | block_edit with Portable Text |
|---------|-----------------|------------------------------|
| **Best for** | Complete file rewrites | Targeted structural changes |
| **Scope** | Entire resource | Specific blocks or elements |
| **Risk** | High (replaces everything) | Lower (targeted changes) |
| **Structure** | Recreates from scratch | Preserves existing structure |
| **Ideal use case** | "Create a new config file" | "Rearrange these sections" |

**Recommendation:** Keep all three tools, with clear guidance on when to use each:
- **search_and_replace:** For text files, code, and pattern-based replacements
- **rewrite_resource:** For creating new files or complete rewrites
- **block_edit:** For structured editing of rich documents using Portable Text

## Service-Specific Adapters

Implementations would convert between service-specific formats and Portable Text:

### Notion Adapter

```typescript
class NotionBlockAccessor extends NotionResourceAccessor implements BlockResourceAccessor {
  async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
    // Get Notion blocks
    const notionBlocks = await this.getNotionBlocks(resourceUri);
    // Convert to Portable Text
    return this.convertToPortableText(notionBlocks);
  }
  
  async applyPortableTextOperations(
    resourceUri: string, 
    operations: PortableTextOperation[]
  ): Promise<PortableTextOperationResult[]> {
    // Get current Portable Text
    const currentBlocks = await this.getDocumentAsPortableText(resourceUri);
    
    // Apply operations to Portable Text
    const { updatedBlocks, results } = this.applyOperationsToPortableText(
      currentBlocks, 
      operations
    );
    
    // Convert back to Notion format
    const notionBlocks = this.convertFromPortableText(updatedBlocks);
    
    // Update Notion
    await this.updateNotionBlocks(resourceUri, notionBlocks);
    
    return results;
  }
  
  // Conversion methods
  convertToPortableText(notionBlocks: any[]): PortableTextBlock[] {
    return notionBlocks.map(block => {
      // Example conversion from Notion block to Portable Text
      if (block.type === "paragraph") {
        return {
          _type: "block",
          _key: block.id,
          style: "normal",
          children: block.paragraph.rich_text.map(text => ({
            _type: "span",
            text: text.plain_text,
            marks: this.convertNotionAnnotationsToMarks(text.annotations)
          }))
        };
      }
      // Handle other block types
    });
  }
  
  convertFromPortableText(blocks: PortableTextBlock[]): any[] {
    // Convert Portable Text back to Notion blocks
  }
}
```

### Google Docs Adapter

```typescript
class GoogleDocsAccessor extends BBResourceAccessor implements BlockResourceAccessor {
  async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
    // Get Google Docs content
    const googleDoc = await this.getGoogleDocument(resourceUri);
    // Convert to Portable Text
    return this.convertToPortableText(googleDoc);
  }
  
  // Conversion methods
  convertToPortableText(googleDoc: any): PortableTextBlock[] {
    // Example conversion from Google Docs to Portable Text
    return googleDoc.body.content.map(item => {
      if (item.paragraph) {
        return {
          _type: "block",
          _key: item.paragraph.paragraphId,
          style: this.getParagraphStyle(item.paragraph),
          children: this.convertTextRuns(item.paragraph.elements)
        };
      }
      // Handle other element types
    });
  }
}
```

## Supported Services and Integration

### Document/Page-Based Services

- **Notion**
	- Block-based with rich text elements
	- Portable Text mapping: Direct mapping of block types
	- URI Format: `bb+notion+{connection-name}://page/{page-id}`
  
- **Google Docs**
	- Paragraph-based with formatting runs
	- Portable Text mapping: Paragraphs to blocks, text runs to spans
	- URI Format: `bb+googledocs+{connection-name}://document/{doc-id}`
  
- **Microsoft 365 (Word, OneNote)**
	- Mixed content model with rich formatting
	- Portable Text mapping: Content controls to blocks
	- URI Format: `bb+microsoft365+{connection-name}://document/{doc-id}`
  
- **Confluence**
	- Page-based with macros
	- Portable Text mapping: Macro blocks to custom block types
	- URI Format: `bb+confluence+{connection-name}://page/{page-id}`

### Database/Tabular Services

Structured data services would use the structured_data_edit tool instead of block_edit with Portable Text.

## Integration with Current Architecture

### Block Edit Tool Implementation

Implementing the block_edit tool within the current architecture:

```typescript
class BlockEditTool extends BaseTool {
  async execute(params: BlockEditParams): Promise<ToolResult> {
    const { dataSourceId, resourcePath, operations } = params;
    
    // Get data source connection
    const dataSource = await this.getDataSource(dataSourceId);
    
    // Get resource accessor for this source
    const accessor = this.dataSourceFactory.getAccessor(dataSource);
    
    // Check if accessor supports block operations
    if (!accessor.hasCapability('blockEdit')) {
      throw new Error(`Data source ${dataSource.name} does not support block editing`);
    }
    
    // Cast to block-capable accessor
    const blockAccessor = accessor as unknown as BlockResourceAccessor;
    
    // Apply operations
    const results = await blockAccessor.applyPortableTextOperations(resourcePath, operations);
    
    return {
      success: true,
      results,
      resourceUpdated: {
        path: resourcePath,
        lastModified: new Date().toISOString(),
        revision: generateRevisionId()
      }
    };
  }
}
```

### Provider Enhancement

Enhancing existing DataSourceProvider implementations to support Portable Text operations:

```typescript
class NotionProvider extends BBDataSourceProvider {
  constructor() {
    super({
      id: 'notion',
      name: 'Notion',
      description: 'Access and edit Notion pages and databases',
      capabilities: [
        'read', 'list', 'search',
        // Add block capabilities
        'blockRead', 'blockEdit'
      ],
      // Other properties
    });
  }
  
  createAccessor(connection: DataSourceConnection): ResourceAccessor {
    return new NotionBlockAccessor(connection);
  }
}
```

## Additional Core Tools for Project Assistant

Beyond content manipulation, BB should include specialized tools with clear interaction patterns between the LLM and the tool. Each tool has a distinct flow of information that determines whether the tool primarily provides data TO the LLM, receives content FROM the LLM, or involves balanced bidirectional interaction.

### Tools Primarily Providing Data TO the LLM (Tool → LLM)

These tools perform complex analysis or data gathering and return rich information that the LLM then interprets, synthesizes, and explains to the user.

#### Repository Structure Analyzer Tool
- **Tool Action**: Scans project directories to generate dependency graphs, import/export relationships, and file type distributions
- **Input from LLM**: Scope parameters, specific metrics to analyze
- **Output to LLM**: Comprehensive structural data for interpretation
- **Interaction Flow**:
  ```
  LLM: "I need to understand the dependency structure of the src/api directory"
  Tool Call: analyze_repository_structure --path=src/api --analysis-type=dependencies --depth=3
  Tool Response: {
    "modules": 24,
    "circularDependencies": [
      {"path": ["auth.ts", "user.ts", "permissions.ts", "auth.ts"]},
      ...
    ],
    "mostDependedOn": ["utils.ts", "types.ts", "config.ts"],
    "dependencyGraph": {...}
  }
  LLM: [Analyzes data] "I've examined your code structure and found several issues..."
  ```

#### Code Pattern Detector Tool
- **Tool Action**: Performs static analysis to identify code patterns, anti-patterns, complexity metrics, and potential issues
- **Input from LLM**: Analysis scope, rule sets to apply
- **Output to LLM**: Detailed findings with locations and severity levels
- **Interaction Flow**:
  ```
  LLM: "Let's check your authentication module for security issues"
  Tool Call: detect_code_patterns --path=src/auth/ --rules=security-best-practices,input-validation
  Tool Response: {
    "issues": [
      {
        "severity": "critical",
        "pattern": "unvalidated-input",
        "location": "src/auth/login.ts:47",
        "description": "User input passed directly to SQL query"
      },
      ...
    ]
  }
  LLM: [Analyzes results] "I found 3 critical security vulnerabilities you should address..."
  ```

#### Dependency Analyzer Tool
- **Tool Action**: Scans package files to identify outdated, vulnerable, or unused dependencies
- **Input from LLM**: Analysis parameters, depth of vulnerability checking
- **Output to LLM**: Comprehensive dependency status information
- **Interaction Flow**:
  ```
  LLM: "Let's check your project dependencies for security vulnerabilities and outdated packages"
  Tool Call: analyze_dependencies --package-file=package.json --check-vulnerabilities=true
  Tool Response: {
    "outdatedDependencies": [
      {"name": "react", "current": "17.0.2", "latest": "18.2.0", "breaking": true},
      ...
    ],
    "vulnerabilities": [
      {"package": "node-fetch", "severity": "high", "cveId": "CVE-2022-0235"},
      ...
    ],
    "unusedDependencies": ["unused-lib", "legacy-tool"]
  }
  LLM: [Analyzes data] "Your project has 5 packages with security vulnerabilities that need immediate attention..."
  ```

#### Semantic Search Tool
- **Tool Action**: Performs vector-based searches across multiple data sources using embeddings
- **Input from LLM**: Search query parameters, context requirements
- **Output to LLM**: Ranked results with content snippets and relevance scores
- **Interaction Flow**:
  ```
  LLM: "I need to find how authentication is implemented across the codebase"
  Tool Call: semantic_search --query="authentication implementation" --context-depth=medium --data-sources=all
  Tool Response: {
    "results": [
      {
        "resource": "src/auth/authenticator.ts",
        "score": 0.92,
        "snippet": "class Authenticator implements AuthProvider {
  authenticate(credentials: UserCredentials): Promise<AuthResult> {...}",
        "lineNumbers": [45, 68]
      },
      ...
    ]
  }
  LLM: [Analyzes results] "I found the main authentication implementation in src/auth/authenticator.ts..."
  ```

#### Release Notes Compiler Tool
- **Tool Action**: Gathers commit logs, closed issues, and pull requests to compile release data
- **Input from LLM**: Version range parameters, categorization preferences
- **Output to LLM**: Structured history of changes for summarization
- **Interaction Flow**:
  ```
  LLM: "Let's prepare release notes for the upcoming v2.0.0 release"
  Tool Call: compile_release_notes --from-tag=v1.8.0 --to=HEAD --categorize=true
  Tool Response: {
    "features": [
      {"commit": "abc123", "title": "Add SSO login option", "pr": 345, "author": "dev1"},
      ...
    ],
    "bugfixes": [...],
    "breaking": [...]
  }
  LLM: [Organizes and summarizes] "Based on the commit history, here's a comprehensive release notes draft..."
  ```

#### Status Report Generator Tool
- **Tool Action**: Compiles project metrics, recent activities, and milestone progress data
- **Input from LLM**: Reporting period, desired metrics
- **Output to LLM**: Raw project statistics and activity data
- **Interaction Flow**:
  ```
  LLM: "Let's generate a monthly status report for May 2025"
  Tool Call: generate_status_report --period="2025-05" --metrics=burndown,velocity,issues
  Tool Response: {
    "completedTasks": 37,
    "openIssues": 15,
    "burndownData": [...],
    "milestoneProgress": {
      "Beta Release": "72%",
      ...
    },
    "recentActivity": [...]
  }
  LLM: [Analyzes and summarizes] "Here's a summary of the project status for May 2025..."
  ```

#### Market Research Compiler Tool
- **Tool Action**: Gathers data from specified sources and compiles it into structured datasets
- **Input from LLM**: Research topics, data sources to query
- **Output to LLM**: Comprehensive market/competitive data for analysis
- **Interaction Flow**:
  ```
  LLM: "I need to research competitors in the authentication space"
  Tool Call: compile_market_research --products="authentication-services" --sources=crunchbase,g2crowd
  Tool Response: {
    "competitors": [
      {"name": "Auth0", "fundingTotal": "$213M", "keyFeatures": [...]},
      {"name": "Okta", "marketShare": "28%", "keyFeatures": [...]},
      ...
    ],
    "marketSize": "$15.3B",
    "growthRate": "14.5% CAGR"
  }
  LLM: [Analyzes data] "Based on the market research, here's how the authentication landscape looks..."
  ```

#### Design System Consistency Tool
- **Tool Action**: Scans UI code to identify inconsistencies in component usage, styling variables, and patterns
- **Input from LLM**: Component scope, rules to check against
- **Output to LLM**: Detailed consistency issues and violations
- **Interaction Flow**:
  ```
  LLM: "Let's check if your UI components follow the design system guidelines"
  Tool Call: check_design_consistency --components=src/ui/ --against=design-system.json
  Tool Response: {
    "inconsistencies": [
      {"component": "Button", "issue": "Non-standard color value", "location": "src/ui/custom/SpecialButton.tsx"},
      {"component": "Input", "issue": "Invalid padding value", "location": "src/ui/forms/SearchInput.tsx"},
      ...
    ],
    "unusedComponents": [...],
    "complianceScore": "78%"
  }
  LLM: [Analyzes findings] "I identified several design inconsistencies in your UI components..."
  ```

#### Requirements Extraction Tool
- **Tool Action**: Parses project documents, meeting notes, and communications to extract potential requirements
- **Input from LLM**: Document sources to analyze, extraction parameters
- **Output to LLM**: Structured requirements data for refinement and organization
- **Interaction Flow**:
  ```
  LLM: "Let's extract requirements from the project specification documents"
  Tool Call: extract_requirements --from=docs/specifications/ --from=meeting-notes/2025-05/
  Tool Response: {
    "functional": [
      {"id": "FR-001", "description": "System shall authenticate users via username/password", "source": "docs/specifications/auth.md:15"},
      ...
    ],
    "non-functional": [...],
    "ambiguous": [...]
  }
  LLM: [Analyzes and organizes] "I've identified and organized 27 distinct requirements from your documentation..."
  ```

### Tools Primarily Receiving Content FROM the LLM (LLM → Tool)

These tools primarily execute actions based on content the LLM has generated, with minimal return data beyond success/failure status.

#### Documentation Generation Tool
- **Tool Action**: Creates or updates documentation files in the correct format/location
- **Input from LLM**: Complete documentation content, format specifications
- **Output to LLM**: Simple success/failure status, file location information
- **Interaction Flow**:
  ```
  LLM: [Analyzes code] "Your authentication module needs documentation"
  LLM: [Generates complete documentation content]
  Tool Call: generate_documentation --content="# Authentication Module

This module provides..." --format=markdown --output=docs/auth.md
  Tool Response: { "success": true, "path": "docs/auth.md" }
  LLM: "I've created comprehensive documentation for your authentication module at docs/auth.md"
  ```

#### Test Scaffold Generator Tool
- **Tool Action**: Creates test file templates with structure, imports, and setup code
- **Input from LLM**: Complete test specifications, including test cases
- **Output to LLM**: Simple success/failure status, file location information
- **Interaction Flow**:
  ```
  LLM: [Analyzes component code]
  LLM: [Determines appropriate test cases]
  Tool Call: generate_test_scaffold --content="import { render, screen } from '@testing-library/react';
...
describe('Button component', () => {
  test('renders correctly', () => {...});
  test('handles click events', () => {...});
});" --output=__tests__/Button.test.tsx
  Tool Response: { "success": true, "path": "__tests__/Button.test.tsx" }
  LLM: "I've created a test suite for your Button component with tests for rendering and click handling"
  ```

#### Task Tracking Integration Tool
- **Tool Action**: Creates, updates, or closes tasks in external tracking systems
- **Input from LLM**: Complete task details including title, description, and metadata
- **Output to LLM**: Task creation confirmation, ID/URL for reference
- **Interaction Flow**:
  ```
  LLM: [Analyzes project needs]
  LLM: [Drafts comprehensive task description]
  Tool Call: create_task --system=github --title="Implement SSO authentication" --description="As a user, I want to log in with my Google account so that I don't need to create a new password.

Acceptance Criteria:
1. Login page shows 'Sign in with Google' button
2. ..." --labels=feature,auth --assignee=dev1
  Tool Response: { "success": true, "taskId": "#123", "url": "https://github.com/org/repo/issues/123" }
  LLM: "I've created a new task for implementing SSO authentication (Issue #123)"
  ```

#### Meeting Artifacts Tool
- **Tool Action**: Creates, updates, or retrieves meeting documents in appropriate locations
- **Input from LLM**: Complete meeting document content (agenda, minutes, etc.)
- **Output to LLM**: Simple success/failure status, document location information
- **Interaction Flow**:
  ```
  LLM: [Drafts comprehensive meeting agenda based on project context]
  Tool Call: create_meeting_document --type=agenda --content="# Sprint Planning Meeting

## Objectives
- Review completed work from Sprint 12
- Plan work for Sprint 13
- Address blockers

## Agenda Items
1. Sprint 12 Demo (30m)
..." --output=docs/meetings/sprint-13-planning.md
  Tool Response: { "success": true, "path": "docs/meetings/sprint-13-planning.md" }
  LLM: "I've created a detailed agenda for your Sprint Planning meeting"
  ```

#### Milestone Generator Tool
- **Tool Action**: Creates or updates project milestones and timelines in specific formats or systems
- **Input from LLM**: Complete milestone specifications, including dependencies and dates
- **Output to LLM**: Milestone creation confirmation, ID/URL for reference
- **Interaction Flow**:
  ```
  LLM: [Analyzes project scope and requirements]
  LLM: [Determines appropriate milestones and timelines]
  Tool Call: generate_milestone --name="Beta Release" --description="Initial beta release with core features complete" --target-date=2025-07-01 --dependencies=tasks:123,456,789 --deliverables="Functional authentication system,User profile management,Basic reporting"
  Tool Response: { "success": true, "milestoneId": "M-007", "url": "https://project.tool/milestones/M-007" }
  LLM: "I've set up the Beta Release milestone for July 1st, 2025, with all the key deliverables"
  ```

### Tools with Balanced Bidirectional Flow (LLM ↔ Tool)

These tools involve significant input from the LLM to configure the operation, then return meaningful data that the LLM must further analyze or transform, creating a more balanced interaction.

#### Team Assignment Tool
- **Tool Action**: Manages role and task assignments in project systems
- **Input from LLM**: Assignment strategy, team member selection
- **Output to LLM**: Current workload data, assignment confirmations, and conflicts
- **Interaction Flow**:
  ```
  LLM: "Let's assign tasks for the upcoming sprint"
  Tool Call: get_team_workload --team=engineering --period="2025-Sprint-12"
  Tool Response: {
    "members": [
      {"name": "Alice", "currentLoad": "70%", "skills": ["frontend", "react"]},
      {"name": "Bob", "currentLoad": "90%", "skills": ["backend", "database"]},
      ...
    ],
    "unassignedTasks": [...]
  }
  LLM: [Analyzes workload and determines optimal assignments]
  Tool Call: assign_tasks --sprint="2025-Sprint-12" --assignments="[{"task":123,"assignee":"Alice"}, ...]"
  Tool Response: {
    "successful": [{"task": 123, "assignee": "Alice"}],
    "failed": [],
    "warnings": [{"task": 456, "assignee": "Bob", "reason": "High workload"}]
  }
  LLM: "I've assigned tasks for Sprint 12, but noted that Bob is overloaded. Would you like me to reassign some of his tasks?"
  ```

This comprehensive breakdown demonstrates the variety of interaction patterns across different tool types, showing how each tool serves a specific purpose in the BB ecosystem with a clear definition of what the tool does versus what the LLM contributes.

## Comparison with Current Tools

The current tools provide good foundational capabilities but lack some higher-level functionalities:

- **Repository Analysis:** Current tools like `load_datasource` and `search_project` handle basic discovery but don't analyze relationships or dependencies

- **Search & Context:** Current `search_project` is pattern-based rather than semantic and doesn't unify across multiple data sources

- **Documentation Generation:** No dedicated tool exists for automatic documentation generation

## Conclusion

Extending BB's robust data source architecture with Portable Text as the standard format for rich document editing provides several key benefits:

1. **Consistent editing experience** across diverse document formats
2. **Structure preservation** when modifying complex documents
3. **Format-aware editing** that respects the native capabilities of each platform
4. **Simplified AI interaction** with a uniform, LLM-friendly model
5. **Strong foundation** using a mature, well-designed specification

The recommended approach:

1. **Extend the existing architecture** rather than replacing it:
   - Add Portable Text-based interfaces to the current ResourceAccessor pattern
   - Implement service-specific adapters for each supported platform
   - Maintain the BB-managed vs. MCP-managed distinction

2. **Maintain specialized tools** for different content types:
   - Keep text-based tools: search_and_replace, rewrite_resource
   - Add block-based tool: block_edit with Portable Text
   - Add tabular tool: structured_data_edit

This approach offers the ideal balance of consistency, flexibility, and implementation feasibility.

---

## Addendum: Rich Text Editors vs. Structured Content Formats

During the research for this document, several editor frameworks and content models were evaluated. This addendum explains why rich text editors are not suitable for BB's needs and why Portable Text is the recommended approach.

### Evaluated Editor Frameworks

1. **Slate.js**
   - Browser-based rich text editor framework
   - Uses React for rendering
   - Customizable document model
   - Primarily focused on interactive editing

2. **ProseMirror**
   - Toolkit for building rich text editors
   - Schema-based document representation
   - Focus on collaborative editing
   - Requires DOM for rendering

3. **Lexical**
   - Facebook's editor framework
   - React-based with TypeScript support
   - Extensible node system
   - Designed for browser environments

4. **Draft.js**
   - React-based editor framework
   - ContentState model for documents
   - Immutable.js data structures
   - Heavy browser dependency

### Why Editor Frameworks Are Not Suitable for BB

1. **Browser/DOM Dependencies**
   - Most editor frameworks require a browser environment
   - BB operates in a server-side Node.js/Deno context
   - Unnecessary rendering overhead

2. **User Interaction Focus**
   - Designed for capturing keystrokes, selections, etc.
   - BB performs programmatic edits, not interactive ones
   - Complex event systems are irrelevant

3. **UI Component Coupling**
   - Tightly coupled with UI rendering libraries (React, etc.)
   - BB doesn't need rendering capabilities
   - Difficult to separate model from view

4. **Heavy Dependencies**
   - Large bundle sizes and dependency trees
   - Performance overhead for unused features
   - Complexity not aligned with BB's needs

### Why Portable Text Is Ideal for BB

1. **Pure Data Format**
   - No UI components or rendering dependencies
   - Simple JSON structure without browser requirements
   - Clean separation of content from presentation

2. **Designed for System-to-System Exchange**
   - Created specifically for content interchange
   - Format agnostic to input and output methods
   - Perfect for BB's programmatic editing

3. **LLM-Friendly Structure**
   - Clear, consistent JSON format
   - Explicit typing of content elements
   - Easy for AI to understand and generate

4. **Minimal Yet Complete**
   - Covers essential rich text needs without bloat
   - Extensible for service-specific features
   - Focused on content structure, not editing experience

5. **Established Ecosystem**
   - Mature specification with documentation
   - Existing conversion utilities
   - Production-proven in headless CMS contexts

### Other Considered Approaches

1. **Custom JSON Format**
   - Would require designing a new specification
   - Reinventing solutions to solved problems
   - No existing ecosystem or tools

2. **Markdown-Based Approach**
   - Limited formatting capabilities
   - Difficult to represent complex structures
   - Loss of specific formatting details

3. **Service-Specific Formats**
   - No consistency across services
   - Complex translation between formats
   - Higher maintenance burden

Portable Text offers the optimal balance of simplicity, capability, and implementation feasibility for BB's non-visual, programmatic document editing needs.