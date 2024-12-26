# BB Graph Library Design

## Overview
The BB Graph Library provides core graph generation capabilities that can be used by various components of the BB system. The library focuses on graph definition, rendering, and customization, while leaving specific data handling to the consumers.

## Library Design

### 1. Core Types

```typescript
interface GraphDefinition {
  // The graph content in the specified format
  content: string;
  
  // The format of the graph definition
  format: GraphFormat;
  
  // Optional metadata about the graph
  metadata?: {
    title?: string;
    description?: string;
    dataSource?: string;
    timestamp?: string;
  };
}

type GraphFormat = 'mermaid' | 'plantuml' | 'dot';

interface RenderOptions {
  // Output format for the rendered graph
  outputFormat: 'svg' | 'png';
  
  // Styling configuration
  theme?: ThemeConfig;
  
  // Size constraints
  maxWidth?: number;
  maxHeight?: number;
  
  // Accessibility options
  accessibility?: {
    ariaLabel?: string;
    role?: string;
    description?: string;
  };
}

interface ThemeConfig {
  // Basic styling
  fontFamily?: string;
  fontSize?: string;
  backgroundColor?: string;
  
  // Color schemes
  colors?: string[];
  
  // Format-specific options
  mermaid?: {
    theme?: 'default' | 'forest' | 'dark' | 'neutral';
    themeVariables?: Record<string, string>;
  };
  
  plantuml?: {
    skinparam?: Record<string, string>;
  };
  
  dot?: {
    graphAttributes?: Record<string, string>;
  };
}

interface RenderResult {
  // The rendered graph content
  content: string;
  
  // The format of the rendered content
  format: 'svg' | 'png';
  
  // Metadata about the rendering
  metadata: {
    width: number;
    height: number;
    timestamp: string;
    renderTime: number;
  };
}
```

### 2. Core Functions

```typescript
class BBGraphLibrary {
  /**
   * Validates a graph definition
   */
  async validateDefinition(def: GraphDefinition): Promise<boolean>;
  
  /**
   * Renders a graph according to the specified options
   */
  async renderGraph(
    def: GraphDefinition,
    options: RenderOptions
  ): Promise<RenderResult>;
  
  /**
   * Provides information about supported formats and features
   */
  getCapabilities(): {
    formats: GraphFormat[];
    outputFormats: ('svg' | 'png')[];
    features: string[];
  };
}

// Helper functions for common graph types
export const graphHelpers = {
  /**
   * Creates a time series graph definition
   */
  createTimeSeriesGraph(data: {
    labels: string[];
    series: Array<{
      name: string;
      values: number[];
    }>;
    options?: {
      title?: string;
      yAxisLabel?: string;
      xAxisLabel?: string;
    };
  }): GraphDefinition;

  /**
   * Creates a pie chart definition
   */
  createPieChart(data: {
    segments: Array<{
      label: string;
      value: number;
    }>;
    options?: {
      title?: string;
      showPercentages?: boolean;
    };
  }): GraphDefinition;

  /**
   * Creates a flowchart definition
   */
  createFlowchart(data: {
    nodes: Array<{
      id: string;
      label: string;
      type?: 'start' | 'end' | 'process' | 'decision';
    }>;
    edges: Array<{
      from: string;
      to: string;
      label?: string;
    }>;
    options?: {
      direction?: 'LR' | 'TB';
      title?: string;
    };
  }): GraphDefinition;
}
```

### 3. Format-Specific Handlers

```typescript
interface FormatHandler {
  // Validates format-specific syntax
  validate(content: string): Promise<boolean>;
  
  // Renders the graph in the specified format
  render(content: string, options: RenderOptions): Promise<RenderResult>;
  
  // Returns format-specific capabilities
  getCapabilities(): {
    features: string[];
    limitations?: string[];
    maxSize?: { width: number; height: number };
  };
}

class MermaidHandler implements FormatHandler {
  // Mermaid-specific implementation
}

class PlantUMLHandler implements FormatHandler {
  // PlantUML-specific implementation
}

class DotHandler implements FormatHandler {
  // Graphviz DOT-specific implementation
}
```

### 4. Usage Examples

#### 4.1 Basic Graph Generation
```typescript
const library = new BBGraphLibrary();

// Create and render a time series graph
const timeSeriesData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  series: [{
    name: 'Total Tokens',
    values: [1000, 1200, 950, 1400, 1300]
  }],
  options: {
    title: 'Monthly Token Usage',
    yAxisLabel: 'Tokens'
  }
};

const def = graphHelpers.createTimeSeriesGraph(timeSeriesData);
const result = await library.renderGraph(def, {
  outputFormat: 'svg',
  theme: {
    colors: ['#4CAF50'],
    fontFamily: 'Arial'
  }
});
```

#### 4.2 Custom Mermaid Graph
```typescript
const customDef: GraphDefinition = {
  content: `
    gantt
      title Project Timeline
      dateFormat YYYY-MM-DD
      section Phase 1
        Task 1: 2024-01-01, 30d
        Task 2: 2024-01-15, 45d
      section Phase 2
        Task 3: 2024-03-01, 60d
  `,
  format: 'mermaid',
  metadata: {
    title: 'Project Timeline',
    description: 'Gantt chart showing project phases'
  }
};

const result = await library.renderGraph(customDef, {
  outputFormat: 'svg',
  theme: {
    mermaid: {
      theme: 'neutral'
    }
  }
});
```

### 5. Integration Points

#### 5.1 Tool Integration
```typescript
// graph_rendering tool using the library
const tool: LLMToolDefinition = {
  name: 'graph_rendering',
  async run(def: GraphDefinition, options: RenderOptions): Promise<LLMToolRunResult> {
    const library = new BBGraphLibrary();
    const result = await library.renderGraph(def, options);
    return {
      success: true,
      result: result.content
    };
  }
};
```

#### 5.2 API Integration
```typescript
// API endpoint using the library
router.post('/api/v1/graphs', async (ctx) => {
  const library = new BBGraphLibrary();
  const { definition, options } = await ctx.request.body();
  const result = await library.renderGraph(definition, options);
  ctx.response.body = result;
});
```

#### 5.3 Metrics Integration
```typescript
// Token usage metrics using the library
async function generateTokenUsageGraphs(metrics: TokenMetrics): Promise<GraphResult[]> {
  const library = new BBGraphLibrary();
  
  // Generate time series
  const timeSeriesDef = graphHelpers.createTimeSeriesGraph({
    labels: metrics.timestamps,
    series: [{
      name: 'Token Usage',
      values: metrics.usage
    }]
  });
  
  // Generate pie chart
  const pieChartDef = graphHelpers.createPieChart({
    segments: Object.entries(metrics.byRole).map(([role, value]) => ({
      label: role,
      value
    }))
  });
  
  return Promise.all([
    library.renderGraph(timeSeriesDef, { outputFormat: 'svg' }),
    library.renderGraph(pieChartDef, { outputFormat: 'svg' })
  ]);
}
```

## Implementation Plan

### Phase 1: Core Library
1. Implement basic types and interfaces
2. Create Mermaid handler
3. Add graph helper functions
4. Add basic validation

### Phase 2: Enhanced Features
1. Add PNG output support
2. Add theme customization
3. Add accessibility features
4. Add error handling

### Phase 3: Additional Formats
1. Add PlantUML support
2. Add Graphviz DOT support
3. Add format-specific optimizations
4. Add format conversion utilities

## Testing Requirements

### 1. Unit Tests
- Test graph definition validation
- Test rendering functions
- Test theme application
- Test helper functions

### 2. Integration Tests
- Test format handlers
- Test error handling
- Test large graphs
- Test theme inheritance

### 3. Performance Tests
- Test rendering speed
- Test memory usage
- Test concurrent rendering
- Test large dataset handling

## Next Steps

1. Create core library structure
   - Define interfaces
   - Create base classes
   - Add type definitions
   - Set up testing framework

2. Implement Mermaid support
   - Add Mermaid handler
   - Create helper functions
   - Add validation
   - Add tests

3. Create integration examples
   - Add tool integration
   - Add API integration
   - Add metrics integration
   - Add documentation