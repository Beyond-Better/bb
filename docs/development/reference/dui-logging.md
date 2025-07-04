# Logging Configuration

## Overview
The DUI application uses log4rs for structured logging with automatic log rotation. The configuration is set up programmatically in `dui/src-tauri/src/logging/mod.rs`.

## Log Files

### Application Log
- File: `Beyond Better.log`
- Location: Platform-specific log directory
  - macOS: `~/Library/Logs/Beyond Better/`
  - Windows: `%ProgramData%\Beyond Better\logs\`
  - Linux: `~/.bb/logs/`
- Rotation:
  - Size trigger: 10MB
  - Keeps 5 files
  - Naming: `Beyond Better.1.log`, `Beyond Better.2.log`, etc.
- Format: `[YYYY-MM-DD HH:MM:SS.mmm] LEVEL Thread - Message`

### Proxy Access Log
- File: `proxy-access.log`
- Same location as application log
- Rotation:
  - Size trigger: 10MB
  - Keeps 5 files
  - Naming: `proxy-access.1.log`, `proxy-access.2.log`, etc.
- Format: `[YYYY-MM-DD HH:MM:SS.mmm] Message`

## Configuration

### Log Levels
- Debug mode (development): DEBUG and above
- Production mode: INFO and above
- Proxy logger: Always INFO for access logs

### Log Patterns
1. Application Log:
   ```
   [2024-03-19 10:15:23.456] INFO Thread - Message
   ```
   - Includes thread name for debugging
   - Level is highlighted for visibility
   - Millisecond precision timestamps

2. Proxy Access Log:
   ```
   [2024-03-19 10:15:23.456] GET /api/v1/status 200 45ms -> chat.beyondbetter.app
   ```
   - Simpler format for access logging
   - Includes request method, path, status, duration, and target

## Usage

### Application Logging
```rust
use log::{debug, info, warn, error};

// Debug level - only shown in development
debug!("Detailed information for debugging");

// Info level - normal operational messages
info!("Application started successfully");

// Warning level - potential issues
warn!("Configuration file not found, using defaults");

// Error level - serious problems
error!("Failed to connect to API: {}", error);
```

### Proxy Access Logging
```rust
// Logged through the AccessLogger
log::info!(target: "proxy", "Access log message");
```

## Implementation Details

### Log Directory Handling
- Log directory is determined at runtime
- Created if it doesn't exist
- Full paths are constructed for each appender

### Debug Mode
- Debug level enabled when `cfg!(debug_assertions)` is true
- More verbose logging in development
- Proxy logs all requests in debug mode

### Log Rotation
- Size-based rotation at 10MB
- Keeps 5 backup files
- Uses fixed window naming strategy
- Separate rotation for app and proxy logs

### Error Handling
- Failed log writes are logged to stderr
- Application continues running if logging fails
- Proxy maintains separate error logging

## Best Practices

1. Log Levels
   - DEBUG: Detailed information for debugging
   - INFO: Normal operation events
   - WARN: Potential issues that need attention
   - ERROR: Serious problems that need immediate attention

2. Message Content
   - Include relevant context
   - Use structured data when possible
   - Include error details and stack traces
   - Avoid sensitive information

3. Performance
   - Use debug! for verbose logging
   - Check log level before expensive operations
   - Consider log rotation limits for storage

4. Maintenance
   - Monitor log file sizes
   - Review old logs periodically
   - Adjust rotation settings as needed