# LLM Instructions for BB Project

NOTE: All file paths in this document are relative to the project root unless otherwise specified. The project root is the directory containing CONVENTIONS.md.

This document serves as a guide for the AI assistant, providing an overview of important reference files within the BB project. These files contain crucial information about project conventions, testing procedures, tool creation, file handling, and more.

## Key Reference Files

### CONVENTIONS.md (Project Root)
- Contains overall project conventions and guidelines
- Always available in the chat context
- Refer to this file for general project structure, coding standards, and best practices

### docs/development/llm/testing.md
- Outlines the testing strategy and progress for the BB project
- Includes information on test coverage, pending tests, and testing principles
- Consult this file when working on or discussing project testing

### docs/development/llm/new_tool.md
- Provides a comprehensive guide for creating new tools in the BB project
- Includes step-by-step instructions, information gathering template, and implementation guidelines
- Reference this file when assisting with the creation or modification of project tools

### docs/development/llm/file_handling.md
- Details the file handling mechanisms and best practices in the BB project
- Includes information on file operations, path handling, and security considerations
- Consult this file when working with file-related functionalities

### docs/API.md
- Documents the API structure and endpoints of the BB project
- Useful for understanding the overall architecture and available services
- Refer to this file when discussing or implementing API-related features

### docs/BUI.md
- Documents the Browser User Interface (BUI) of BB
- Includes information about components, layouts, and user interactions
- Reference this file when discussing or implementing BUI-related features
- Consult for frontend development guidelines and patterns

### docs/CLI.md
- Provides information about the Command Line Interface of BB
- Includes available commands and their usage
- Consult this file when working on CLI-related features or discussing user interactions

### docs/DUI.md
- Documents the Desktop User Interface (DUI) of BB
- Contains specifications and plans for the desktop application interface
- Reference this file when discussing desktop-specific features and requirements
- Important for understanding the planned desktop application architecture

### docs/development/llm/tool_io.md
- Documents tool input/output structures and feedback format
- Includes information about tool results and conversation logging
- Reference this file when working with tool responses and feedback

## Objectives System and Tool Feedback

BB uses a hierarchical objectives system to guide your decision-making:

### Objective Types
1. Conversation Goal:
   - Overall purpose of the conversation
   - Provides broader context for all decisions
   - Set at conversation start
   - Helps maintain long-term focus

2. Statement Objectives:
   - Specific goals for each user statement
   - Maintained as an ordered list
   - Last objective is current focus
   - Guides immediate actions

### Tool Feedback Format

After each tool use, you'll receive feedback in this format:
```
Tool results feedback:
Turn X/Y                     # Track your turn usage
Conversation Goal: [text]    # Overall conversation purpose
Current Objective: [text]    # Immediate task focus
Tools Used: toolName(N: S✓ F✗) # Monitor tool effectiveness
[actual tool results]        # Tool's output
```

Use this feedback to:
1. Manage your turns efficiently
2. Maintain context hierarchy:
   - Use Conversation Goal for strategic decisions
   - Use Current Objective for tactical choices
3. Choose tools based on:
   - Alignment with both objective levels
   - Previous tool success rates
4. Track resource modifications
5. Frame responses in proper context

## Import Path Guidelines

1. Always check `import_map.json` in the project root for correct import paths
2. Use mapped paths instead of relative paths where possible
3. When suggesting imports, use paths as defined in import_map.json
4. Convert absolute paths to mapped paths

## Usage Guidelines

1. Always start by reviewing the CONVENTIONS.md file in the project root, which is included in every chat context.
2. For specific tasks or discussions, refer to the relevant files mentioned above.
3. If you need information that might be in one of these files, ask to see the content of the file.
4. When providing assistance or suggestions, ensure they align with the guidelines and conventions outlined in these documents.
5. If you notice any discrepancies or need clarification about the content of these files, don't hesitate to ask for clarification.

By referencing these files as needed, you can ensure that your assistance remains consistent with the BB project's standards and practices.