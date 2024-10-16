# TODO List

## Interface Development
1. Plan and design Desktop User Interface (DUI) for future development
2. Ensure consistency across API, BUI, CLI, and future DUI interfaces

## Repository Information Management
1. Convert projectInfo into a proper class with support for:
   - ctags
   - file listing
   - vector embeddings
   - fallback to file_search tool if none of the above are used
3. Implement a repoInfo persistence solution

## Changes (mutating) and Git Integration
1. Add config option to create new branch when starting a conversation
2. Implement a way to "end" conversation which merges branch back to original

## Task Management
1. Create an 'add task' tool allowing Claude to give BB a list of tasks to complete
2. Implement each task as a new conversation to complete the task

## System Prompt and Project Info
1. Update system prompt to give a clear explanation about using project-info to choose files rather than search_files
2. Move project-info towards the beginning of the system prompt
3. Create a high-level system prompt template to combine baseSystem with project info and files added
4. Update system prompt to further clarify that assistant is talking to both BB and user:
   - Responses to tool use (e.g., "Change applied successfully") should be directed to BB and wrapped in tags for parsing
   - Everything not inside <bb> tags will be shown to user as part of the conversation
   - 'User' message showing 'tool result' should be clearly separate from rest of the conversation

## Logging and Output
1. Implement terse and verbose options for conversation log:
   - Verbose option to show results of tool use and details such as contents of changes being applied
   - Implement fancy formatting for showing changes, similar to git diff output
2. Format JSON in display of logs

## Configuration and Customization
1. Create configs for different interfaces (API, BUI, CLI, DUI)
2. Implement interface-specific settings in the configuration file
2. Implement a safety switch (e.g., allow_dangerous_user_scripts) for potentially dangerous user scripts
3. Create a meta tool to choose which toolset to load (e.g., different tools for coding projects vs. creative writing)
4. Create configs for:
   - llmTokenThresholdWarning: 100k tokens
   - llmTokenThresholdCritical: 150k tokens
   When threshold is reached, ask Claude to use removeFiles tool or summarizeHistory tool

## Improvements and Fixes
1. Implement conversation state management:
   - Keep state of conversations with a currently active 'speak with'
   - Use KV (or similar) to create "conversation locking" in ProjectEditor to allow only a single active conversation
2. At start of each conversation, get current git commit, save it with the "Add File" content of new message
3. Don't persist a conversation for a quick chat

## New Tools and Commands
1. Develop BUI-specific tools and commands
2. Plan for DUI-specific tools and commands
1. Create a `bb doctor` command to zip a conversation for sharing
2. Create a summarize history tool to reduce token count and delete earlier messages
3. Implement new tools:
   - Record memory, remember instruction/guideline

## For CHANGELOG
- Implement a repoInfo persistence solution
- Create an 'add task' tool allowing Claude to give BB a list of tasks to complete

## Completed Tasks
1. ✓ `searchFiles` is now using exclude patterns read from the file instead of file names for exclude pattern
2. ✓ Added statement/turn number at the start of persisted message JSON
3. ✓ Implemented creation of a new branch with each conversation, merging back at the end of the conversation
4. ✓ Saved system prompt and project info in conversation persistence when running in localdev environment
5. ✓ Check ENV environment and add `--watch` only for localdev
6. ✓ When `bb start` is called, check if running compiled binary or from repo to control how bb-api is started
7. ✓ Create a separate chat output log for conversation progress (no debugging or app logging)
8. ✓ Save the chat log in the .bb directory
9. ✓ Add a `bb` command to tail the chat log
10. ✓ Modify `bb chat` command to:
    - Listen to STDIN if '-p' isn't passed
    - Start a prompt for user input if nothing is piped in
    - End user input with '\n.\n' (a dot with a leading blank line)
11. ✓ Fix run loop to continue as long as needed (within reason), allowing for multiple tool turns
12. ✓ Create a function/class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)
13. ✓ Use haiku to create semantic names for conversations based on initial prompts
14. ✓ Use semantic names for directories in cache, while maintaining IDs for passing around
15. ✓ Create a map of conversation IDs and names to allow user input of either
16. ✓ Create new files when patch file has /dev/null as the source
17. ✓ Implement git commit after patching
18. ✓ Use haiku to write commit messages
19. ✓ Create a 'chat' class similar to LLMConversation:
    - designed for quick (fast) LLM conversations, e.g., to ask for a git message or for the 'title' of a conversation
20. ✓ Update `bb chat` to support proper readline text entry rather than just typing on stdin
21. ✓ Refactor conversation logging:
    - Write human-friendly and machine-parseable output to chat log
    - Allow users to tail the chat log directly for as-is viewing
    - Use `bb logs` for fancy formatting
    - Make `bb logs` check the TERM width and use that for max width
22. ✓ Add `bb restart` command for API (can just do a stop/start)
23. ✓ Implement tool manager class
24. ✓ Add websocket mode to get live updates between terminal and API
25. ✓ Fix exclude args not being respected for file listing in `fileHandling.utils.ts`
26. ✓ Print a divider line after prompt in console
27. ✓ Clear screen when starting editor
28. ✓ Fix LogFormatter to include new lines in formatted log entries
29. ✓ Improve the appearance of the summary block with conversation id, turn count, token usage, etc. in conversationCmd chat terminal
30. ✓ When hydrating files, process messages in reverse order, and keep track of which files have been hydrated
31. ✓ Validate results of search/replace in `handleSearchAndReplace`
32. ✓ Implement chat history in terminal
33. ✓ Implement new tools:
   - Rewrite file (rather than search/replace)
   - Load web page
   - Run command (check-types, test, format)
34. ✓ StatementCount and statementTurnCount in persisted messages need to be corrected:
   - statementCount is starting at zero with every request, it needs to be restored from persisted conversation
   - statementTurnCount stays at 1, so the value we're storing isn't the value that's updated during the loop
35. √ Fix ctags multi-tier functionality:
   - Currently goes through all tiers and says all are too big
36. √ Format JSON in display of logs
37. √ Patching and Git Integration
   - Modify apply_patch tool to accept a list of file names and patches
38. √ Implement Browser User Interface (BUI) for increased accessibility
39. √ Create a new tool to add files rather than update files
40. √ For new files in patches, check for paths starting with `b/` and strip it
41. √ New files need to be staged before committing
42. √ When running `bb chat`:
   - Check if API is running; if not, start it, and then kill it when exiting
   - Ensure the API logs go to file and not to chat terminal (Unless debug CLI arg is passed)
   - Don't start API in watch mode if auto-started by `bb chat` (pass args via action(...))
43. √ Allow users to specify projectInfo type in the config
44. √ Don't create tags file in .bb - either save with conversation or use the persistence solution
45. √ Make the 'post-run' script (currently hard-coded for deno format) a user config option
46. √ Implement new tools:
   - Move files
   - Rename files



Thoughts...

Pull thinking out of tool use 
Pull <reply> out of answer and send as summary - rest of answer is 'assistant' log entry


