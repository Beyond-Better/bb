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

2. Install dependencies:
   ```bash
   cd dui
   deno install

   # Install required Babel plugins
   deno add npm:@babel/plugin-transform-react-jsx-development
   deno add npm:babel-plugin-transform-hook-names
   ```

3. Start development server:
   ```bash
   deno task tauri dev
   ```

### Building for Production

Build the application:
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
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs        # Application entry
│   │   ├── api.rs         # BB API integration
│   │   └── config.rs      # Configuration
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── src/                    # Frontend
│   ├── main.tsx           # Entry point
│   ├── app.tsx            # Root component
│   ├── components/        # UI components
│   │   ├── LogViewer/     # Log display
│   │   ├── ProjectList/   # Project management
│   │   └── StatusBar/     # API status
│   ├── hooks/             # Custom hooks
│   │   ├── useApi.ts      # API management
│   │   └── useConfig.ts   # Configuration
│   └── types/             # TypeScript types
└── deno.json              # Deno config
```

## Core Features

### 1. BB API Server Management
- Start/stop API server (Implemented)
  * Direct bb-api binary execution
  * Configuration-based startup
  * Process management with PID tracking
- Monitor server status (Implemented)
  * Real-time status updates
  * Process health checking
  * API response verification
- View server logs (Planned)
- Configure server settings (Planned)

### 2. Project Management
- List BB projects
- Add/remove projects
- Select active project
- Project configuration

### 3. User Interface
- Clean, modern design
- Dark/light theme support
- Responsive layout
- Native OS integration

## Development Guidelines

### 1. Code Style
- Follow Rust style guide for backend code
- Use TypeScript best practices
- Follow Preact patterns and conventions

### 2. Testing
- Write unit tests for Rust code
- Test Preact components
- Perform cross-platform testing
- Integration tests for API

### 3. Performance
- Minimize main thread blocking
- Optimize resource usage
- Handle large log files efficiently

### 4. Security
- Follow Tauri security guidelines
- Validate all user inputs
- Handle sensitive data appropriately

## Configuration Files

Key configuration files:
- `dui/src-tauri/tauri.conf.json` - Main Tauri configuration
- `dui/deno.json` - Deno configuration
- `dui/src-tauri/Cargo.toml` - Rust dependencies
- `dui/tsconfig.json` - TypeScript configuration

## Contributing

1. Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
2. Fork the repository
3. Create a feature branch
4. Submit a pull request

## Getting Help

If you need help:
1. Check the existing documentation
2. Review troubleshooting guides
3. Search the issue tracker
4. Create a new issue if needed