# Graph Rendering Tool Design

## Overview
The graph_rendering tool provides a generic interface for generating graphs using the BB Graph Library. It allows LLMs to create visual representations of data in various formats.

## Tool Design

### 1. Tool Interface

```typescript
interface GraphRenderingInput {
  // Graph definition (passed to library)
  definition: GraphDefinition;
  
  // Rendering options
  options?: RenderOptions;
  
  // Output preferences
  output?: {
    // Where to store the rendered graph
    destination?: 'inline' | 'file';
    
    // File path if destination is 'file'
    filePath?: string;
    
    // Whether to include the graph definition in the response
    includeDefinition?: boolean;
  };
}

interface GraphRenderingResult {
  // The rendered graph content
  content: string;
  
  // Format of the rendered content
  format: 'svg' | 'png';
  
  // Original definition if requested
  definition?: GraphDefinition;
  
  // File path if saved to file
  filePath?: string;
  
  // Metadata about the rendering
  metadata: {
    width: number;
    height: number;
    renderTime: number;
  };
}
```

### 2. Tool Implementation

```typescript
export const tool: LLMToolDefinition = {
  name: 'graph_rendering',
  description: 'Generate visual graphs from data using various formats (Mermaid, PlantUML, DOT). Supports multiple graph types including flowcharts, sequence diagrams, and charts.',
  
  parameters: {
    type: 'object',
    properties: {
      definition: {
        type: 'object',
        description: 'The graph definition including content and format',
        required: ['content', 'format'],
        properties: {
          content: {
            type: 'string',
            description: 'The graph content in the specified format'
          },
          format: {
            type: 'string',
            enum: ['mermaid', 'plantuml', 'dot'],
            description: 'The format of the graph definition'
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata about the graph',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' }
            }
          }
        }
      },
      options: {
        type: 'object',
        description: 'Optional rendering configuration',
        properties: {
          outputFormat: {
            type: 'string',
            enum: ['svg', 'png'],
            default: 'svg'
          },
          theme: {
            type: 'object',
            description: 'Theme configuration for the graph'
          }
        }
      },
      output: {
        type: 'object',
        description: 'Output configuration',
        properties: {
          destination: {
            type: 'string',
            enum: ['inline', 'file'],
            default: 'inline'
          },
          filePath: {
            type: 'string',
            description: 'Path where to save the graph if destination is "file"'
          },
          includeDefinition: {
            type: 'boolean',
            default: false
          }
        }
      }
    }
  },

  async run(
    input: GraphRenderingInput,
    _projectEditor: ProjectEditor
  ): Promise<LLMToolRunResult> {
    try {
      const library = new BBGraphLibrary();
      
      // Render the graph
      const result = await library.renderGraph(
        input.definition,
        input.options ?? { outputFormat: 'svg' }
      );
      
      // Handle output
      if (input.output?.destination === 'file' && input.output.filePath) {
        await Deno.writeTextFile(input.output.filePath, result.content);
      }
      
      return {
        success: true,
        result: {
          content: result.content,
          format: result.format,
          definition: input.output?.includeDefinition ? input.definition : undefined,
          filePath: input.output?.filePath,
          metadata: result.metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to render graph: ${error.message}`
      };
    }
  }
};
```

### 3. Usage Examples

#### 3.1 Basic Graph Generation
```typescript
// LLM request to generate a simple flowchart
const result = await graph_rendering({
  definition: {
    content: `
      flowchart LR
        A[Start] --> B{Process}
        B -->|Yes| C[Done]
        B -->|No| D[Retry]
    `,
    format: 'mermaid',
    metadata: {
      title: 'Simple Process Flow'
    }
  },
  options: {
    outputFormat: 'svg',
    theme: {
      fontFamily: 'Arial'
    }
  }
});
```

#### 3.2 Save Graph to File
```typescript
// LLM request to generate and save a graph
const result = await graph_rendering({
  definition: {
    content: `
      pie title Distribution
        "A" : 50
        "B" : 30
        "C" : 20
    `,
    format: 'mermaid'
  },
  output: {
    destination: 'file',
    filePath: 'graphs/distribution.svg'
  }
});
```

### 4. Common Use Cases

#### 4.1 Data Visualization
- Generate charts from data analysis
- Create visual representations of statistics
- Plot trends and patterns

#### 4.2 Process Documentation
- Create flowcharts for procedures
- Generate sequence diagrams for interactions
- Visualize system architectures

#### 4.3 Report Generation
- Include graphs in markdown reports
- Generate visual summaries
- Create presentation materials

### 5. Integration with Other Tools

#### 5.1 Token Usage Visualization
```typescript
// Use with conversation_metrics tool
const metrics = await conversation_metrics({
  includeTokens: true,
  includeTools: true
});

const graph = await graph_rendering({
  definition: {
    content: generateTokenUsageChart(metrics.tokens),
    format: 'mermaid'
  }
});
```

#### 5.2 Project Documentation
```typescript
// Generate project structure diagram
const files = await search_project({
  filePattern: '**/*.ts'
});

const graph = await graph_rendering({
  definition: {
    content: generateProjectStructure(files),
    format: 'mermaid'
  }
});
```

## Testing Requirements

### 1. Tool-Specific Tests
- Test parameter validation
- Test output handling
- Test file writing
- Test error handling

### 2. Integration Tests
- Test with other tools
- Test in conversation flow
- Test with various graph types
- Test output formats

### 3. Error Cases
- Invalid graph definitions
- Unsupported formats
- File system errors
- Size limitations

## Next Steps

1. Implement tool structure
   - Create tool class
   - Add parameter validation
   - Add error handling
   - Set up testing

2. Add format support
   - Implement Mermaid support
   - Add output handling
   - Add file operations
   - Add tests

3. Create integration examples
   - Add usage examples
   - Create helper functions
   - Update documentation
   - Add integration tests