# BB Tool Development Guidelines

This document outlines the guidelines and best practices for developing tools for BB. These guidelines help ensure tools are safe, reliable, and beneficial to the BB community.

## Table of Contents

1. [Responsible AI Practices](#responsible-ai-practices)
2. [Security Considerations](#security-considerations)
3. [Tool Development Examples](#tool-development-examples)
4. [Naming and Categorization](#naming-and-categorization)
5. [Community Standards](#community-standards)
6. [Reporting Tools](#reporting-tools)
7. [Revocation Guidelines](#revocation-guidelines)

## Responsible AI Practices

When developing tools that will be used autonomously by LLMs, consider:

### 1. Transparency
- Clearly document tool capabilities and limitations
- Explain potential risks in tool descriptions
- Document all parameters and their effects
- Provide clear error messages

### 2. Safety First
- Implement strict input validation
- Add appropriate guardrails
- Limit tool scope to necessary functionality
- Consider unintended uses

### 3. User Control
- Provide configuration options for limiting tool capabilities
- Allow users to disable dangerous features
- Implement rate limiting where appropriate
- Log important actions for review

### 4. Privacy
- Minimize data collection
- Handle sensitive data appropriately
- Document data usage clearly
- Implement data cleanup

## Security Considerations

### Potential Dangers

Tools can pose risks because they are used autonomously by LLMs without human oversight:

1. Computer System Risks:
   - Unauthorized file modifications
   - System command execution
   - Resource exhaustion
   - Network access abuse

2. Real-World Risks:
   - Unauthorized financial transactions
   - Exposure of private information
   - IoT device control (e.g., smart home systems)
   - Unauthorized communications
   - Purchase of goods or services
   - Access to protected accounts

### Implementing Guardrails

1. Input Validation:
   ```typescript
   // Good: Strict input schema with clear constraints
   get inputSchema() {
     return {
       type: "object",
       properties: {
         amount: {
           type: "number",
           minimum: 0,
           maximum: 1000
         },
         description: {
           type: "string",
           maxLength: 100,
           pattern: "^[a-zA-Z0-9\\s]+$"
         }
       },
       required: ["amount", "description"]
     };
   }
   ```

2. Clear Tool Descriptions:
   ```typescript
   // Good: Clear description helps LLM understand limitations
   constructor() {
     super(
       "payment_tool",
       "Process payments up to $1000. Requires pre-approved merchant list. " +
       "Will not process payments to unknown recipients. " +
       "All transactions are logged and require confirmation."
     );
   }
   ```

3. Resource Boundaries:
   ```typescript
   // Good: Check file operations are within project
   if (!projectEditor.isPathWithinDataSource(filePath)) {
     throw new Error("File operations must be within project directory");
   }
   ```

4. Action Logging:
   ```typescript
   // Good: Log important actions
   logger.info(`Payment processed: ${amount} to ${recipient}`);
   await this.auditLog.record({
     action: "payment",
     amount,
     recipient,
     timestamp: new Date()
   });
   ```

## Tool Development Examples

### Good Examples

1. File Search Tool:
   ```typescript
   // Good practices:
   // - Clear input validation
   // - Project boundary checking
   // - Resource limits
   // - Clear error messages
   export class LLMToolSearchFiles extends LLMTool {
     get inputSchema() {
       return {
         type: "object",
         properties: {
           pattern: {
             type: "string",
             maxLength: 100
           },
           maxResults: {
             type: "number",
             minimum: 1,
             maximum: 1000
           }
         }
       };
     }

     async runTool(
       interaction: IConversationInteraction,
       toolUse: LLMAnswerToolUse,
       projectEditor: IProjectEditor
     ): Promise<LLMToolRunResult> {
       const { pattern, maxResults } = toolUse.toolInput;
       
       // Validate search is within project
       if (!projectEditor.isPathWithinDataSource(searchPath)) {
         throw new Error("Search must be within project directory");
       }

       // Implement search with limits
       const results = await this.searchWithTimeout(
         pattern,
         maxResults,
         5000 // timeout
       );

       return {
         toolResults: results,
         toolResponse: `Found ${results.length} matches`,
         bbResponse: { success: true, data: results }
       };
     }
   }
   ```

2. Network Request Tool:
   ```typescript
   // Good practices:
   // - URL validation
   // - Rate limiting
   // - Timeout handling
   // - Response size limits
   export class LLMToolHttpRequest extends LLMTool {
     private rateLimiter = new RateLimiter(10, "minute");
     
     get inputSchema() {
       return {
         type: "object",
         properties: {
           url: {
             type: "string",
             format: "uri",
             pattern: "^https?://"
           },
           method: {
             type: "string",
             enum: ["GET", "POST"]
           }
         }
       };
     }

     async runTool(...): Promise<LLMToolRunResult> {
       await this.rateLimiter.checkLimit();
       
       const response = await fetch(url, {
         signal: AbortSignal.timeout(5000),
         size: 1024 * 1024 // 1MB limit
       });

       return { /* ... */ };
     }
   }
   ```

### Problematic Examples

1. Unsafe File Operations:
   ```typescript
   // Bad: No path validation
   // Bad: No content validation
   // Bad: No error handling
   export class LLMToolUnsafeFile extends LLMTool {
     async runTool(...): Promise<LLMToolRunResult> {
       const { path, content } = toolUse.toolInput;
       await Deno.writeFile(path, content);
       return { /* ... */ };
     }
   }
   ```

2. Dangerous System Access:
   ```typescript
   // Bad: Unrestricted command execution
   // Bad: No input sanitization
   // Bad: No timeout
   export class LLMToolUnsafeExec extends LLMTool {
     async runTool(...): Promise<LLMToolRunResult> {
       const { command } = toolUse.toolInput;
       const output = await Deno.run({ cmd: command.split(" ") });
       return { /* ... */ };
     }
   }
   ```

## Naming and Categorization

### Tool Naming

1. Class Names:
   - Must start with `LLMTool` prefix
   - Use PascalCase
   - Be descriptive
   - Examples:
     * `LLMToolFileSearch`
     * `LLMToolHttpRequest`
     * `LLMToolGitCommit`

2. Directory Names:
   - Must end with `.tool`
   - Use kebab-case
   - Match functionality
   - Examples:
     * `file-search.tool`
     * `http-request.tool`
     * `git-commit.tool`

### Categories

Tools should be categorized into one of these groups:

1. File Operations
   - File reading/writing
   - Search and replace
   - File organization
   - Example: `file-search.tool`

2. Code Analysis
   - Static analysis
   - Code quality checks
   - Dependency analysis
   - Example: `code-metrics.tool`

3. Documentation
   - Doc generation
   - Format conversion
   - Example: `markdown-convert.tool`

4. Project Management
   - Task tracking
   - Progress monitoring
   - Example: `project-status.tool`

5. Integration
   - External services
   - APIs
   - Example: `github-api.tool`

6. Utility
   - Helper functions
   - Data processing
   - Example: `text-transform.tool`

## Community Standards

1. Code Quality
   - Write clear, maintainable code
   - Include comprehensive tests
   - Follow BB coding style
   - Document thoroughly

2. Documentation
   - Clear usage instructions
   - Complete parameter docs
   - Example usage
   - Error handling guide

3. Support
   - Respond to issues
   - Fix security problems
   - Update for compatibility
   - Accept feedback

4. Collaboration
   - Be respectful
   - Help other developers
   - Share improvements
   - Credit sources

## Reporting Tools

If you encounter a tool that:
- Violates these guidelines
- Contains security issues
- Performs harmful actions
- Is poorly implemented

Report it by:
1. Opening an issue on the tool's repository
2. Emailing security@beyondbetter.app
3. Using the report form (coming soon)

Include:
- Tool name and version
- Description of the problem
- Steps to reproduce
- Potential impact
- Supporting evidence

## Revocation Guidelines

Tools may be revoked from the BB Tool Library if they:

1. Security Issues:
   - Contain vulnerabilities
   - Lack proper safeguards
   - Enable unauthorized access
   - Expose sensitive data

2. Quality Issues:
   - Frequent errors
   - Poor performance
   - Inadequate documentation
   - Lack of maintenance

3. Community Guidelines:
   - Harmful behavior
   - Malicious code
   - Copyright violations
   - Misleading descriptions

4. Technical Requirements:
   - Breaking changes
   - Incompatible updates
   - Resource abuse
   - API violations

The revocation process:
1. Issue identified (report or discovery)
2. Developer notified
3. Grace period for fixes (if appropriate)
4. Tool removed if not resolved
5. Users notified of removal

Developers can appeal revocations by:
1. Fixing identified issues
2. Providing evidence of fixes
3. Requesting reinstatement review
4. Committing to guidelines