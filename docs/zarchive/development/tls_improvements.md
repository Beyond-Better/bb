# TLS Certificate Handling Improvements

## Background
The initial problem was the difficulty users face when installing BB due to TLS certificate requirements. Currently, a TLS cert must be created to keep browsers happy with connecting to the API. Creating the cert requires extra non-trivial dependencies (mkcert or openssl), making the otherwise simple one-line installation more complex.

## Solutions Considered

### 1. Cloud-hosted API Proxy
A proposed solution to handle the TLS certificate requirement:
- Create a cloud-hosted API proxy
- Both local API and browser (BUI) would connect to cloud API
- Proxy would handle all websocket messages and HTTP requests
- HTTP requests would need to be wrapped in websocket connection

Advantages:
- Eliminates local TLS requirement
- Simple authentication via locally generated ID and token
- No user accounts needed

Challenges:
- Introduces latency
- Single point of failure
- Future scaling concerns
- Privacy implications (all traffic passes through proxy)
- Connection drops/reconnects handling needed

### 2. Self-Signed Certificate Automation
Alternative approach focusing on improving the local certificate handling:
- Bundle minimal certificate generation utility with BB
- Eliminate external dependencies using pure TypeScript/Deno
- Automated certificate management
- Better user guidance and status information

Progress Made:
1. Enhanced Status Page:
   - Added comprehensive certificate information display
   - Implemented certificate type detection
   - Added validity period tracking
   - Created user-friendly date formatting
   - Added expiry status with visual indicators

2. Certificate Inspection:
   - Implemented using Node's X509Certificate via Deno
   - Removed dependency on external tools (openssl)
   - Added parsing for certificate dates
   - Added self-signed certificate detection

3. Configuration Changes:
   - Updated status endpoint to handle both project and global configs
   - Added content negotiation (HTML/JSON responses)
   - Enhanced error handling

## Immediate Next Steps

1. UI Improvements:
   - Add CSS styles for the new validity-info section
   - Enhance visual hierarchy of certificate information
   - Improve mobile responsiveness

2. Documentation:
   - Add more detailed instructions for certificate renewal
   - Document different certificate types and their implications
   - Add troubleshooting guides for common certificate issues

3. Implementation:
   - Create `bb secure` command for certificate management and dis/enabling `api.apiUseTls` setting
   - Implement certificate renewal functionality
   - Add automated certificate backup

## Future Work

1. Certificate Generation:
   - Investigate pure JS/TS certificate generation (see commented code in tlsCerts.utils.ts)
   - Evaluate mkcert npm module for potential integration
   - Add support for custom certificate authorities

2. Security Enhancements:
   - Implement certificate pinning
   - Add certificate rotation policies
   - Enhance validation and verification

3. User Experience:
   - Add interactive certificate setup wizard
   - Implement automatic certificate renewal
   - Add system tray notifications for certificate status

4. Testing:
   - Add tests for certificate verification
   - Add tests for date parsing
   - Add integration tests for certificate management

## Technical Details

### Certificate Inspection
Using Node's X509Certificate class via Deno's Node compatibility layer:
```typescript
import { X509Certificate } from 'node:crypto';

const cert = new X509Certificate(certPem);
const info = {
  isSelfSigned: cert.issuer === cert.subject,
  issuer: cert.issuer,
  subject: cert.subject,
  validFrom: parseX509Date(cert.validFrom),
  validTo: parseX509Date(cert.validTo)
};
```

### Date Handling
Custom parsing for X509 certificate dates:
```typescript
function parseX509Date(dateStr: string): Date {
  // Handle format: "Oct  1 06:47:11 2024 +00:00"
  const normalizedStr = dateStr.replace(/\s+/g, ' ').trim();
  return new Date(normalizedStr);
}
```

## Marketing Site Documentation Updates

The following pages need to be added or updated on the BeyondBetter.dev marketing site to reflect the new TLS improvements:

### New Pages to Create

1. `/docs/security/certificates`
   - Copy content from: `docs/user/security/certificates.md`
   - Add to Security section in navigation
   - Include screenshots of browser warnings
   - Add platform-specific trust store screenshots

2. `/docs/security/trust-store`
   - Create guide for trust store management
   - Platform-specific instructions
   - Troubleshooting common issues
   - Security best practices

3. `/docs/security/troubleshooting`
   - Common certificate issues and solutions
   - Browser-specific guidance
   - Trust store verification steps
   - Certificate renewal procedures

### Pages to Update

1. `/docs/getting-started`
   - Remove mkcert requirement
   - Add note about automatic certificate management
   - Link to new certificate documentation
   - Update installation prerequisites

2. `/docs/configuration`
   - Add `bb secure` command documentation
   - Update TLS configuration options
   - Add trust store configuration section
   - Link to new security documentation

3. `/docs/cli-reference`
   - Add `bb secure` command details
   - Update security management section
   - Add examples and use cases
   - Link to certificate management guide

### Navigation Updates

1. Add new "Security" section to main navigation:
   ```yaml
   navigation:
     docs:
       - title: Security
         children:
           - title: Certificate Management
             url: /docs/security/certificates
           - title: Trust Store Guide
             url: /docs/security/trust-store
           - title: Security Troubleshooting
             url: /docs/security/troubleshooting
   ```

2. Update related sections:
   - Add security links to CLI reference
   - Add certificate links to configuration guide
   - Add trust store links to troubleshooting guide

### Content Guidelines

1. Certificate Documentation:
   - Use clear, non-technical language
   - Include visual guides and screenshots
   - Provide platform-specific instructions
   - Explain security implications

2. Trust Store Documentation:
   - Explain in user-friendly terms
   - Include platform-specific paths
   - Add verification instructions
   - Provide troubleshooting steps

3. General Updates:
   - Remove all mkcert references
   - Update installation requirements
   - Add security best practices
   - Include common issue solutions

## References
- [Deno Node Compatibility](https://docs.deno.com/api/node)
- [X509Certificate Documentation](https://docs.deno.com/api/node/crypto/~/X509Certificate)
- [Web Certificates API](https://w3c.github.io/web-cert-api-cg/index.html)