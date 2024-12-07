# BB Tool I/O Guide for LLMs

This document provides guidance for LLMs on handling tool input and output in BB. For technical implementation details, see [Tool I/O Reference](../reference/tool_io.md).

## Tool Usage Guidelines

When using BB tools, follow these guidelines:

1. Input Structure:
   - Always validate input against the tool's `inputSchema`
   - Provide all required parameters
   - Use optional parameters only when needed
   - Follow parameter type and format requirements

2. Output Handling:
   - Process `toolResults` for further actions
   - Consider `toolResponse` for additional context
   - Use `bbResponse` to understand system actions
   - Handle both success and error cases

3. Response Formatting:
   - Return strings for simple responses
   - Use `LLMMessageContentParts` for multiple components
   - Use `LLMMessageContentPart` for complex content (e.g., images)

## Tool Feedback Processing

When receiving tool feedback:

```
Tool results feedback:
Turn X/Y                     # Track turn usage
Conversation Goal: [text]    # Use for strategic decisions
Current Objective: [text]    # Use for immediate tasks
Tools Used: toolName(N: S✓ F✗) # Monitor tool effectiveness
[actual tool results]        # Tool output to process
```

Use this feedback to:
1. Track conversation progress
2. Maintain context hierarchy
3. Guide tool selection
4. Monitor resource usage
5. Frame responses appropriately

## Objectives System

Use the objectives system to maintain context:

1. Conversation Goal:
   - Consider for overall strategy
   - Use for long-term planning
   - Reference in strategic decisions
   - Maintain consistency across conversation

2. Statement Objectives:
   - Focus on immediate tasks
   - Guide tool selection
   - Frame current responses
   - Track progress toward goal

## Best Practices

1. Tool Selection:
   - Choose tools based on current objective
   - Consider tool success rates
   - Use appropriate tool for task
   - Combine tools effectively

2. Context Management:
   - Track conversation progress
   - Maintain objective alignment
   - Monitor resource usage
   - Handle errors gracefully

3. Response Generation:
   - Frame responses in context
   - Reference relevant objectives
   - Explain tool usage clearly
   - Provide clear next steps

4. Resource Tracking:
   - Monitor file access
   - Track URL requests
   - Note tool usage patterns
   - Manage conversation turns

## Common Patterns

1. File Operations:
   - Request files before modification
   - Verify file content
   - Handle errors appropriately
   - Update related files

2. Web Interactions:
   - Validate URLs
   - Handle response types
   - Process content appropriately
   - Consider rate limits

3. Analysis Tasks:
   - Use appropriate tools
   - Process results thoroughly
   - Maintain context
   - Provide clear summaries

4. Multi-step Operations:
   - Plan steps clearly
   - Track progress
   - Handle dependencies
   - Maintain state awareness

## Error Handling

When tools return errors:
1. Analyze error message
2. Consider retry if appropriate
3. Suggest alternatives if needed
4. Explain issues clearly
5. Maintain conversation flow

## Cross-References

For additional context, refer to:
- [Tool Documentation](../reference/tools.md)
- [File Handling](../reference/file_handling.md)
- [Conversation Management](../reference/conversation_management.md)
- [Objectives System](../reference/objectives_system.md)