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

BB requires TLS for secure operation. Here are some important points regarding TLS security:

1. TLS certificates are automatically generated during the initialization process using either `mkcert` or `openssl`.
2. If you're using custom certificates, ensure they are from a trusted source and kept up-to-date.
3. The TLS configuration options (`api.tlsKeyFile`, `tlsKeyPem`, `tlsCertFile`, `tlsCertPem`) should be handled with care, and the key files should be properly secured.
4. Regularly update your TLS certificates to maintain security standards.

Thank you for helping keep BB and our users safe!
