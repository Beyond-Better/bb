# Getting Started with DUI Development

This guide is designed to help you have productive conversations about BB Desktop UI (DUI) development with the AI assistant.

## Starting a Conversation

When starting a new conversation about DUI development:

1. Set Clear Context:
   ```
   I'm working on the BB Desktop UI (DUI). This is a Tauri 2.1.1 desktop application 
   built with Preact and TypeScript, using Deno as the development runtime. The app's 
   primary purpose is to manage the BB API server.
   ```

2. Specify Your Focus:
   - Development setup
   - Feature implementation
   - Bug fixing
   - Configuration
   - Building/packaging

3. Include Relevant Details:
   - Your current directory location
   - Any error messages (full text)
   - Recent changes made
   - Current development environment state

## Key Topics

### 1. Development Environment

When discussing development setup:
- Mention your OS (Windows/macOS/Linux)
- Confirm installed versions:
  - Rust/Cargo
  - Deno
  - Tauri CLI
- Required Babel plugins:
  ```bash
  deno add npm:@babel/plugin-transform-react-jsx-development
  deno add npm:babel-plugin-transform-hook-names
  ```
- Specify any environment-specific issues

### 2. BB API Integration

When working with BB API features:
- Clarify which API endpoints you're working with
- Specify the API server management features needed
- Mention any specific API response handling
- Include logging requirements

### 3. UI Development

For UI-related tasks:
- Reference specific components
- Describe the desired user experience
- Mention any design requirements
- Include accessibility considerations

### 4. Building and Packaging

For build-related questions:
- Specify target platform(s)
- Mention any special build requirements
- Include packaging preferences
- Note any platform-specific concerns

## Example Conversations

### 1. Development Setup
```
I'm setting up DUI development on macOS. I've installed Rust and Deno, and I'm in 
the /Users/username/bb/dui directory. I've installed the required Babel plugins:
```bash
deno add npm:@babel/plugin-transform-react-jsx-development
deno add npm:babel-plugin-transform-hook-names
```
When running 'deno task tauri dev', I'm seeing this error: [error details]
```

### 2. Feature Implementation
```
I'm working on the log viewer component in DUI. I need to implement real-time log 
updates from the BB API server. The component is in src/components/LogViewer/. 
Here's my current implementation: [code]
```

### 3. Build Issues
```
I'm trying to build DUI for production on Windows. Running 'deno task tauri build' 
gives this error: [error details]. Here's my current Cargo.toml and tauri.conf.json: 
[config files]
```

## Tips for Effective Communication

1. Share File Contents:
   - When discussing code, share the relevant file contents
   - Include surrounding context for specific lines
   - Mention file paths relative to the project root

2. Error Messages:
   - Include complete error messages
   - Share relevant log output
   - Specify when errors occurred (build time, runtime, etc.)

3. Configuration:
   - Share relevant configuration files
   - Mention any custom settings
   - Include environment-specific details

4. Changes:
   - Describe recent changes made
   - Include the reasoning behind changes
   - Mention any related changes in other files

## Common Development Tasks

1. Adding New Features:
   ```
   I need to add [feature] to DUI. It should [description]. 
   The relevant files are:
   - src/components/...
   - src-tauri/src/...
   ```

2. Fixing Issues:
   ```
   DUI is showing [issue] when [action]. 
   Error message: [error]
   Relevant code: [code]
   ```

3. Configuration Changes:
   ```
   I need to update DUI's [configuration] to support [requirement].
   Current config: [config]
   ```

## Next Steps

After starting a conversation:
1. Follow the AI's guidance step by step
2. Provide feedback on results
3. Share any new errors or issues
4. Ask for clarification when needed

Remember to:
- Keep the conversation focused on one task at a time
- Share relevant updates and changes
- Provide complete information about errors
- Follow up on suggested solutions