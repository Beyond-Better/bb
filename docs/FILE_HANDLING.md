# File Handling in BB Conversations

This document outlines the conventions and strategies for handling files within BB conversations.

## File Storage Strategy

1. **System Prompt:**
   - Use for smaller, frequently accessed files
   - Include files using XML tags
   - Suitable for <10 files or <50KB total

2. **Message Array:**
   - Use for larger or less frequently used files
   - Add files via tool use
   - Suitable for >10 files or >50KB total

3. **Large File Handling:**
   - For files >1MB, implement content-based chunking
   - Load relevant sections as needed (to be implemented with embedding storage and search)

4. **ctags Integration:**
   - Generate ctags for all files in the project
   - Include ctags summaries in the system prompt or initial message
   - Provide a mechanism to request full file content based on ctags information
   - Benefits:
     - Quick assessment of file structure
     - Identifying key functions, classes, and methods
     - Determining if a full file view is necessary
     - Reduced token usage and improved efficiency

## File Updates

- Replace the original file with the edited version in the conversation
- Maintain a separate log of changes for each conversation using ConversationPersistence

## File Metadata

Include file metadata alongside content for better context. Example:

```xml
<file path="/src/main.ts" size="1024" last_modified="2023-06-15T10:30:00Z">
// File content here
import { Application } from "https://deno.land/x/oak/mod.ts";
// ... rest of the file
</file>
```

## Change Proposals

When proposing changes to files, use the diff patch format:

```diff
--- a/path/to/file
+++ b/path/to/file
@@ -10,7 +10,7 @@
 unchanged line
-removed line
+added line
 unchanged line
```

## Version Control Integration

- While direct access to git logs is not available, include relevant commit messages or summaries when significant changes occur
- Provide clear, actionable changes in the conversation

## File Handling Workflow

1. Assistant requests files using the provided tool
2. BB agent adds requested files to the conversation
3. Assistant proposes changes using the diff patch format
4. BB agent applies changes and updates the conversation state

## Permissions and Error Handling

- Assume BB has necessary permissions to read/write files
- If permission issues occur, treat as a conversation-ending error and notify the user

## Multiple Conversations Warning

- Allow multiple active conversations per project
- Implement a prominent warning to users about the risks of concurrent edits

## Security Considerations

- File security is primarily the user's responsibility
- Implement a system to flag potentially sensitive data (e.g., API keys, passwords) and warn the user

## File Deletion

- Implement a specific tool or command for file removal
- Log file deletions in the conversation change log

## Important Links

As an AI assistant for the BB project, I should be aware of and use the following links when appropriate:

- BB GitHub Repository: https://github.com/Beyond-Better/bb
- BB Documentation (future): https://beyondbetter.dev
- Contributing Guidelines: https://github.com/Beyond-Better/bb/blob/main/CONTRIBUTING.md
- Project Conventions: https://github.com/Beyond-Better/bb/blob/main/CONVENTIONS.md
- File Handling Guidelines: https://github.com/Beyond-Better/bb/blob/main/FILE_HANDLING.md
- API Documentation: https://github.com/Beyond-Better/bb/blob/main/API.md

When referencing these links in conversations or documentation, I should use the exact URLs provided above to ensure consistency and accuracy.

By following these conventions and using the correct links, we ensure consistent and efficient file handling and communication throughout BB conversations and documentation.
