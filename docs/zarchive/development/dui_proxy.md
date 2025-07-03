# DUI HTTP Proxy Implementation

## Overview
The DUI (Desktop User Interface) includes a local HTTP proxy that enforces HTTPS connections for all target URLs. The proxy handles mixed-content restrictions when the BUI is loaded via HTTPS but needs to connect to a non-TLS API. It ensures secure connections by requiring HTTPS for all target URLs, whether in development (https://localhost:8080) or production (https://chat.beyondbetter.app). The proxy is automatically managed based on the API's TLS configuration.

## Proxy Behavior

### URL Requirements
- All target URLs must use HTTPS scheme
- Local development uses https://localhost:8080
- Production uses https://chat.beyondbetter.app
- HTTP URLs are rejected with an error

### TLS Mode
- When `api.tls.useTls` is `true`:
  - Proxy is initialized but not started
  - BUI connects directly to API via HTTPS
  - Debug logs indicate proxy is not needed

- When `api.tls.useTls` is `false`:
  - Proxy starts automatically
  - Listens on first available port in range 45000-45009
  - Forwards requests to configured target
  - Handles mixed-content restrictions

### Port Selection
- Tries ports sequentially: 45000-45009
- Uses first available port
- Logs selected port for troubleshooting
- Returns error if no ports are available

## Logging System

### Log Files
1. Application Log
   - Location: `Beyond Better.log`
   - Rotates at 10MB
   - Keeps 5 files maximum
   - Debug level in development, Info in production

2. Proxy Access Log
   - Location: `proxy-access.log`
   - Rotates at 10MB
   - Keeps 5 files maximum
   - Logs all requests in debug mode
   - Only logs errors and non-200 responses in production

### Log Format
```
[YYYY-MM-DD HH:MM:SS.mmm] METHOD PATH STATUS DURATIONms -> TARGET (ERROR)
```

Example:
```
[2024-03-19 10:15:23.456] GET /api/v1/status 200 45ms -> chat.beyondbetter.app
[2024-03-19 10:15:24.789] POST /api/v1/query 500 123ms -> chat.beyondbetter.app (Connection refused)
```

## URL Validation

### Target URL Validation
1. Scheme Check
   - Only HTTPS URLs are allowed
   - HTTP URLs are rejected with an error message
   - Applies to both debug and production modes

2. URL Format
   - Must include https:// scheme
   - Must have valid hostname
   - Port is optional (defaults to 443)

3. Error Messages
   - Invalid scheme: "Invalid URL scheme: [scheme]. Only HTTPS URLs are allowed."
   - Invalid URL format: Shows specific parsing error
   - Shows in maintenance page for invalid requests

## Error Handling

### Maintenance Page
- Shows when target is unavailable
- Styled with Tailwind CSS
- Supports dark mode
- Displays specific error messages
- Matches BUI styling

### Error Scenarios
1. Target Unavailable
   - Shows maintenance page
   - Logs error with details
   - Returns 503 status

2. Request Timeout
   - Shows maintenance page with timeout message
   - Logs timeout error
   - Returns 504 status

3. Other Errors
   - Shows maintenance page with error details
   - Logs specific error message
   - Returns appropriate status code

## Development Mode

### Debug Logging
- Enabled when `debug_assertions` is true
- Logs all proxy requests
- Includes detailed timing information
- Shows proxy initialization details

### Configuration
- Debug mode controlled by `debug_assertions`
- TLS mode set in Settings UI
- Proxy target configurable (defaults to chat.beyondbetter.app)

## Health Check

### Endpoint
- Path: `/_health`
- Method: GET
- Response: 200 OK with body "OK"
- Purpose: Verify proxy is running and responsive

### Usage
- Monitor proxy status
- Health checks in development
- Verify proxy initialization

## Integration

### BUI Integration
- No changes needed in BUI code
- Works with both cloud and local BUI
- Handles HTTP/HTTPS transitions automatically

### HTTPS Implementation
1. Client Configuration
   - Uses hyper-tls for HTTPS support
   - Configured with HttpsConnector
   - Handles both HTTP and HTTPS protocols
   - Enforces HTTPS for all target URLs

2. URL Processing
   - Validates HTTPS scheme before requests
   - Maintains original paths and query parameters
   - Adds appropriate forwarding headers
   - Handles TLS connections automatically

3. Error Handling
   - Rejects non-HTTPS targets immediately
   - Shows clear error messages for scheme violations
   - Logs all URL validation failures
   - Returns maintenance page for invalid schemes

### API Integration
- Respects API's TLS configuration
- Adapts to TLS mode changes
- Maintains consistent behavior across environments

## Troubleshooting

### Common Issues
1. URL Scheme Issues
   - Ensure all URLs use HTTPS scheme
   - Check BUI configuration uses correct HTTPS URLs
   - Verify TLS certificates in development mode

2. HTTPS Configuration
   - Local development requires valid TLS certificates
   - BUI must be served over HTTPS
   - API must use HTTPS when TLS is enabled
1. Port Conflicts
   - Check if ports 45000-45009 are available
   - Review logs for port selection details
   - Ensure no other services use these ports

2. Connection Issues
   - Verify API is running
   - Check TLS configuration
   - Review proxy access logs
   - Confirm target URL is correct

3. Log Analysis
   - Check both app and access logs
   - Look for error patterns
   - Review request timings
   - Monitor log rotation

### Debug Information
- Access logs show request details
- App logs show proxy status
- Error messages include specific causes
- Maintenance page shows user-friendly errors