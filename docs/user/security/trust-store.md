# BB Trust Store Guide

This guide explains how BB manages certificate trust stores across different platforms.

## What is a Trust Store?

A trust store is a system-level database of trusted certificate authorities (CAs). When BB creates its local CA, it needs to add it to your system's trust store so your browser will trust the certificates BB creates.

## Trust Store Locations

### macOS
- Location: `/Library/Keychains/System.keychain`
- Managed by: Keychain Access
- View certificates:
  1. Open Applications > Utilities > Keychain Access
  2. Select "System" keychain
  3. Click "Certificates" category
  4. Look for "Beyond Better CA"

### Windows
- Location: `Cert:\LocalMachine\Root`
- Managed by: Certificate Manager (certmgr.msc)
- View certificates:
  1. Press Windows+R
  2. Type `certmgr.msc` and press Enter
  3. Expand "Trusted Root Certification Authorities"
  4. Click "Certificates"
  5. Look for "Beyond Better CA"

### Linux
- Debian/Ubuntu:
  - Location: `/usr/local/share/ca-certificates`
  - Update command: `sudo update-ca-certificates`
- RHEL/CentOS/Fedora:
  - Location: `/etc/pki/ca-trust/source/anchors`
  - Update command: `sudo update-ca-trust`

## Trust Store Management

### Automatic Management
BB automatically manages the trust store:
1. Creates a local CA during initialization
2. Adds CA to system trust store
3. Updates trust store when needed
4. Handles platform-specific requirements

### Manual Verification
To verify trust store status:
```bash
bb secure status
```

This shows:
- Trust store location
- CA certificate status
- Trust level
- Last update time

### Common Issues

1. Permission Denied
   - Run BB commands with admin privileges
   - Check file permissions
   - Verify user has trust store access

2. Certificate Not Trusted
   - Check trust store status
   - Re-enable TLS: `bb secure on`
   - Verify CA in trust store manually

3. Trust Store Updates Failed
   - Check system logs
   - Verify admin access
   - Try manual trust store update

## Security Considerations

1. Trust Store Access
   - BB needs admin access to modify trust store
   - Password prompt is normal and secure
   - Changes are logged for security

2. CA Certificate
   - Stored securely in BB config directory
   - Used only for local development
   - Regenerated if compromised

3. Best Practices
   - Keep trust store clean
   - Monitor certificate expiry
   - Back up certificates
   - Use `bb secure status` regularly

## Advanced Topics


### Trust Store Backup
Important trust store files to back up:
1. CA certificate (caRoot.pem)
2. CA private key (caRoot-key.pem)
3. Trust store configuration

### Trust Level Management
BB certificates can have different trust levels:
- SSL/TLS (default)
- Code signing
- Email protection

Configure in BB settings if needed.