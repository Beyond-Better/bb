# BB Security Troubleshooting Guide

This guide helps you resolve common security-related issues in BB.

## Certificate Issues

### Browser Security Warnings

#### Problem
Browser shows security warning when accessing BB interface.

#### Solution
This is normal for development certificates. Each browser handles it differently:

**Chrome/Brave**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

**Firefox**
1. Click "Advanced..."
2. Click "Accept the Risk and Continue"

**Safari**
1. Click "Show Details"
2. Click "visit this website"

**Edge**
1. Click "Advanced"
2. Click "Continue to localhost (unsafe)"

### Certificate Not Found

#### Problem
Error: "Certificate files are missing" or TLS connection fails.

#### Solution
1. Check certificate status:
   ```bash
   bb secure status
   ```
2. Regenerate certificates:
   ```bash
   bb secure on
   ```
3. Restart BB:
   ```bash
   bb restart
   ```

### Certificate Expired

#### Problem
Certificate expiry warnings or TLS errors.

#### Solution
1. Check expiry status:
   ```bash
   bb secure status
   ```
2. Generate new certificates:
   ```bash
   bb secure on
   ```
3. Verify new certificates:
   ```bash
   bb secure status
   ```

## Trust Store Issues

### Trust Store Access Denied

#### Problem
Cannot modify system trust store, permission errors.

#### Solution
**macOS**
1. Enter your login password when prompted
2. Check System Preferences > Security & Privacy
3. Try running BB commands with `sudo`

**Windows**
1. Run Command Prompt as Administrator
2. Accept User Account Control (UAC) prompt
3. Check Windows Security settings

**Linux**
1. Use `sudo` when prompted
2. Check user is in sudo group
3. Verify trust store permissions

### Certificate Not Trusted

#### Problem
Certificate added but still not trusted by system.

#### Solution
1. Verify trust store status:
   ```bash
   bb secure status
   ```
2. Check trust store manually:
   - macOS: Keychain Access > System > Certificates
   - Windows: certmgr.msc > Trusted Root Certification Authorities
   - Linux: ls -l /etc/ssl/certs/
3. Re-add certificate:
   ```bash
   bb secure on
   ```

### Trust Store Update Failed

#### Problem
Error updating system trust store.

#### Solution
1. Check system requirements:
   - macOS: Security & Privacy settings
   - Windows: Admin privileges
   - Linux: Required packages installed
2. Try manual trust store update:
   - macOS: Use Keychain Access
   - Windows: Use Certificate Manager
   - Linux: Run update-ca-certificates
3. Check system logs for errors

## Configuration Issues

### TLS Disabled Unexpectedly

#### Problem
TLS becomes disabled after restart or update.

#### Solution
1. Check configuration:
   ```bash
   bb config get api.apiUseTls
   ```
2. Enable TLS:
   ```bash
   bb secure on
   ```
3. Verify configuration:
   ```bash
   bb secure status
   ```

### Custom Certificate Problems

#### Problem
Issues with custom certificates or configuration.

#### Solution
1. Verify certificate format
2. Check file permissions
3. Update configuration:
   ```bash
   bb config set api.tlsCertFile "path/to/cert.pem"
   bb config set api.tlsKeyFile "path/to/key.pem"
   ```
4. Restart BB:
   ```bash
   bb restart
   ```

## Prevention

### Best Practices

1. Regular Checks
   - Run `bb secure status` weekly
   - Monitor certificate expiry
   - Keep BB updated

2. Backup
   - Back up certificates before changes
   - Save trust store configuration
   - Document custom settings

3. Security
   - Keep TLS enabled
   - Use strong passwords
   - Maintain system updates

### Common Mistakes to Avoid

1. Certificate Management
   - Don't disable TLS
   - Don't ignore expiry warnings
   - Don't share private keys

2. Trust Store
   - Don't manually delete certificates
   - Don't modify trust store directly
   - Don't ignore permission errors

3. Configuration
   - Don't mix custom and auto certificates
   - Don't expose private keys in config
   - Don't use expired certificates

## Getting Help

If you can't resolve an issue:

1. Gather Information
   - Run `bb secure status`
   - Check logs: `bb logs --api`
   - Note any error messages

2. Check Documentation
   - [Certificate Guide](certificates.md)
   - [Trust Store Guide](trust-store.md)
   - [Security Policy](../../SECURITY.md)

3. Get Support
   - Create GitHub issue
   - Include all gathered information
   - Describe steps to reproduce