# DUI Code Signing Notes

## Current Status

- GitHub Actions signing works correctly
- Local signing encounters certificate chain building issues
- Local development builds can proceed without signing

## Attempted Solutions

We attempted several approaches to fix local signing:

1. Certificate Chain Setup
   - Imported Apple Root CA - G2
   - Imported Developer ID Certification Authority
   - Fresh Developer ID Application certificate from Apple Developer portal
   - Verified all certificates present in keychain

2. Dedicated Codesigning Keychain
   - Created separate codesigning keychain
   - Imported certificates in correct order
   - Set proper trust settings
   - Added to keychain search list

3. Trust Settings
   - Added explicit trust settings for Root CA
   - Added explicit trust settings for Developer ID CA
   - Verified trust settings with `security dump-trust-settings -d`

4. Signing Tests
   - Test file signing shows same error as Tauri builds
   - Error: "unable to build chain to self-signed root"
   - Error: "errSecInternalComponent"

## Current Error

```
Warning: unable to build chain to self-signed root for signer "Developer ID Application: Charlie Garrison (N9YUD25J5J)"
errSecInternalComponent
```

## Local Development Workaround

For local development, you can skip signing using the development-specific tasks:

1. For development:
```bash
deno task tauri-dev
```

2. For production builds:
```bash
deno task tauri-build
```

These tasks automatically generate and use an unsigned configuration file:

1. `scripts/create_unsigned_config.ts` creates a copy of tauri.conf.json with signing disabled
2. The generated file (src-tauri/tauri.dev.conf.json) is created on demand
3. The file is git-ignored to prevent committing unsigned configurations

This approach ensures:
- Development config stays in sync with production config
- No manual maintenance of separate config files
- Clear separation between signed and unsigned builds

The tasks handle all the configuration management automatically - just run the appropriate task for your needs.

## Production Builds

Production builds should continue to use GitHub Actions, which handles signing correctly using the following environment variables:

```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: ${{ env.CERT_ID }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

## Future Investigation

If local signing becomes necessary:
1. Consider completely removing all certificates and doing fresh imports
2. Check for system-level keychain or security issues
3. Compare local and GitHub Actions environments in detail