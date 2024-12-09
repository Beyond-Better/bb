# BB Desktop User Interface (DUI)

## Overview

The Desktop User Interface (DUI) for BB provides a native application experience for managing the BB API server and services. Built with Tauri and Preact, it offers a lightweight, secure, and performant solution for BB project management.

## Features

Primary Features:
- BB API server management (start/stop)
- Real-time log viewing
- Project management
- Cross-platform support (Windows, macOS, Linux)

Additional Features:
- Dark/light theme support
- Native notifications
- Minimal resource usage
- Optional system tray integration

## Technology Stack

- [Tauri](https://tauri.app/) 2.1.1: Core framework for native desktop application
- [Preact](https://preactjs.com/): Frontend UI library
- [TypeScript](https://www.typescriptlang.org/): Type-safe development
- [Rust](https://www.rust-lang.org/): Backend system integration
- [Deno](https://deno.land/): Development runtime

## Getting Started

### Prerequisites

1. Install Rust and Cargo:
   - Windows: https://www.rust-lang.org/tools/install
   - macOS/Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

2. Install Deno:
   - https://deno.land/manual/getting_started/installation

3. Install Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bb.git
   cd bb
   ```

2. Start development server:
   ```bash
   cd dui
   deno install
   deno task tauri dev
   ```

### Building for Production

1. Build the application:
   ```bash
   cd dui
   deno task tauri build
   ```

   The built application will be available in:
   - Windows: `dui/src-tauri/target/release/bb-dui.exe`
   - macOS: `dui/src-tauri/target/release/bundle/dmg/BB Manager.app`
   - Linux: `dui/src-tauri/target/release/bundle/deb/bb-dui.deb`

## Project Structure

```
dui/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # Tauri application entry
│   │   ├── api.rs       # BB API integration
│   │   └── config.rs    # Configuration management
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
├── src/                 # Frontend
│   ├── main.tsx        # Preact entry point
│   ├── app.tsx         # Main application component
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks
│   └── types/          # TypeScript types
└── deno.json           # Deno configuration
```

## Development Guidelines

1. Code Style:
   - Follow Rust style guide for backend code
   - Use TypeScript best practices
   - Follow Preact patterns and conventions

2. Testing:
   - Write unit tests for Rust backend
   - Test Preact components
   - Perform cross-platform testing

3. Performance:
   - Minimize main thread blocking
   - Optimize resource usage
   - Handle large log files efficiently

4. Security:
   - Follow Tauri security guidelines
   - Validate all user inputs
   - Handle sensitive data appropriately

## Contributing

1. Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
2. Fork the repository
3. Create a feature branch
4. Submit a pull request

For more detailed development information, see [docs/development/dui/README.md](development/dui/README.md).