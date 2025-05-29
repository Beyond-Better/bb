# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- return contextual content for find resource tool

### Changed

- moved handling of llmProvider from controller to interaction
- UI updates and improvements
- resource auto-complete (suggestions) include data source name

### Fixed

- scrolling behaviour for chat history when prompt input is modified
- model selection and defaults


## [0.8.0] - 2025-05-24

### BREAKING CHANGES: This release removes 'project root' in favour of 'data sources'; moves 
location of project config; changes format of storage and configurations; and more.

### IMPORTANT: Backup your project `.bb` and `.config/bb` directories before upgrading.

### Added

- Support for Claude v4 (Sonnet and Opus)
- Support for Data Sources - major refactor across whole code base
- [BETA] Support for Notion data source
- Reading MCP resources
- Use Google Gemini models on local-only mode

### Changed

- System prompt lists data sources rather than showing file listing
- Tools use data sources instead of project root
- Updated content for home page
- Layout and design improvements
- Moved all project config and data to shared bb directory

### Fixed

- various fixes and improvements during refactor


## [0.7.5] - 2025-04-10

### Added

- inspector for API internals
- check for existing user during signup
- option to re-send email verification message

### Changed

- improved error messages on login auth failures
- API log formatting

### Fixed

- don't fail on already verified email addresses


## [0.7.4] - 2025-04-07

### Added

- extra fields included in signup form

### Changed

- enabled streaming for anthropic requests to allow larger max output tokens
- deprecated 'git' project type
- switched to internal git library instead of CLI wrapper

### Fixed

- saving payment method when changing plans


## [0.7.3] - 2025-04-02

### Added

- log paths for DUI and proxy
- button in DUI to open log files

### Changed

- instructions and styling for server control toggle in DUI
- retry/fallback for http/s protocol switching for API
- moved all log paths in DUI to separate section

### Fixed

- external links in DUI open in default browser
- control of internal proxy
- ensured status in ChatInput is fully reactive


## [0.7.2] - 2025-03-31

### Added


### Changed


### Fixed

- fixed handling of logDataEntry in CLI


## [0.7.1] - 2025-03-30

### Added

- Orchestrator/Agent task delegation
- New tool for image manipulation
- Log version number during API/BUI startup

### Changed

- design overhaul for messages in chat window
- system prompt for orchestrator and agent conversations
- display and formatting for nested agent tasks in BUI

### Fixed

- removed use of primaryInteractionId
- naming of logEntry vs logDataEntry
- cache tools list from MCP servers


## [0.7.0] - 2025-03-23

### Added

- Added support for MCP servers, with UI configuration panels

### Changed


### Fixed

- whitespace before pre/code blocks


## [0.6.18] - 2025-03-20

### Added

- Starter prompts for new conversations
- Support for pasting images into conversations

### Changed

- Styling for login and signup pages

### Fixed

- Fixed value too large error when caching large LLM responses


## [0.6.17] - 2025-03-17

### Added

- Support for Claude 3.7 and extended thinking (reasoning)
- Model capabilities system 
- Passing LLM response metadata to frontend (BUI)
- Config panel for controlling conversation options
- Info panel for current model details and settings

### Changed

- Improved display of thinking process extracted from LLM
- Structured metadata provided to LLM for each statement and tool turn

### Fixed

- Fixed display of tokens counts for statements vs conversation


## [0.6.16] - 2025-02-23

### Added

- Provider support for Google Gemini [beta]

### Changed


### Fixed

- switched to custom confirmation dialogs to fix missing webview native dialogs
- rewrote window size & positioning logic and state handling - respects multiple displays


## [0.6.15] - 2025-02-18

### Changed

- tool descriptions

### Fixed

- change glob to regex lib to fix windows path globbing


## [0.6.14] - 2025-02-17

### Added

- Signed and notarized app for macOS 

### Fixed

- Windows installer and logging config


## [0.6.13] - 2025-02-16

### Fixed

- stopped signup verification looping


## [0.6.12] - 2025-02-16

### Fixed

- landing page auth check
- project config migration backups


## [0.6.11] - 2025-02-07

### Fixed

- validation for global config and new config missing defaultModels
- tokenUsage for chats saved with conversation
- token savings calculations


## [0.6.10] - 2025-02-01

### Added

- created base class abstraction for OpenAI compatible providers
- added support for Ollama
- added support for DeepSeek
- conversation and project migrations for version upgrades

### Changed

- llmKeys moved under llmProviders
- run_command tool supports head/tail truncation for stdout/stderr

### Fixed

- token calculations and reporting


## [0.6.9] - 2025-01-23

### Changed

- external link display in dui

### Fixed

- default port for bui changed in configs
- dui handles 'corrupt' version strings from api
- file loading in api
- saving project type updates project config


## [0.6.8] - 2025-01-21

### Added

- new tool for display file

### Fixed

- fix for saving project config after edit in project settings
- tool config shows blank text area instead of blank json


## [0.6.7] - 2025-01-18

### Changed

- Project editor has more configuration fields

### Fixed

- Propagating errors from LLM


## [0.6.6] - 2025-01-16

### Fixed

- force a release for BUI build


## [0.6.5] - 2025-01-16

### Added


### Changed

- layout for project manager

### Fixed

- version reporting for api


## [0.6.4] - 2025-01-13

### Fixed

- Chat Input regressions
- Navigation in Project Manager
- Propagating errors from LLM


## [0.6.3] - 2025-01-12

### Fixed

- valid semantic version to keep Tauri happy

## [0.6.2a] - 2025-01-12

### Fixed

- default config for defaultModels


## [0.6.2] - 2025-01-12

### Added

- Refresh button for Subscription usage
- Prompt history in Chat Input

### Changed


### Fixed

- Location for log and run files in Linux
- Subscription page updates when navigating away and back


## [0.6.1] - 2025-01-12

### Added

- Settings in BUI for project defaults
- [beta] Support for OpenAI provider (needs image_url instead of b64 data)
- [alpha] Support for DeepSeek provider (not returning tool_calls message) (via llm-proxy only)

### Changed

- DUI control for API & BUI
- LocalMode settings in DUI for API & BUI 
- Redirect from login page if already logged in

### Fixed

- Changed KV key to fix auth session restoration in API


## [0.6.0] - 2025-01-08

### Added

- user account with subscription plans
- llm proxy to remove requirement for api key
- support for external tools
- dedicated log (per conversation) of LLM request/responses
- added remove_files tool
- binary build for BUI

### Changed

- docs shuffle
- updated deps (including Anthropic SDK with GA prompt caching)
- improved prompting to encourage use of request_files tool

### Fixed

- `pre` background in dark mode
- auth handling in BUI


## [0.5.12] - 2024-12-20

### Added

- http/websocket proxy in BUI to work around mixed content warnings in webview
- persisting windows size/position
- dark mode support


## [0.5.11] - 2024-12-18

### Added

- Conversation selector on chat page

### Changed

- Project Manager links direct to chat page
- Collapsed conversation list on chat page
- Improved conversation metadata


## [0.5.10] - 2024-12-16

### Fixed

- Fixed imports for Windows build of desktop app


## [0.5.9] - 2024-12-16

### Changed

- Modified API process handing in Windows version of desktop app


## [0.5.8] - 2024-12-16

### Fixed

- Automatic installation of binaries using Windows desktop app


## [0.5.7] - 2024-12-16

### Added

- config option to set project dir for API control

### Changed

- updating logging in DUI


## [0.5.6] - 2024-12-15

### Added

- add CSP header to BUI


## [0.5.5] - 2024-12-15

### Fixed

- Install prompt in desktop app


## [0.5.4] - 2024-12-15

### Fixed

- workflow syntax


## [0.5.3] - 2024-12-15

### Fixed

- GitHub workflow version handling


## [0.5.2] - 2024-12-15

### Added

- Chat page added to desktop app (when using api in secure/tls mode)
- Debug mode in desktop app to allow using localhost browser interface

### Changed

- Desktop app changed to universal binary for macOS

### Fixed

- projectId (& config) is optional for many CLI commands
- API starts automatically when launching desktop app
- Config in desktop app verified before starting API
- API url generation in browser app
- Default values set for global config


## [0.5.1] - 2024-12-11

### Changed

- Conversation counts moved to metadata bar

### Fixed

- BB Desktop logs to standard log diretory
- BB Desktop looks for binaries in expected location
- Browser handles project selection
- Changing conversations is fixed


## [0.5.0] - 2024-12-09

### Added

- Multi-page design for browser interface
- Automatic download of BB app
- App to manage the BB Server
  - Auto-install/upgrade of bb and bb-api
  - Shows installed BB API version
- Automatic conversation summary

### Changed

- Global and Project configs schema (v2)
- Use projectId instead of startDir to identify projects
- Moved prompt cache points to all user messages, not just request_file tool use

### Fixed

- Typeguards for tool results
- Lots of display fixes for missing metadata and token usage


## [0.4.1] - 2024-12-02

### Changed

- messages sent with cmd/meta-return; new lines with return

### Fixes

- scroll indicator shows correct unread count
- auto-scrolling disabled when page is not at end
- file suggestion triggers are less keen

### Added

- support for bb doctor


## [0.4.0] - 2024-12-02

### Changed

- added file listing autocomplete
- added version display in BUI, and check and warning for minimum API version
- added API auto-upgrade
- added API endpoint to initiate upgrade from BUI
- added 'migrate' CLI command to change from system to user-installed binaries
- added 'upgrade' CLI command to upgrade to latest version of `bb` and `bb-api`
- standardised log entry formatting with subtitle and preview components
- combined prompt/answer auxiliary log entries
- added common formatting functions and styles for tools
- improved log entry metadata display
- disabled auto-scroll if not at bottom of the page - added scroll to bottom button


## [0.3.11] - 2024-11-26

### Changed

- normalized token usage, conversation stats vs metrics;
- fixed token calcs for statement and conversation
- extract tool thinking with every turn
- all usage tokens sent to bui
- fixed indents for new global config file


## [0.3.10] - 2024-11-26

### Changed

- fixed indentation for default global config file


## [0.3.9] - 2024-11-25

### Changed

- fixed name of ca cert when adding to root trust store
- extended wait time for API start
- added IDLE status to progress handler switch


## [0.3.8] - 2024-11-25

### Changed

- Fixed status handling to force immediate IDLE status after conversation answer, preventing stuck progress indicators


## [0.3.7b] - 2024-11-24

### Changed

- must await


## [0.3.7a] - 2024-11-24

### Changed

- Updated Github actions to use Deno v2


## [0.3.7] - 2024-11-24

### Changed

- Upgraded to Deno v2
- Fixed status queue processing to ensure IDLE status is always displayed after conversation answer
- Fixed error loading global config
- Documentation updates

### Added

- Improved TLS certificate management:
  - Automatic certificate generation and trust store integration
  - New `bb secure` command for certificate management
  - Platform-specific trust store handling
  - Removed external mkcert dependency

- Enhanced security documentation:
  - New certificate management guide
  - Trust store documentation
  - Security troubleshooting guide
  - Platform-specific certificate handling
  - Browser compatibility guidance

- Improved status page:
  - Enhanced certificate information display
  - Trust store status
  - Platform-specific guidance
  - Browser warning solutions



## [0.3.6] - 2024-11-23

### Changed

- Improved status handling in BUI and CLI to provide smoother transitions and more reliable idle state handling
- Updated conversation_metrics and conversation_summary tools to provide clearer guidance about stopping after completion unless explicitly asked to continue


## [0.3.5] - 2024-11-23

### Changed

- Fixed API startup failure recovery mechanism
- Added graceful handling of tool cancellation states
- Implemented error message propagation from LLM to BUI/CLI
- Added distinct status indicators for Claude, API, or tool execution
- Exposed prompt cache status via API websocket
- Added support for multiple git repositories in subdirectories


## [0.3.4] - 2024-11-20

### Changed

- fixed bug with missing data dir
- fixed bug with symlinks in project listing


## [0.3.3] - 2024-11-19

### Changed

- changed search_project tool to use Deno-native `walk` options for match and skip
- updated tool description to clarify use of ** vs * in file patterns


## [0.3.2] - 2024-11-18

### Changed

- improved websocket reconnection handling
- improved conversation admin (adding and deleting)
- improved notifications 
- prompt caching indicator


## [0.3.1] - 2024-11-17

### Changed

- added help dialog


## [0.3.0a] - 2024-11-17

### Changed

- hotfix for broken input


## [0.3.0] - 2024-11-17

### Changed

- made some changes to BUI


## [0.2.6] - 2024-11-10

### Changed

- refactored handling (recording and reporting) of token usage
- added tests for persistence layer
- changed from adding files inside <bbFile> tags to using separate content part
- changed handling of content extraction from LLM response
- restructured contents of docs directory
- improved parsing for file mime type


## [0.2.5] - 2024-11-08

### Changed

- added 'conversation_summary' tool


## [0.2.4] - 2024-11-06

### Changed

- set apiUseTls to false during project init if certs could not be created
- fixed message hydration to keep last two versions of each file
- changed prompt caching to add cache points of three most recent messages with hydrated files
- removed "statement objective" on first statement, in favour of "conversation objective"
- fixed statement counts in messages.jsonl


## [0.2.3] - 2024-11-03

### Changed

- changed one-shot task to use text format as default; json format is cli arg
- updated cli config sub-command to work with full, global, and project level configs
- updated cli config sub-command to accept more updates
- updated cli config sub-command to output in colour


## [0.2.2] - 2024-10-30

### Changed

- task objectives to help Claude focus
- tool tracking (progress)
- fixed unwanted cache busting with updated project details
- stopped creation of conversation storage for ephemeral chats


## [0.2.1] - 2024-10-29

### Changed

- added config option and CLI arg for maxTurns


## [0.2.0] - 2024-10-23

### Changed

- Full rewrite of tool descriptions (based on guidance from Anthropic's "computer use" tools)
- Updated to latest Sonnet (WOW, I'm impressed)


## [0.1.6] - 2024-10-22

### Changed

- changed search_project tool to accept compound file patterns eg. *.js|*.ts|*.json


## [0.1.5e] - 2024-10-17

### Changed

- version bump to test github workflow releases


## [0.1.5d] - 2024-10-17

### Changed

- version bump to test github workflow releases


## [0.1.5c] - 2024-10-17

### Changed

- version bump to test github workflow releases


## [0.1.5b] - 2024-10-17

### Changed

- version bump to test github workflow releases


## [0.1.5a] - 2024-10-17

### Changed

- version bump to test github workflow releases



## [0.1.5] - 2024-10-17

### Changed

- more fixes for Windows release


## [0.1.4a] - 2024-10-17

### Changed



## [0.1.4] - 2024-10-17

### Changed



## [0.1.3a] - 2024-10-17

### Changed

- version bump to test github workflow releases


## [0.1.3] - 2024-10-17

### Changed

- fix Github workflow actions


## [0.1.2] - 2024-10-17

### Changed

- Added BB Manager convenience scripts 
- changed location of .bat files
- Updated system prompt, conscious thinking


## [0.1.1] - 2024-10-16

### Changed

- always include LLM response in answer, regardless of 'thinking' text block


## [0.1.0] - 2024-10-16

### Changed

- renamed BBai to Beyond Better
- renamed cli tools
- renamed all code references and deploy workflows


## [0.0.26-beta] - 2024-10-14

### Changed

- normalized tool results and responses - better feedback to LLM and clearer output in conversation
- New LLM tool: `conversation_metrics` for calculating the current turn and token counts, 
  needed for the upcoming `conversation_summary` (& truncation) tool
- improved handling for conversation log entries; loading saved conversations and conversation answers
  have the same handling as normal entries during conversation


## [0.0.25-beta] - 2024-10-10

### Changed

- added new tool MultiModelQuery
- updated tests to load tools via tool manager
- moved tool configs to user config 
- args for tool constructors set from metatadata json


## [0.0.24a-beta] - 2024-10-07

### Changed

- hotfix for compile target arg


## [0.0.24-beta] - 2024-10-07

### Changed

- generate tools manifest file to facilitate loading from compiled binary
- dynamically include tools at build compile time
- update build scripts and release workflow to use compile script


## [0.0.23-beta] - 2024-10-06

### Changed

- Overhaul of tool packaging and loading - each tool is self-contained for easier sharing
- Improved conversation entry formatting, including inline images
- Safely ignore cert warnings for localhost
- New LLM tool: `move_files` for moving files and directories to a new directory within the project
- New LLM tool: `rename_files` for renaming files and directories within the project


## [0.0.22-beta] - 2024-10-04

### Changed

- Upgrade deps to use latest Astral (fix for fetch screenshot tool)


## [0.0.21a-beta] - 2024-10-01

### Changed

- Hotfix for incorrect method name to create TLS cert


## [0.0.21-beta] - 2024-10-01

### Changed

- Copy rootCA.pem for deno's fetch custom http client
- Fix for check of existing certs
- Silenced file missing exception


## [0.0.20-beta] - 2024-10-01

### Changed

- Fix for nested array in tool results
- Improved mime-type checking


## [0.0.19-beta] - 2024-09-30

### Changed

- Added option for regex patterns to search and replace tool.


## [0.0.18-beta] - 2024-09-29

### Changed

- Changed BUI to prefer StartDir from URL
- Changed search project tool to default to case-insensitive and ignore git when searching


## [0.0.17-beta] - 2024-09-28

### Changed

- Refactored search_project tool to use native stream reader with buffer and native regex, rather than external grep


## [0.0.16-beta] - 2024-09-27

### Changed

- Fixed 'git not found' error when running init
- Updated `bb` strings to `bb.exe` for Windows
- Fixes for Windows compat
- Added config option for API and BUI to listen with TLS
- Updated CLI and BUI to initiate TLS connections if useTls is set
- Added certificate generation to init process
- Updated docs


## [0.0.15-beta] - 2024-09-25

### Changed

- Refactored Split config handling; global, project, full
- Added config for apiHostname
- Changed BUI to also load apiHostname and startDir from URL
- Fixes for init wizard
- Added support for image files to request_files tool 
- Added support for prompt caching to full message history
- Easy install; Windows MSI and one-liner for macOS and Linux


## [0.0.14a-beta] - 2024-09-14

### Changed

- Release builds for each platform
- Updated docs for INSTALL and README


## [0.0.13-beta] - 2024-09-14

### Changed

- Refactored Split config handling; global, project, full
- Added config for apiHostname
- Changed BUI to also load apiHostname and startDir from URL
- Fixes for init wizard
- Changed tests to create configured project for each unit


## [0.0.12b-beta] - 2024-09-08

### Changed

- Hotfix-2 for over-ambitious api client


## [0.0.12a-beta] - 2024-09-08

### Changed

- Hotfix for over-ambitious api client


## [0.0.12-beta] - 2024-09-08

### Changed

- Added wizard for `bb init`; will re-use existing config values for defaults if present
- Changed git to be optional
- Split config handling into global and project
- Improved handling for API control (port number)


## [0.0.11-alpha] - 2024-09-06

### Changed

- BUI is not a hosted site (can still be run manually from localhost)
- Running `bb start` will open browser page for hosted BUI, with apiPort pointing to localhost API


## [0.0.10b-alpha] - 2024-09-03

### Changed

- Hotfix for bui


## [0.0.10a-alpha] - 2024-09-03

### Changed

- Hot fix for deno.lock and build command


## [0.0.10-alpha] - 2024-09-02

### Changed

- Added custom tool content formatters for console and browser
- Added browser interface
- Added prompt caching for tools and system prompt
- Updated cli tool to auto-start api server


## [0.0.9-alpha] - 2024-08-18

### Changed

- Added mock stubs to bypass calls to LLM during unit tests
- Added web page fetch tool
- Added web screenshot fetch tool
- Reworked tool results, tool response, bb response for better conversation logging
- Refactored finalize callback for tool runs
- Cleaned up dangling event listeners 


## [0.0.8a-alpha] - 2024-08-15

### Changed

- Hot fix for missing conversation log entries


## [0.0.8-alpha] - 2024-08-15

### Changed

- Foundations for Orchestrator/Agent structure
- More tests
- Console logging cleanup
- Error handling


## [0.0.7-alpha] - 2024-08-05

### Changed

- Added websocket support for live updates of conversation logging
- Added event manager
- Added manager for project editors
- Improved typescript type handling
- Refactored terminal console handling


## [0.0.6-alpha] - 2024-08-03

### Changed

- Move tools to a ToolManager class
- Migrate each tool to dedicated class
- Fixes for gathering ProjectDetails
- Improved conversation logging
- More reliable file hydration in messages
- Better tool input validation and handling


## [0.0.5a-alpha] - 2024-08-01

### Changed

- Hot fix for multiple tool result blocks
- Hot fix for undefined usage tokens


## [0.0.5-alpha] - 2024-08-01

### Changed

- Added terminal support for multi-turn conversations
- Applied formatting to chat logs for easier reading


## [0.0.4-alpha] - 2024-07-28

### Changed

- Add workflow to automatically create a Github release and deploy to package managers
- Implement git commit after patching
- Create a class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)
- Use haiku to create semantic names for conversations based on initial prompts
- Use haiku to write commit messages


## [0.0.3-alpha] - 2024-07-27

### Changed

- Add support for Homebrew on macOS
- Lots of refactoring improvements for 
  - tool use
  - conversations
  - stateless requests (data persists across API restarts)
  - file searching, adding to conversation, and patching
  - project editor to handle different data sources (only local filesystem so far)


## [0.0.2-alpha] - 2024-07-23

### Added
- Initial project setup
- Basic CLI and API functionality
- File handling capabilities
- Conversation management features


## [0.0.1-alpha] - 2023-07-20
- Initial alpha release
