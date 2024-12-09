# DUI Quick Start Guide

This guide will help you get the BB Desktop UI (DUI) up and running quickly for development.

## Prerequisites

1. Install Rust and Cargo:
   ```bash
   # Windows: Download from https://www.rust-lang.org/tools/install
   # macOS/Linux:
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Install Deno:
   ```bash
   # Windows: Download from https://deno.land/#installation
   # macOS:
   brew install deno
   # Linux:
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

3. Install Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```

## Current Status

The DUI application is in active development with basic API management functionality:
- API server start/stop control
- Status monitoring
- Configuration reading
- Process management

See [API Integration](./API-INTEGRATION.md) for detailed status and next steps.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bb.git
   cd bb
   ```

2. Install required dependencies:
   ```bash
   cd dui
   deno install
   # Install required Babel plugins
   deno add npm:@babel/plugin-transform-react-jsx-development
   deno add npm:babel-plugin-transform-hook-names
   ```

3. Start the development server:
   ```bash
   deno task tauri dev
   ```

The application should now start in development mode. You should see:
1. The main application window
2. API management interface
3. Configuration display
4. Status indicators

Key features available:
- Hot reload for frontend changes
- Automatic rebuild for Rust changes
- Developer tools available

## Project Structure

Key directories and files:
```
dui/
├── src-tauri/        # Rust backend
├── src/              # Frontend code
│   ├── main.tsx      # Entry point
│   ├── app.tsx       # Root component
│   ├── components/   # UI components
│   └── hooks/        # Custom hooks
└── deno.json         # Deno configuration
```

## Next Steps

1. Review the main [DUI documentation](../../DUI.md)
2. Check the [development guide](./README.md)
3. Read the [getting started guide](./GETTING_STARTED.md) for development conversations

## Common Tasks

### Building for Production
```bash
cd dui
deno task tauri build
```

### Running Tests
```bash
# Frontend tests
deno test

# Rust tests
cd src-tauri
cargo test
```

### Development Tips

1. Use the developer tools (F12) to:
   - Debug frontend code
   - Monitor network requests
   - Check console output

2. Watch the terminal for:
   - Build errors
   - Rust compiler messages
   - Development server status

3. File locations:
   - Frontend code in `src/`
   - Rust code in `src-tauri/src/`
   - Configuration in `src-tauri/tauri.conf.json`