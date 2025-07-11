# Tool Use and Tool Results Structure

This document describes the technical implementation of tool I/O in BB. For LLM-specific instructions, see [LLM Tool I/O Guide](../llm/tool_io.md).

## Tool Input

The `inputSchema` defines the structure of "tool use". The schema is the input provided by the LLM when running a tool. It's passed to `runTool` as `toolUse`. It's passed to `formatLogEntryToolUse` as `toolInput`. The 'tool use' data received from the LLM will always be validated against `inputSchema`. 

## Tool Results

This is the output from running the tool. There are three data components:

- `toolResults` - the data produced from the tool run, that is fed back to the LLM for further handling.
- `toolResponse` [optional] - the textual response describing the results of the tool run
- `bbResponse` - the textual response describing what BB has done while running the tool. 

The `toolResults` are given back to the LLM for further handling, as well as passed to the `formatLogEntryToolResult` method for display to the user in the current collaboration. The `toolResults` need to be suitable for adding to collaboration message (eg. `LLMToolRunResultContent`). 

Returning a string is most common; the string can be serialised data such as JSON or XML. Return `LLMMessageContentParts` array if there are multiple components that should be passed to the LLM separately, eg if the `inputSchema` provided an array of operations for the tool run. Return `LLMMessageContentPart` if the content part is 'complex' such as an image block. 

The `toolResults` get passed to `addMessageForToolResult` which will handle converting a string to standard message format suitable for the LLM. If `toolResults` are single `LLMMessageContentPart` or `LLMMessageContentParts` array, they will be added directly. 

The `toolResponse` is optional. It is for providing the LLM with info/metadata about the tool run, if the `toolResults` data needs further explanation. The `toolResponse` is included in the prompt/statement that is returned to the LLM as part of the tool_results messages. 

The `bbResponse` is for providing the user with info/metadata about the tool run. It is added to the collaboration via `collaborationLogger`. 

## Collaboration Logger vs LLM Message History

The collaboration logs are for displaying by BB to the user. The LLM message history is the array of messages sent to the LLM with each collaboration turn. There is a tight correlation between the two, but they are not the exact same thing. 

For example, the collaboration history can have "side" collaborations when asking for git commit message, or asking for collaboration title, or when delegating tasks such as summarizing a collaboration. The collaboration logs contain "entries" which can come from multiple LLM interactions. 

## Objectives System

BB uses a hierarchical objectives system to maintain context and guide decision-making:

1. Collaboration Goal:
   - Overall objective for the entire collaboration
   - Set when collaboration begins
   - Provides high-level context for all actions

2. Statement Objectives:
   - Specific objectives for each user statement
   - Maintained as an ordered list
   - Last objective is the current focus
   - Length matches number of statements

Objectives help both the LLM and user track progress and maintain context throughout the collaboration.

## Tool Feedback Structure

Tool feedback is provided to both the LLM and the user in a structured format:

```
Tool results feedback:
Turn X/Y                     # Current turn and maximum turns
Collaboration Goal: [text]    # Overall collaboration objective
Current Objective: [text]    # Current statement objective
Tools Used: toolName(N: S✓ F✗) # Tool usage stats (N=total, S=success, F=fail)
[actual tool results]        # The tool's output
```

This structure helps:
1. **Turn Management**: Track progress through available turns
2. **Context Hierarchy**: Maintain both overall and immediate objectives
3. **Focus Management**: Keep immediate tasks aligned with broader goals
4. **Tool Usage**: Monitor which tools are being used and their success rates
5. **Resource Tracking**: Track files and URLs accessed

The objectives in the feedback serve different purposes:
- **Collaboration Goal**: Provides broader context for decision-making
- **Current Objective**: Guides immediate actions and tool choices

This dual-level objective system helps:
1. Maintain consistency across multiple statements
2. Guide tool selection and usage
3. Frame responses in proper context
4. Track progress toward overall goals

The feedback is maintained by:
- `LLMConversationInteraction`: Tracks objectives and resource access
- `LLMToolManager`: Manages tool usage statistics
- `OrchestratorController`: Formats and presents the feedback