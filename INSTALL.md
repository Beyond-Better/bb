# Installing BB (Beyond Better)

BB (Beyond Better) is an AI-powered assistant for text-based projects. This guide will walk you through the installation process.

## System Requirements

BB can run on macOS, Linux, and Windows systems.

## Prerequisites

Before using BB, ensure you have the following:

1. An Anthropic API key (Note: This is different from your Anthropic chat console login. You can create an API key at https://console.anthropic.com/settings/keys)
2. [Git](https://git-scm.com/) (latest stable version, recommended but optional)
3. [ctags](https://github.com/universal-ctags/ctags) (optional, enhances project understanding)
4. Either `mkcert` or `openssl` for TLS certificate generation (required for proper operation)

Git, ctags, and mkcert can be easily installed using package managers like Homebrew on macOS, Chocolatey on Windows, or apt on Linux. While Git is optional, it's highly recommended for optimal use of BB.

To install `mkcert`:
- On Windows: `choco install mkcert`
- On macOS: `brew install mkcert`
- On Linux: Follow the instructions at https://github.com/FiloSottile/mkcert#linux

Note: TLS certificates are required for proper operation of BB. The initialization process will automatically generate the necessary certificates using either `mkcert` or `openssl` if they are installed. If neither is available, an error will be generated explaining how to install them.

For technical users: Any valid TLS certificate can be used. BB provides four config options for custom certificates:
- `api.tlsKeyFile`: File path to the TLS key
- `api.tlsCertFile`: File path to the TLS certificate
- `api.tlsKeyPem`: Inlined PEM content of the TLS key
- `api.tlsCertPem`: Inlined PEM content of the TLS certificate

Use either file paths or inlined PEM content, not both.

## Installation Methods

### Option 1: One-Line Installation Script (macOS and Linux)

For macOS and Linux users, the easiest way to install BB is using our one-line installation script:

```sh
curl -sSL https://raw.githubusercontent.com/Beyond-Better/bb/main/install.sh | sh
```

This script will:
1. Detect your system's architecture and OS
2. Download the latest version of BB
3. Install both `bb` and `bb-api` binaries to `/usr/local/bin`

Note: You may be prompted for your password to install the binaries in `/usr/local/bin`. This is necessary to make BB accessible system-wide.

### Option 2: Windows Installer

For Windows users, we provide an MSI installer for easy installation:

1. Go to the [BB Releases page](https://github.com/Beyond-Better/bb/releases) on GitHub.
2. Download the `bb-installer.msi` file.
3. Double-click the downloaded file to run the installer.
4. Follow the on-screen instructions to complete the installation.

The installer will place two batch files on your desktop:
- `bb_init.bat`: Use this to initialize BB in your project directory.
- `bb_start.bat`: Use this to start BB and open the browser interface.

To use BB:
1. Navigate to your project directory in File Explorer.
2. Copy the `bb_init.bat` file into your project directory.
3. Double-click `bb_init.bat` to initialize BB for your project.
4. Use `bb_start.bat` to start BB whenever you want to work on your project.

### Option 3: Manual Installation from Release Packages

For advanced users who prefer manual installation:

1. Go to the [BB Releases page](https://github.com/Beyond-Better/bb/releases) on GitHub.
2. Download the appropriate package for your operating system and architecture:
   - For macOS: `bb-x86_64-apple-darwin.tar.gz` or `bb-aarch64-apple-darwin.tar.gz`
   - For Linux: `bb-x86_64-unknown-linux-gnu.tar.gz` or `bb-aarch64-unknown-linux-gnu.tar.gz`
   - For Windows: `bb-x86_64-pc-windows-msvc.zip`
3. Extract the downloaded package:
   - For .tar.gz files (Linux and macOS):
     ```
     tar -xzf bb-<your-platform>.tar.gz
     ```
   - For .zip files (Windows):
     Extract using your preferred zip tool or the built-in Windows explorer.
4. Run the installation script:
   - For Linux and macOS:
     ```
     sudo ./install.sh
     ```
   - For Windows:
     Run `install.bat` as administrator

### Option 4: Manual Installation from Source

For developers or those who want to build from source:

1. Ensure you have [Deno](https://deno.com/) (latest stable version) installed.
2. Clone the BB repository:
   ```
   git clone https://github.com/Beyond-Better/bb.git
   cd bb
   ```
3. Build the project:
   ```
   deno task build
   ```
4. Move the built executables to a directory in your PATH:
   - For Linux and macOS:
     ```
     sudo mv ./build/bb ./build/bb-api /usr/local/bin/
     ```
   - For Windows:
     Move `bb.exe` and `bb-api.exe` to a directory in your PATH, such as `C:\Windows\System32\`

## Configuration

After installation, navigate to the project directory where you want to use BB and run:

```
bb init
```

On Windows:

```
bb.exe init
```

This will create a `.bb/config.yaml` file in your project directory and generate the necessary TLS certificates for secure operation. If `mkcert` or `openssl` is not available, you will receive an error message with instructions on how to install them.

## Setting Up Your Anthropic API Key

To use BB, you'll need an Anthropic API key. This is different from your Anthropic chat console login. Here's how to set it up:

1. Obtain an API key:
   - Go to the [Anthropic API Console](https://console.anthropic.com/settings/keys)
   - Sign in or create an account if you don't have one
   - Click on 'Create Key' to generate a new API key
   - Copy the API key (make sure to save it securely, as you won't be able to view it again)

2. Set up BB and add your API key:
   - Run the following command in your project directory:
     ```
     bb init
     ```
   - Follow the prompt wizard, which will ask for your API key and other configuration options
   - The wizard will automatically add your API key to the `.bb/config.yaml` file

Alternatively, if you prefer to manually edit the config file, you can add the API key to your `.bb/config.yaml` file directly.

Remember to keep your API key confidential and never share it publicly.

## Verifying Installation

To verify that BB has been installed correctly, run:

```
bb --help
bb-api --help
```

On Windows:

```
bb.exe --help
bb-api.exe --help
```

These commands should display the help information for BB and its API.

## BB Manager

After installation, you can use the BB Manager to easily manage multiple BB projects:

### Windows
Run `bb-manager.bat` from the installation directory or use the desktop shortcut.

### macOS
Open `BB Manager.applescript` from the installation directory.

### Linux
Run `bb-manager.sh` from the installation directory.

BB Manager allows you to:
- List, add, and remove BB projects
- Run BB commands (init, start, stop) for specific projects
- Automatically set the correct working directory for each project

## Usage

After installation, you can start using BB in the following ways:

1. Using BB Manager (Recommended):
   - Windows: Run `bb-manager.bat`
   - macOS: Open `BB Manager.applescript`
   - Linux: Run `bb-manager.sh`

   Use the BB Manager to add projects, initialize them, and start/stop BB for specific projects.

2. Browser Interface:
   To launch the API and open a browser window to start using BB, run:
   ```
   bb start
   ```
   This will start the BB API server and open your default web browser to the BB interface.

3. Command Line Interface:
   To launch the API and start the CLI for BB, run:
   ```
   bb chat
   ```
   This will start the BB API server and initiate a chat session in your terminal.

4. Direct Commands:
   You can also use BB directly from the command line:
   ```
   bb init   # Initialize BB in the current directory
   bb start  # Start the BB API and open the browser interface
   bb stop   # Stop the BB API server
   ```

All these methods provide access to BB's features, allowing you to interact with your projects and leverage BB's capabilities. The BB Manager is particularly useful for managing multiple projects efficiently.

## Troubleshooting

If you encounter any issues during installation or use:

1. Check the chat logs: `bb logs`
2. Check the API logs: `bb logs --api`
3. Inspect the JSON files under `.bb/data/conversations` for more detailed information

As BB is still in beta, please take necessary precautions when using it with important projects. If you encounter any problems, please create an issue on the [BB GitHub repository](https://github.com/Beyond-Better/bb).

## Getting Help

For more information or if you need assistance, please refer to the following resources:

- [BB GitHub Repository](https://github.com/Beyond-Better/bb)
- [CLI Documentation](docs/CLI.md)
- [API Documentation](docs/API.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Code of Conduct](docs/CODE_OF_CONDUCT.md)
- [Security Policy](docs/SECURITY.md)
- [File Handling Guidelines](docs/development/reference/file_handling.md)
- [Project Conventions](CONVENTIONS.md)

### Using BB

After installation, we recommend familiarizing yourself with BB's features:

1. **CLI Usage**: The [CLI Documentation](docs/CLI.md) provides a comprehensive guide on using BB from the command line. It covers all available commands, their options, and usage examples.

2. **API Integration**: If you're interested in integrating BB into your own tools or workflows, check out the [API Documentation](docs/API.md). It details all available endpoints, request/response formats, and authentication requirements.

These resources will help you get started with BB and make the most of its capabilities.

Remember, BB is in active development, and your feedback is valuable in improving the tool. Happy coding with BB (Beyond Better)!