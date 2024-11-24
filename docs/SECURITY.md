# Security Policy

## Reporting a Vulnerability

The BB project takes security seriously. We appreciate your efforts to responsibly disclose your findings.

To report a security issue, please use the GitHub Security Advisory ["Report a Vulnerability"](https://github.com/Beyond-Better/bb/security/advisories/new) tab.

The BB team will send a response indicating the next steps in handling your report. After the initial reply to your report, the security team will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

## Supported Versions

As BB is currently in alpha, we only support the latest version with security updates. Once we reach a stable release, we will provide a table of supported versions here.

## Security Update Process

Once we have confirmed a security issue, we will:

1. Develop a fix and test it thoroughly.
2. Prepare a security advisory detailing the vulnerability and the fix.
3. Release a new version containing the fix.
4. Publish the security advisory.

## Best Practices

While using BB:

1. Always use the latest version.
2. Do not expose the BB API to the public internet.
3. Be cautious when using BB with sensitive data or codebases.
4. Regularly check for and apply updates.
5. Ensure that TLS certificates are properly configured and up-to-date.

## TLS Security

BB includes built-in TLS certificate management for secure operation. Here are the key security aspects:

1. Certificate Management:
   - Automatic certificate generation and trust store integration
   - Self-contained certificate authority (CA) creation
   - Secure certificate storage and handling
   - Automatic trust store updates

2. Security Features:
   - TLS enabled by default for all connections
   - Automatic certificate renewal before expiry
   - Platform-specific trust store integration
   - Certificate validation and verification

3. Best Practices:
   - Keep TLS enabled (default setting)
   - Monitor certificate expiry through status page
   - Back up certificate files when deploying
   - Use `bb secure status` to check certificate health

4. Advanced Configuration:
   - Custom certificate support via configuration
   - Multiple certificate storage options
   - Flexible trust store management
   - Certificate pinning capabilities

For detailed information about certificate management, see:
- [Certificate Management Guide](docs/user/security/certificates.md)
- [Trust Store Guide](docs/user/security/trust-store.md)
- [Security Troubleshooting](docs/user/security/troubleshooting.md)

Thank you for helping keep BB and our users safe!
