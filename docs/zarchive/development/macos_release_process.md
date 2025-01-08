# macOS DUI Release Process

This document describes the macOS-specific aspects of building and releasing the Beyond Better DUI. For the complete release process, see [release_process.md](./release_process.md).

## Overview

The macOS DUI is built using Tauri and supports both Intel (x86_64) and Apple Silicon (aarch64) architectures. The build process is integrated into the main release workflow.

## Build Configuration

### Tauri Configuration
The build configuration is defined in `dui/src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "dmg": {
        "windowSize": {
          "width": 660,
          "height": 400
        },
        "appPosition": {
          "x": 180,
          "y": 170
        },
        "applicationFolderPosition": {
          "x": 480,
          "y": 170
        }
      }
    }
  }
}
```

### Entitlements
Located in `dui/src-tauri/macos/entitlements.plist`:
- File system access for ~/.bb/bin
- Network access for API
- Binary execution permissions
- URL handling capabilities

## Build Process

The macOS build process:
1. Builds frontend assets using Deno
2. Compiles Rust code for both architectures
3. Creates .app bundles
4. Packages .dmg installers

### Build Artifacts
For each architecture (Intel and Apple Silicon):
- .app bundle (archived as .tar.gz)
- .dmg installer
- Debug symbols (future)

## Testing

### Local Testing
```bash
cd dui

# For Intel Macs
deno task tauri build --target x86_64-apple-darwin

# For Apple Silicon Macs
deno task tauri build --target aarch64-apple-darwin
```

### Installation Testing
1. Download appropriate .dmg
2. Mount and verify installer window
3. Test drag-and-drop installation
4. Launch application
5. Verify binary installation process
6. Test core functionality

## Future Enhancements

1. Code Signing
   - Apple Developer account required
   - Signing certificate setup
   - Entitlements validation

2. Notarization
   - Required for distribution outside App Store
   - Automated notarization process
   - Stapling notarization ticket

3. App Store Distribution
   - Additional requirements
   - Modified entitlements
   - Store-specific assets

## Troubleshooting

### Build Issues
- Check Rust toolchain for target architecture
- Verify Tauri dependencies
- Review entitlements configuration

### Installation Issues
- Verify DMG contents
- Check permissions
- Review system requirements

### Runtime Issues
- Check entitlements
- Verify binary permissions
- Review log files