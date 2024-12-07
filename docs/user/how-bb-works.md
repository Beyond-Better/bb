# How BB Works

A technical deep dive into BB's operation, tools, and configuration options.

## Technical Operation

### Conversation Structure

BB maintains context through a hierarchical objectives system:

- **Conversation Goal**: Set at start, provides overall context and purpose
- **Statement Objectives**: Generated for each user input, guides immediate tasks
- **Turn Counter**: Tracks progress within maximum allowed turns (default: 25)

### Tool Usage Patterns

BB employs a variety of tools for different operations:

- **File Discovery**: Uses `search_project` for finding files, `request_files` for adding to conversation
- **Content Changes**: Employs `search_and_replace` for precise changes, `rewrite_file` for complete rewrites
- **Project Management**: Uses `move_files` and `rename_files` for organization

## Token Usage and Costs

Token usage directly affects operation costs:

- Conversation limit: 200,000 tokens total
- Cost increases with conversation length
- Each turn adds to the token count
- File content contributes to token usage

### Cost Management Tips:

- Use conversation summaries for long sessions
- Start new conversations for distinct tasks
- Remove unnecessary files from context
- Break large tasks into focused conversations

## Git Integration

### Throw-away Branches

BB can work in throw-away git branches for safe experimentation:

#### Branch Pattern:
```
bb/task-description-timestamp 
```

Example:
```
bb/update-readme-20240324
```

Benefits of using throw-away branches:

- Safe experimentation without affecting main code
- Easy to abandon changes if needed
- Can keep branches for reference
- No cleanup required

## Configuration Options

### Core Settings

#### Turn Limit
```json
{
  "api.maxTurns": 25  // Default value
}
```

#### Allowed Commands
```json
{
  "api.toolConfigs.run_command.allowedCommands": [
    "git branch",
    "git checkout",
    "ls",
    "cd",
    "pwd",
    "mv",
    "cp",
    "mkdir",
    "cat",
    "find",
    "grep",
    "tree"
    // ... and more
  ]
}
```

## Troubleshooting Guide

### Common Issues

#### Failed Search/Replace Operations

Common causes:
- Whitespace or indentation differences
- Hidden characters
- Line ending variations
- Content changed by previous operations

Solution: This is normal behavior. BB will adjust and retry with modified patterns.

#### Apparent "Loops" or "Thrashing"

What's happening:
- BB making incremental changes
- Verifying each change
- Adjusting approach based on results

Solution: This is normal. Let BB complete its process unless it exceeds the turn limit.

#### Token Limit Reached

Solutions:
- Use the conversation summary tool
- Start a new conversation
- Remove unnecessary files
- Break task into smaller parts

## Related Documentation

- [Understanding BB](understanding-bb.md)
- [Managing Conversations](managing-conversations.md)
- [Planning Templates](planning/README.md)