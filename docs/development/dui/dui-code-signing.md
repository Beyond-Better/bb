# DUI Code Signing Guide

This guide covers setting up code signing for the DUI (Desktop UI) component on macOS, both for local development and GitHub Actions builds.

## Prerequisites

- Apple Developer ID Application Certificate
- macOS development machine
- GitHub repository with appropriate secrets configured

## Local Development Setup

### Certificate Setup

1. Ensure you have the Apple root certificates:
   ```bash
   # Download certificates
   curl -O https://www.apple.com/certificateauthority/AppleRootCA-G2.cer
   curl -O https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer

   # Import to login keychain
   security import AppleRootCA-G2.cer -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign
   security import DeveloperIDG2CA.cer -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign
   ```

2. Import your Developer ID Application certificate:
   - Open Keychain Access
   - Import your .p12 certificate file
   - Set trust settings to "Always Trust"

3. Verify certificate chain:
   ```bash
   security find-identity -v -p codesigning
   ```
   Should show your Developer ID Application certificate.

4. Check for duplicate certificates:
   - Open Keychain Access
   - Check both "login" and "System" keychains
   - Remove any duplicates from System keychain

### Certificate Password Setup

1. Save certificate password to keychain:
   ```bash
   ./scripts/save_dui_cert_password.sh
   ```
   This stores the password securely in your keychain.

### Configuration

1. Verify tauri.conf.json has correct signing identity:
   ```json
   "macOS": {
     "signingIdentity": "YOUR_SIGNING_IDENTITY",
     "entitlements": "macos/entitlements.plist"
   }
   ```

2. Build and sign locally:
   ```bash
   APPLE_CERTIFICATE_PASSWORD=$(./scripts/get_dui_cert_password.sh) deno task tauri build
   ```

## GitHub Actions Setup

### Required Secrets

Configure these secrets in your GitHub repository:

- `APPLE_CERTIFICATE`: Base64-encoded Developer ID Application certificate (.p12)
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_TEAM_ID`: Your Apple Team ID
- `KEYCHAIN_PASSWORD`: Password for temporary keychain (can be random)
- `APPLE_API_KEY`: App Store Connect API key for notarization
- `APPLE_API_ISSUER`: API key issuer ID
- `APPLE_API_KEY_PATH`: Path where API key will be stored

### Workflow Configuration

The release workflow (.github/workflows/release.yml) handles:
1. Creating a temporary keychain
2. Importing certificates
3. Setting up signing environment
4. Building and signing the application
5. Notarizing the signed application

### Troubleshooting

Common issues and solutions:

1. Certificate Chain Issues:
   - Ensure no duplicate certificates across keychains
   - Verify root certificates are properly installed
   - Check certificate trust settings

2. Signing Failures:
   - Verify signing identity matches certificate
   - Ensure certificate password is correct
   - Check entitlements configuration

3. GitHub Actions Issues:
   - Verify all required secrets are set
   - Check workflow logs for specific error messages
   - Ensure certificate hasn't expired

## References

- [Apple Code Signing Documentation](https://developer.apple.com/support/code-signing/)
- [Tauri Signing Documentation](https://tauri.app/v1/guides/distribution/code-signing)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)