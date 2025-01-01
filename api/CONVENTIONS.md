# BB API Component Conventions

## Overview
This document outlines specific conventions for the BB API component. These conventions MUST be followed in addition to the general project conventions.

## Directory Structure
```
api/
├── src/
│   ├── llms/                  # LLM integration
│   │   ├── tools/            # LLM tool implementations
│   │   ├── interactions/     # LLM interaction patterns
│   │   └── providers/        # LLM provider implementations
│   ├── routes/               # API routing
│   │   └── api/             # API endpoint routes
│   ├── storage/             # Persistence layer
│   ├── controllers/         # Business logic
│   ├── editor/             # Project editing
│   ├── middlewares/        # Oak middleware
│   ├── utils/              # Helper functions
│   └── types/              # Type definitions
├── tests/                  # Test files
└── scripts/               # Build scripts
```

## LLM Tools Implementation

### Tool Directory Structure
Each tool MUST follow this exact structure:
```
llms/tools/toolName.tool/
├── tool.ts                # Main tool implementation
├── formatter.browser.tsx  # Browser-specific formatting
├── formatter.console.ts   # Console-specific formatting
├── types.ts              # Tool-specific types
├── info.json             # Tool metadata
└── tests/                # Tool tests
    └── tool.test.ts
```

### Important Notes
1. **Tool Manifest**: The `tools_manifest.ts` file is generated at build time. DO NOT modify it directly.
2. **Reference Documentation**: Always consult:
   - `docs/development/llm/llm_instructions.md`
   - `docs/development/llm/new_tool.md`

### Tool Implementation Requirements
1. Main Tool File (tool.ts):
   - Extend `LLMTool` base class
   - Implement required methods
   - Follow error handling patterns

2. Formatters:
   - Implement both browser and console formatters
   - Follow existing formatting patterns
   - Use consistent styling

3. Types:
   - Define clear input/output types
   - Use shared types where appropriate
   - Document type constraints

4. Testing:
   - Follow test patterns in tests/
   - Include edge cases
   - Test both formatters

## Routing and Handlers

### Structure
The API uses a hierarchical routing system:
```
routes/
├── apiRouter.ts           # Main API router
└── api/                  # API endpoints
    ├── fileRouter.ts     # Grouped file operations
    ├── projectRouter.ts  # Project management
    └── *.handlers.ts     # Endpoint implementations
```

### Conventions
1. Routes (.ts files):
   - Define Oak router setup
   - Group related endpoints
   - Handle path parameters
   - Apply middleware

2. Handlers (.handlers.ts files):
   - Implement endpoint logic
   - Handle request/response
   - Process business logic
   - Call appropriate services

3. Router Hierarchy:
   - Main router (apiRouter.ts)
   - Feature routers (fileRouter.ts, etc.)
   - Individual handlers

### Example Pattern
```typescript
// routes/api/feature.handlers.ts
export async function handleFeature(ctx: Context) {
  // Implementation
}

// routes/api/featureRouter.ts
const router = new Router();
router.get("/feature", handleFeature);
```

## Storage Layer

### Current Status
The persistence layer is currently ad-hoc. Before implementing new storage features:
1. Review existing files in src/storage/
2. Follow established patterns
3. Consult team for guidance

### Key Files
- tokenUsagePersistence.ts
- projectPersistence.ts
- conversationLogger.ts
- conversationPersistence.ts

## Error Handling

1. Use Custom Error Classes:
```typescript
import { createError } from "../utils/error.utils.ts";

throw createError({
  message: "Clear error message",
  details: { additional: "info" }
});
```

2. HTTP Status Codes:
- 400: Bad Request (invalid input)
- 404: Not Found (resource missing)
- 500: Internal Server Error (unexpected)

## Type Safety

1. Use Strict TypeScript:
```typescript
// Good
interface RequestBody {
  param: string;
}

// Avoid
type RequestBody = any;
```

2. Document Complex Types:
```typescript
/**
 * Represents a tool request
 * @property name Tool identifier
 * @property params Tool parameters
 */
interface ToolRequest {
  name: string;
  params: Record<string, unknown>;
}
```

## Testing

1. Test File Location:
- Unit tests: Next to source files
- Integration tests: In tests/ directory
- Tool tests: In tool directory

2. Test Naming:
```typescript
Deno.test("feature: should handle specific case", async () => {
  // Test implementation
});
```

## Documentation

1. API Documentation:
- Use JSDoc comments
- Document all public methods
- Include example usage
- Document error cases

2. OpenAPI/Swagger:
- Document all endpoints
- Include request/response examples
- Document error responses

## Performance

1. Response Time:
- Log slow operations
- Use appropriate indexes
- Implement caching where needed

2. Resource Usage:
- Monitor memory usage
- Clean up resources
- Handle concurrent requests

## Security

1. Input Validation:
- Validate all inputs
- Sanitize file paths
- Check permissions

2. Error Messages:
- No sensitive data in errors
- User-friendly messages
- Detailed internal logging

Note: This document may be updated with additional specific conventions. Always check for the latest version before making changes.