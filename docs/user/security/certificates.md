# TLS Certificate Management in BB

BB uses TLS certificates to ensure secure communication between the browser interface and the API server. This guide explains how certificates work in BB and how to manage them.

## Overview

BB automatically handles TLS certificate creation and management. When you first initialize BB or enable TLS, it will:
1. Create a local Certificate Authority (CA)
2. Create a server certificate signed by that CA
3. Add the CA to your system's trust store

## Managing Certificates

### Enabling/Disabling TLS

Use the `bb secure` command to manage TLS:

```bash
bb secure on   # Enable TLS (recommended)
bb secure off  # Disable TLS (not recommended)
bb secure status   # Check TLS status
```

### Certificate Status

You can check your certificate status in two ways:

1. Command Line:
```bash
bb secure status
```

2. Browser:
- Open the BB API status page at https://localhost:3162/api/v1/status
- View detailed certificate information and trust store status

### Certificate Locations

BB stores certificates in your global BB configuration directory:
- macOS/Linux: `~/.config/bb/`
- Windows: `%APPDATA%\bb\`

Files:
- `localhost.pem`: Your CA certificate
- `localhost-key.pem`: Your CA private key
- `CAcert.pem`: Your server certificate
- `CAcert-key.pem`: Your server private key

### Trust Store Locations

BB adds the CA certificate to your system's trust store:
- macOS: `/Library/Keychains/System.keychain`
- Windows: `Cert:\LocalMachine\Root`
- Linux: `/usr/local/share/ca-certificates` or `/etc/pki/ca-trust/source/anchors`

## Browser Security Warnings

When using a self-signed certificate, you may see security warnings in your browser. This is normal and expected.

### Chrome/Brave
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

### Firefox
1. Click "Advanced..."
2. Click "Accept the Risk and Continue"

### Safari
1. Click "Show Details"
2. Click "visit this website"

### Edge
1. Click "Advanced"
2. Click "Continue to localhost (unsafe)"

These warnings appear because your browser doesn't recognize our local certificate authority. The connection is still encrypted and secure for local development.

## Troubleshooting

### Certificate Not Trusted
If your browser doesn't trust the certificate:
1. Check the trust store status: `bb secure status`
2. Try re-enabling TLS: `bb secure on`
3. Check your system's trust store manually (see locations above)

### Certificate Expired
If your certificate has expired:
1. Run `bb secure on` to generate new certificates
2. Restart the BB API server: `bb restart`

### Missing Certificates
If certificates are missing:
1. Run `bb secure on` to generate new certificates
2. Check the certificate locations (see above)
3. Restart the BB API server: `bb restart`

## Security Best Practices

1. Always use TLS (enabled by default)
2. Keep your certificate files secure
3. Regenerate certificates if they're compromised
4. Monitor certificate expiry dates
5. Back up your certificates when deploying

## Advanced Configuration

BB provides several configuration options for TLS:

```yaml
api:
  apiUseTls: true
  tlsCertFile: "cert.pem"    # Path to certificate file
  tlsKeyFile: "key.pem"      # Path to key file
  tlsCertPem: ""            # Inline certificate content
  tlsKeyPem: ""             # Inline key content
```

Use either file paths or inline PEM content, not both.