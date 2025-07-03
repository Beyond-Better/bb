# BB Project Conventions

## ⚠️ CRITICAL INSTRUCTION FOR AI ASSISTANT ⚠️

Before making ANY changes to component-specific directories (api/, bui/, cli/, dui/, abi/), you MUST:
1. Request and read the CONVENTIONS.md file from that specific directory
2. Follow those specific conventions IN ADDITION TO these general conventions
3. If component conventions conflict with general conventions, component conventions take precedence

Example:
```typescript
// Before modifying api/src/someFile.ts:
await requestFiles(['api/CONVENTIONS.md']);
// Read and follow api/CONVENTIONS.md guidelines
```

Failure to follow component-specific conventions can lead to inconsistencies and errors.

## Note to Users
This document is primarily intended for the AI assistant to understand the project's conventions and guidelines. While you're welcome to read it, please be aware that changes to this file should only be made when explicitly instructed, as they directly affect how the AI interprets and works with the project.

## IMPORTANT NOTE FOR ASSISTANT

Refer to `docs/development/llm/llm_instructions.md` as needed for guidance on project-specific files and their purposes. This file (CONVENTIONS.md) will always be available in the chat context, but other files should be requested when their specific information is required.

## Project Overview
BB is a versatile project that provides REST API, CLI tools, and BUI browser interface to modify and enhance a wide range of text-based projects using LLM technology. BB is designed to work with various text formats including, but not limited to:

- Programming code in any language
- Prose and documentation
- Fiction writing
- LLM prompts
- HTML and SVG
- Markdown and other markup languages
- Configuration files
- Data formats (JSON, YAML, etc.)

It supports vector embeddings for code and text chunks from local repositories, implements RAG (Retrieval-Augmented Generation) for LLM, and provides LLM tools for requesting access to files for review or edit. This makes `bb` a powerful assistant for any text-based project, whether it's software development, content creation, or data analysis.

## Technology Stack
- Runtime: Deno with TypeScript (strict mode)
- API Framework: Oak
- Vector Database: In-memory vector store using Hnswlib-ts
- CLI Command-line Parsing: Cliffy
- Documentation Generator: TypeDoc

## Architecture
- API server for query handling
- CLI commands for interfacing with API
- In-memory vector storage and search functionality within the API
- LLM abstraction layer for multiple providers (initially Claude, with plans for OpenAI)
- RESTful communication between CLI and API for efficiency

## Project Structure
- API: `api/src/`
- BUI: `bui/src/`
- CLI: `cli/src/`
- DUI: `dui/src/` (future)
- Shared: `src/shared/` for code shared between API and CLI
- Utilities: Separate utils in `api/src/utils/` and `cli/src/utils/`
- Documentation: `docs/`
- API tests: `hurl/`
- Configuration: Separate `deno.jsonc` files for `api` and `cli`

## Glossary of Terms

- **Collaboration**: An series of interactions between a user and the BB system, which may include orchestrator/agent and admin interactions.
- **Interaction**: An ongoing interaction between a user and the BB system, which may include multiple statements and turns.
- **Statement**: A single request or input from the user to the BB system.
- **Turn**: A single request-response cycle between BB and the LLM.
- **Session**: The entire duration of a user's interaction with BB, which may include multiple conversations.
- **Project**: The collection of files and resources that BB is working with.
- **Tool**: A specific function or capability that the LLM can use to perform actions or retrieve information.
- **Change**: A set of changes to be applied to a file.
- **Commit**: A saved state of the project in the version control system.
- **Embedding**: A numerical representation of text used for semantic search and comparison.
- **Token**: The basic unit of text processing for the LLM, typically a word or part of a word.
- **Prompt**: The input provided to the LLM to guide its response.
- **System Prompt**: The initial instructions given to the LLM to set its behavior and context.
- **RAG (Retrieval-Augmented Generation)**: A technique that combines retrieval of relevant information with text generation.

## API Design
- RESTful principles with primary endpoints at /api/v1
- JSON request/response format
- No authentication required (designed for local use only)
- Optimized for memory efficiency

Key API Endpoints:
- Manage files in conversation (add/remove/list)
- Manage LLM conversations (start/clear/continue)
- Request code/text changes from LLM
- Undo last code/text change
- Show current token usage
- Run arbitrary CLI command with output added to conversation
- Load content from external web site
- Log conversations for live viewing and review
- Persist current conversation to disk with a `resume` feature

## API Pipelines
- Abstraction for different LLM use cases
- Uses LLM `conversation` to manage calls to LLM providers
- Implements conversation logging and persistence

## Collaboration Management
- Log all collaborations for review using `bb logs` command
- Implement persistence mechanism for collaboration state
- Provide `resume` feature for API restarts
- Store logs in human-readable format (e.g., Markdown or YAML)

## TypeScript and Import Conventions
- Use `import_map.json` for both `api` and `cli` projects
- Always check `import_map.json` for correct import paths
- When suggesting imports, use the paths defined in `import_map.json`
- Convert absolute paths to mapped paths where possible
- Use bare specifiers for imports
- Maintain separate builds for API and CLI
- Use `src/shared/` for code shared between API and CLI

## Interface Structure and Conventions
- Main CLI process in `cli/src/main.ts`
- Include `bb logs` command for viewing conversations
- Ensure cross-platform compatibility
- Use descriptive names for CLI-specific components
- Prefix CLI-specific types with `CLI`
- The CLI tool is named `bb` (lowercase) (`bb.exe` for Windows)
- The API server is referred to as 'api'
- The Browser User Interface is referred to as 'bui'
- The Desktop User Interface is referred to as 'dui'

## Guidelines for 'bui'
- Include as many relevant features and interactions as possible.
- Add thoughtful details like hover states, transitions, and micro-interactions.
- Create an impressive demonstration showcasing web development capabilities.
- Apply design principles: hierarchy, contrast, balance, and movement.
- Use Tailwind CSS and always include dark mode classes where relevant

## Configuration
- Use `deno.jsonc` for project configuration
- Maintain separate config files for `api` and `cli`
- Use environment variables for sensitive data
- Implement environment-specific .env files

## Error Handling & Logging
- Implement specific error types and proper async error handling
- Use custom logger in `src/shared/` directory

## File Naming Conventions
- Class files: camelCase (e.g., `vectorEmbedder.ts`)
- Script files: dash-separated (e.g., `transform-data.ts`)
- Utility files: include `.utils` (e.g., `error.utils.ts`)
- Type definition files: include `.types` (e.g., `llms.types.ts`)
- Service files: use `.service` (e.g., `user.service.ts`)
- Controller files: use `.controller` (e.g., `auth.controller.ts`)
- Middleware files: use `.middleware` (e.g., `error.middleware.ts`)
- Model files: singular form without suffixes (e.g., `user.ts`)
- Tool files: use `Tool` suffix (e.g., `searchAndReplaceTool.ts`)
- Test files: match the name of the file being tested with `.test` suffix (e.g., `searchAndReplaceTool.test.ts`)

## Script Conventions
- Include shebang line for Deno scripts
- Use direct execution method in examples

## Security
- Use environment variables for sensitive configuration
- Sanitize and validate all data input
- Restrict LLM access to files added to conversation by `bb`
- Prevent `bb` from adding files outside the current git repo
- Always use `dsConnection.isResourceWithinDataSource` to ensure file operations are restricted to the project directory
- Implement proper error handling for network requests in data retrieval tools
- Sanitize and validate command inputs to prevent injection attacks in system command tools

## Testing & Documentation
- Write unit tests using Deno's built-in testing functionality
- Use Hurl for API endpoint tests
- Use JSDoc comments for code documentation
- Use Swagger/OpenAPI comments for API endpoints
- Create documentation site at https://beyondbetter.app
- Refer to docs/development/llm/testing.md for comprehensive testing guidelines and current test coverage
- Each tool should have its own test file in the `api/tests/t/llms/tools` directory
- Tests should cover basic functionality, edge cases, and error scenarios
- Use `Deno.test()` for creating test cases, with `sanitizeResources` and `sanitizeOps` set to `false`
- Use a temporary directory for file-based tests to ensure a clean state for each test

## AI Integration
- Use VoyageAI for code-specific embedding model
- Implement code chunking utility
- Use local in-memory vector store and search
- Create LLM provider abstraction layer
- Implement pipelines for common conversations
- Use embeddings for vector similarity for code chunks
- Refer to docs/development/llm/new_tool.md for guidelines on creating new AI tools
- Implement robust error handling and input validation for all AI tools
- Ensure proper integration of new tools with the LLMToolManager
- Consider different types of tools (file manipulation, data retrieval, system command) and their specific requirements

## Deployment
- Support multiple package managers (brew, npm, cargo)
- Include both CLI tools and API code in installation
- Use GitHub actions for building and compiling releases
- Use semantic versioning for API and CLI
- Ensure Linux compatibility

## Performance
- Implement lightweight performance monitoring using Deno's built-in performance API
- Focus on code efficiency and optimization
- Use Deno.Metrics() for runtime metrics
- Implement custom timing functions
- Create PerformanceMonitor class
- Log performance metrics at intervals
- Implement /metrics API endpoint

When discussing the project, refer to these conventions. Code suggestions should align with the project's style, structure, and technologies. Prioritize advanced techniques and efficient solutions within the project's scope.
