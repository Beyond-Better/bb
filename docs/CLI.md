# BB CLI Documentation

`bb` is a command-line interface tool for interacting with the BB API and managing AI-assisted conversations for various text-based projects.

## Installation

For detailed installation instructions, please refer to the [INSTALL.md](../INSTALL.md) file.

For Windows users, we provide an MSI installer and batch files for easy setup and usage. Please see our [Windows User Guide](WINDOWS_GUIDE.md) for more information.

## Usage

```
bb [command] [options]
```

On Windows, use `bb.exe` instead of `bb` for all CLI commands.

On Windows, you can also use the provided batch files:
- `bb_init.bat`: Initialize BB in your project directory.
- `bb_start.bat`: Start BB and open the browser interface.

## Available Commands

### General

- `bb --version`: Display the version of the BB CLI tool.
- `bb --help`: Show help information for the BB CLI tool.

### Project Initialization

- `bb init`: Initialize BB in the current directory.
  - On Windows, you can also double-click `bb_init.bat` in your project directory.

### API Management

- `bb start`: Start the BB API server and open the browser interface.
  - On Windows, you can also double-click `bb_start.bat` in your project directory.
  - Options:
    - `--log-level <level>`: Set the log level for the API server.
    - `--log-file <file>`: Specify a log file to write output.
- `bb stop`: Stop the BB API server.
- `bb status`: Check the status of the BB API server.

### Conversation Management

- `bb chat` (alias: `c`): Start a new conversation or continue an existing one.
  - Options:
    - `-s, -p, --prompt <string>`: Prompt (or statement) to start or continue the conversation.
    - `-i, --id <string>`: Conversation ID to continue.
    - `-m, --model <string>`: LLM model to use for the conversation.
    - `--json`: Return JSON instead of plain text.

### Configuration Management

- `bb config`: View or update BB configuration.
  - Commands:
    - `view`: View configuration settings
      - `--global`: Show only global configuration
      - `--project`: Show only project configuration
    - `get <key>`: Get a specific configuration value
      - `--global`: Get from global configuration
      - `--project`: Get from project configuration
    - `set <key> <value>`: Set a configuration value (defaults to project config)
      - `--global`: Set in global configuration
      - `--project`: Set in project configuration
  - Examples:
    - View current configuration:
      ```bash
      bb config view
      ```
    - View global configuration:
      ```bash
      bb config view --global
      ```
    - Get a specific value:
      ```bash
      bb config get api.logLevel
      bb config get --global api.apiPort
      ```
    - Set configuration values:
      ```bash
      # Set in project config (default)
      bb config set api.logLevel debug
      
      # Set in global config
      bb config set --global api.apiPort 3000
      
      # Set complex values (automatically parsed)
      bb config set api.toolConfigs '{"tool1": {"enabled": true}}'
      ```
  - Notes:
    - Nested keys use dot notation (e.g., 'api.logLevel')
    - Values are automatically parsed as JSON when appropriate
    - Project config is the default target for 'set' command
    - Configuration changes take effect immediately

### File Management

- `bb add`: Add files to the conversation (not implemented).
- `bb remove`: Remove files from the conversation (not implemented).
- `bb list`: List files in the conversation (not implemented).

### Conversation Actions

- `bb clear`: Clear the current conversation (not implemented).
- `bb request`: Request changes from the LLM (not implemented).
- `bb undo`: Undo the last change (not implemented).

### Utility Commands

- `bb usage`: Show current token usage (not implemented).
- `bb logs`: View chat conversation logs (default).
  - Options:
    - `-n, --lines <number>`: Number of lines to display (default: 20).
    - `-f, --follow`: Follow the log output in real-time with color-enabled display for chat conversations.
    - `--api`: Show logs for the API server instead of chat conversations.
    - `-i, --id <string>`: Conversation ID to view logs for.

## Examples

1. Initialize BB in your project:
   ```
   bb init
   ```
   On Windows, double-click `bb_init.bat` in your project directory.

2. Start the BB API server and open the browser interface:
   ```
   bb start
   ```
   On Windows, double-click `bb_start.bat` in your project directory.

3. Start a new conversation:
   ```
   bb chat -p "Hello, I'd like to start a new project."
   ```

4. Continue an existing conversation:
   ```
   bb chat -i <conversation-id> -p "Can you explain the last change?"
   ```

5. View chat conversation logs in real-time with color-enabled display:
   ```
   bb logs -f -i <conversation-id>
   ```

6. View API logs:
   ```
   bb logs --api
   ```

7. Check the status of the API server:
   ```
   bb status
   ```

8. Stop the API server:
   ```
   bb stop
   ```

Note: Many commands are currently not implemented and will be added in future updates.

## Windows-Specific Usage

For detailed instructions on using BB on Windows, including how to use the provided batch files and the importance of project-specific usage, please refer to our [Windows User Guide](WINDOWS_GUIDE.md).

Remember that the `init` and `start` commands (and their corresponding batch files) are project-specific. Always ensure you're in the correct project directory when running these commands or using the batch files.
