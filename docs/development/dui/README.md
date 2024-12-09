# BB Desktop UI Development Documentation

Welcome to the BB Desktop UI (DUI) development documentation. This directory contains detailed guides and documentation for developing and maintaining the BB Desktop UI application.

## Documentation Index

### Getting Started
- [Main DUI Documentation](../../DUI.md) - Overview, features, and setup guide
- [Getting Started Guide](./GETTING_STARTED.md) - Guide for development conversations
- [Quick Start Guide](./QUICK-START.md) - Get up and running quickly

### Configuration
- [Tauri Configuration Guide](./TAURI-CONFIG.md) - Detailed Tauri configuration documentation
- [Environment Setup](./ENVIRONMENT.md) - Development environment setup

### Development Guides
- [Architecture Overview](./ARCHITECTURE.md) - System design and component interaction
- [API Integration](./API-INTEGRATION.md) - BB API server management
- [Component Guidelines](./COMPONENTS.md) - UI component development
- [Testing Guide](./TESTING.md) - Testing strategy and implementation
- [Build Process](./BUILD.md) - Building and packaging

### Platform-Specific
- [Windows Development](./platforms/WINDOWS.md) - Windows-specific considerations
- [macOS Development](./platforms/MACOS.md) - macOS-specific considerations
- [Linux Development](./platforms/LINUX.md) - Linux-specific considerations

## Quick Links

1. Setup Development Environment:
   ```bash
   # Install dependencies
   cd dui
   deno install

   # Install required Babel plugins
   deno add npm:@babel/plugin-transform-react-jsx-development
   deno add npm:babel-plugin-transform-hook-names

   # Start development
   deno task tauri dev
   ```

2. Build for Production:
   ```bash
   cd dui
   deno task tauri build
   ```

## Configuration Files

Key configuration files:
- `dui/src-tauri/tauri.conf.json` - Main Tauri configuration
- `dui/deno.json` - Deno configuration
- `dui/src-tauri/Cargo.toml` - Rust dependencies
- `dui/tsconfig.json` - TypeScript configuration

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

1. BB API Server Management:
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
   
   See [API Integration](./API-INTEGRATION.md) for detailed status and next steps.

2. Project Management:
   - List BB projects
   - Add/remove projects
   - Select active project
   - Project configuration

3. User Interface:
   - Clean, modern design
   - Dark/light theme support
   - Responsive layout
   - Native OS integration

## Development Workflow

1. Code Organization:
   - Frontend code in `src/`
   - Backend code in `src-tauri/src/`
   - Shared types in `src/types/`
   - Components in `src/components/`

2. Development Process:
   - Use `deno task tauri dev` for development
   - Hot reload for frontend changes
   - Automatic rebuild for Rust changes
   - Live log viewing

3. Testing:
   - Unit tests for Rust code
   - Component tests for UI
   - Integration tests for API
   - Cross-platform testing

4. Building:
   - Development: `deno task tauri dev`
   - Production: `deno task tauri build`
   - Platform-specific builds

## Contributing

Before contributing:
1. Read the [main DUI documentation](../../DUI.md)
2. Check the [contribution guidelines](../../CONTRIBUTING.md)
3. Review the [architecture overview](./ARCHITECTURE.md)
4. Set up your development environment
5. Run tests and ensure changes meet guidelines

## Getting Help

If you need help:
1. Check the existing documentation
2. Review troubleshooting guides
3. Search the issue tracker
4. Create a new issue if needed

## Documentation Updates

When updating documentation:
1. Keep the index in this README up to date
2. Maintain consistency across documents
3. Include practical examples
4. Test code snippets
5. Update related documentation