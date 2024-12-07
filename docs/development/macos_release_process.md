# macOS Release Process

This document describes the process for building and releasing the Beyond Better DUI for macOS.

## Overview

The DUI (Desktop User Interface) is built using Tauri and supports both Intel (x86_64) and Apple Silicon (aarch64) architectures. The release process is automated through GitHub Actions.

## Release Assets

Each release includes:
- `.app` bundles (archived as `.tar.gz`)
  * Intel (x86_64) version
  * Apple Silicon (aarch64) version
- `.dmg` disk images
  * Intel (x86_64) version
  * Apple Silicon (aarch64) version

## Build Configuration

The build configuration is defined in `dui/src-tauri/tauri.conf.json` and includes:
- DMG installer window layout
- Minimum macOS version (10.13)
- Required entitlements
- Icon configurations

## Release Process

### Automated Release (GitHub Actions)

1. Trigger a release by either:
   - Pushing to the `release` branch
   - Using the "DUI macOS Release" workflow manually with a version number

2. The workflow will:
   - Build for both Intel and Apple Silicon
   - Create `.app` bundles and `.dmg` installers
   - Create a draft release
   - Upload all assets with architecture-specific names

### Manual Release Steps

If needed, you can build locally using:
```bash
cd dui
# For Intel Macs
deno task tauri build --target x86_64-apple-darwin

# For Apple Silicon Macs
deno task tauri build --target aarch64-apple-darwin
```

## Asset Naming Convention

Release assets follow this naming pattern:
- `BB-dui-{version}-macos-intel.dmg`
- `BB-dui-{version}-macos-intel.app.tar.gz`
- `BB-dui-{version}-macos-apple-silicon.dmg`
- `BB-dui-{version}-macos-apple-silicon.app.tar.gz`

## Version Management

- The version number is managed in `dui/src-tauri/tauri.conf.json`
- When using manual workflow triggers, the input version must match the config
- Git tags are created in the format `dui-v{version}`

## Requirements

### Build Environment
- macOS machine (for local builds)
- Xcode Command Line Tools
- Rust with appropriate targets
- Deno

### Signing and Notarization
- Apple Developer account (for future signing implementation)
- Developer certificate
- App-specific password for notarization

## Future Enhancements

1. Code Signing
   - Implementation pending Apple Developer account
   - Will require additional workflow secrets
   - Will enable notarization

2. Notarization
   - To be implemented after signing
   - Required for distribution outside App Store
   - Will add additional build time

3. App Store Distribution
   - Future consideration
   - Will require additional configuration
   - Separate distribution process