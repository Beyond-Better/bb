# Beyond Better Release Process

This document describes the unified release process for Beyond Better, including both the BB binaries and the DUI (Desktop User Interface).

## Overview

The release process is handled by a single GitHub Actions workflow that:
1. Builds BB & BB-API binaries for all platforms
2. Builds DUI for all supported platforms (macOS, Windows, Linux)
3. Creates a single GitHub release containing all assets

## Release Assets

Each release includes:

1. BB & BB-API Binaries:
   - Linux
     * x86_64-unknown-linux-gnu (.tar.gz, .zip)
     * aarch64-unknown-linux-gnu (.tar.gz, .zip)
   - macOS
     * x86_64-apple-darwin (.tar.gz, .zip)
     * aarch64-apple-darwin (.tar.gz, .zip)
   - Windows
     * x86_64-pc-windows-msvc (.zip)

2. DUI Applications:
   - macOS
     * Intel (.dmg, .app.tar.gz)
     * Apple Silicon (.dmg, .app.tar.gz)
   - Windows
     * x64 (.msi installer)
     * x64 (NSIS .exe installer)
   - Linux
     * x64 (.AppImage)

## Version Management

1. Version Source:
   - `version.ts` is the canonical source of version numbers
   - All other version references (like tauri.conf.json) should match
   - Version updates are handled by the update_version.ts script

2. Version Format:
   - Semantic versioning (MAJOR.MINOR.PATCH)
   - Git tags: v{version} (e.g., v0.4.1)
   - Release title: Release v{version}

## Release Process

### Automated Release (GitHub Actions)

1. Trigger Options:
   - Push to main branch
   - Push to release-build-testing branch (for testing)
   - Manual workflow dispatch (with version input)

2. Build Process:
   - Binary builds run in parallel for all targets
   - DUI builds run in parallel for macOS architectures
   - Release creation waits for all builds to complete

3. Release Creation:
   - Creates a draft release
   - Uploads all build artifacts
   - Includes installation instructions and changelog
   - Can be reviewed before publishing

### Manual Release Steps

1. Update Version:
   ```bash
   deno run -A scripts/update_version.ts {new-version}
   ```

2. Test Release:
   - Push to release-build-testing branch
   - Verify workflow completes successfully
   - Test downloaded assets
   - Check release notes format

3. Production Release:
   - Merge to main branch
   - Verify workflow completes successfully
   - Review draft release
   - Publish release

## Testing Releases

1. Binary Testing:
   - Verify executables run correctly
   - Test installation scripts
   - Check version reporting
   - Test core functionality

2. DUI Testing:
   - Verify installation process
   - Test binary download/installation
   - Check version reporting
   - Test core functionality

## Troubleshooting

1. Build Failures:
   - Check workflow logs for specific job failures
   - Verify all required secrets are available
   - Check artifact upload/download logs

2. Release Issues:
   - Verify version numbers match
   - Check GitHub token permissions
   - Review asset upload logs

## Future Enhancements

1. Code Signing:
   - Windows code signing
   - macOS code signing and notarization
   - Linux package signing

2. Additional Linux Packages:
   - Debian (.deb) packages
   - RPM packages
   - Repository setup

3. Automated Testing:
   - Pre-release testing automation
   - Installation verification
   - Cross-platform compatibility checks