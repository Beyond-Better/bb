# TODO List

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

## Logging and Output
1. Implement terse and verbose options for conversation log:
   - Verbose option to show results of tool use and details such as contents of changes being applied
   - Implement fancy formatting for showing changes, similar to git diff output
2. Format JSON in display of logs

## Configuration and Customization
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
3. Implement new tools:
   - Record memory, remember instruction/guideline


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
47. √ Create a summarize history tool to reduce token count and delete earlier messages

√ - setup project from BUI
√ - project switcher in BUI
√ - file listing (autocomplete)
√ - only auto-scroll if already at end of the page
√ - show version number
√ Create tokenUsage.jsonl in conversation directory
√ Ensure token tracking and reporting from LLM through to conversation logging is accurate
√ Create new log type: chat - use instead of auxillary for assistant interactions
√   - maybe combine user and assistant messages into single log entry
√ add sub-label for auxillary messages (git commit, create title, setting objective)
√ - change scroll indicator to green when last/answer message has arrived
√ Enforced conversation summary when token limit is reached
√ Click version should show detailed version info, along with option to upgrade server
√ update prompt cache points
√ Fix dark mode
√ DUI:
√  - API control
√ Update docs on bb-site
√ - direct download of DUI
√ - update install instructions
√ - docs for using DUI
√   - project management
√   - conversation selector
√   - re-state to keep conversations short
√ - explain that using (most) browsers requires API to be secure (TLS)
√ Tool to open file (widget) in browser

√ Create configs for different interfaces (API, BUI, CLI, DUI)
√ Implement interface-specific settings in the configuration file

√ Subscriptions and plans (& billing)
√ LLM Proxy for tracking token usage per user
√ Change plans
√ Exclude .trash from file searching
√ Stripe subscriptions
√ View Usage
√ DUI Prefs - don't require Anthropic key when not in localMode
√ built binary for bui
√ OpenAi support
√ OpenAi support
√ DUI: Linux, change from /var/log to ~/.bb and /var/run to ~/.bb (or maybe ~/.local)
√ Chat Input history
√ BUI: Update the settings page to get latest usage when changing page nav.

√ Message Entry, when tool title and preview is long; it gets centered over two lines; it needs to be adjusted left
√ Mini metadata in action buttons section

√ display in BUI of taks for orchestrator vs agent
√ log entries need to get passed to BUI using parent conversationId
√ group agent tasks under delegate tasks - max height and collapsible

√ expand main system prompt to explain using delegate tasks:
√ - save tokens
√ - complex series of tasks
√ - etc
√ system prompt for agent tasks

√ cache mcp tool loading

√ Extended thinking support:
√ - UI controls
√ - Send UI settings from chat to API
√ - Pass settings all the way to provider
√ - Only set thinking for conversations, not chats
√ - extended thinking requires temperature:1
√ - Change max tokens depending on model (new defaultModels format??)
√ - extract thinking content part and format for standard <thinking> block
√ - Update llm-proxy to use extended thinking

√ Include metadata for conversation statements, eg current date, turn count, metrics

√ Propagate errors from API to BUI; eg hitting rate limits or other errors from LLM

√ signed binaries for ~~api/bui/cli/~~ dui

√ ## System Prompt and Project Info
√ 1. Update system prompt to give a clear explanation about using project-info to choose files rather than search_files
√ 2. Move project-info towards the beginning of the system prompt
√ 3. Create a high-level system prompt template to combine baseSystem with project info and files added
√ 4. Update system prompt to further clarify that assistant is talking to both BB and user:
√    - Responses to tool use (e.g., "Change applied successfully") should be directed to BB and wrapped in tags for parsing
√    - Everything not inside <bb> tags will be shown to user as part of the conversation
√    - 'User' message showing 'tool result' should be clearly separate from rest of the conversation

√ download updated app link from DUI  displays the binary code in the window; not a download
√ BUI should check both http and https and then set connect prefs
√ Try to connect again if connection fails on page load or after selecting a project
√ change anthropic llm to use streaming 
√ make all local projects into git repos; get rid of 'git' project type 
√ add re-send verify email link the failed verification page
√ check for already-verified status and don't show an error
√ Make error messages on login page more helpful "failed to fetch" means nothing
√ check if user already exists during signup, or show error if user already exists
√ Create doc to explain importance of guidelines file and how to create one
√ remove path and type from project registry
√ populate projectId/project.json with dataSources
√ Data source editor in BUI
√ Modify updateProjectInfo to use list of data sources
√ Check usage of prepareSytemPrompt is correct
√ Update tools to data source agnostic (using resource manager)
√ remove use of deprecated useProjectApi
√ conversation migration for v1 format

√ Add Notion as data source
√ Change load_datasource to always provide metadata, with resource list as optional
√ Change searchProject tool to use accessors instead of searchFilesContent and searchFilesMetadata
√ file suggestions need data source - the popup needs to show the data source - the entered resource needs to have datasource name prefix.
√ The system prompt and loadResource tool need to explain the datasource prefix (they aren't fully formed URLs)
√ search project is misleading the LLM - it keeps trying to get file content by searching - either update tool description to make clear the tool only returns resource names (URLs) or modify the tool to return content. Or (this may be better) change the tool to accept "range" criteria, either `-n` grep style, or line numbers (or both)
√ Auto-scroll of chat history should take into account the height of chat input box (since it grows)

√ Show attached files in logEntries
√ 1. Fix models list and capabilities in API; unknown models are getting detault label of Claude
√ 2. In ProjectEditor, saving models doesn't update config in API. 
√ 4. Add model selection to chat options in conversation:
√ 3. Add Gemini to bb-sass
√ Bigger hammer in DUI to restart rogue bb processes 
√ Add version number to /api/v1/status
√ Change layout of models page - put model selectors in column with descriptions beside them. 
√ Change suggeted combos to something more compact or a pop-out. 
√ Change CustomSelect to fancy select like ConversationSelect
√ Provider SVG icons
√ In-your-face notification when 'answer' arrives.
√ in storageMigration, make backup copy of projects directory
√ message & notification system in DUI when upgrading
√ agent answer causes status to end in BUI
√ ensure modelConfig is being passed to agents from statementParams
√ ensure modelConfig is being passed to chat from statementParams
√ persist interactionType to metadata
√ add parentInteractionId
√ reloading bui chat page with empty new conversation doesn't load default modelConfig
√ Add rawUsage to metadata for provider_requests in llm-proxy
√ Check max_tokens and other params for selected model to ensure they are within model capabilities
√ # Agent fixes
√ - passing in requestParams (speakOptions) (ModelCapabilitiesManager)
√ - loading correct model

√ conversation header not showing turns and tokens during statement handling
√ Fix token counts in conversation header of BUI
√ duplicate subscription charges
√ Need auto-topup feature
√ Assign signup and upgrade credits (plan_features->signup_credits_cents, plan_features->upgrade_credits_cents)
√ Auto-topup needs to trigger a stripe payment attempt
√ Plan downgrade is taking effect immediately, possibly result of stripe webhook event
√ plan downgrade is settng new plan to ACTIVE and setting cancel_at date
√ update plan descriptions to show free upgrade credits
√ manually applied credit purchase are showing as 'pending' in invoice history
√ Add plan card for 'enterprise - contact us'
√ Change user-subscription edge function to correctly use start_subscription vs change_subscription
X Add free period for Basic plan
√ wire up notifications such as auto topup
√ update plan cards for marketing site
√ restrict mcp tools based on features system
√ disable UI controls for mcp tools based on features system (use API to access features)
√ Test new user signup
X Change free plan to BYO api keys - limited data sources and tools
√ Password reset
√ Review purpose of 'free_months' coupon type - it should probably just be a 'percentage' type set to 100% with relevant 'duration_months'
√ Drop old billing functions (confirm no usage first) - process_month_end - process_month_end_batch
√ add token-usage log to llm-proxy
√ save partial prompt when navigating away, not just on page reload (eg, user switches to different conversation or to project settings)

√ Fix postgres linter errors: https://supabase.com/dashboard/project/asyagnmzoxgyhqprdaky/advisors/security
√ Change tools to use accessors: removeResources, renameResources, rewriteResources
√ Star conversations in BUI
√ Support coupon codes for subscriptions
√ Ensure Oauth details get reloaded into projectConfig after doing auth flow
√ Add detailed info in ~~system prompt~~ datasource instructions for how to structure URIs 
√ Progress marker for pricing tier change in chat input
√ Add "Settings" to docs - with focus on model selection
√ Hardcoded tick in progress bar
√ Token pill is not resetting with new (or changed) conversation
√ Add feature restrictions for read/write datasources
√ Test whether feature checks for datasources are working
√ Pricing fallback error - admin notifiction should include details of token type, model, etc
√ No pricing found for token type anthropic_cache_read in model gemini-2.5-pro-preview-06-05
√ Create token_usage types to use tiers and cache types from provider_model_pricing
√ Check token_usage records for Gemini (done with new tiered pricing)
√ After auth for googledocs datasource; ensure saving to project config also updates `auth` in instantiated datasource
√ Re-enable model features check in llm-proxy
√ Re-enable caching in features utils files
√ Include symlinks in filebrowser for datasources - symlinks should get resolved before saving root directory
X Change searchAndReplace tool to use structured `data` for `bbResponse` - Using editResource tool instead
√ change conversation title in BUI
√ Ensure message history is saved, even if there is tool error (should be ok) or LLM response error
