# DUI Local HTTP Proxy Implementation

## Problem
When the BUI is loaded in DUI's webview via HTTPS (from chat.beyondbetter.dev), it cannot make HTTP/WS connections to the API due to browser mixed-content restrictions. Previous attempts to solve this using Tauri IPC or a bridge/proxy still face the same issue because the IPC protocol is also blocked by mixed-content restrictions.

## Solution
Create a simple HTTP proxy server in the DUI's Rust layer that:
1. Listens on localhost
2. Proxies webview requests to https://chat.beyondbetter.dev
3. Allows the BUI to load via HTTP, enabling direct HTTP/WS connections to API

## Architecture

```
Before:
Webview -> HTTPS (chat.beyondbetter.dev) -> Mixed content blocked
                                        -> HTTP/WS to API blocked

After:
Webview -> HTTP (localhost:port) -> HTTPS proxy -> chat.beyondbetter.dev
                                -> HTTP/WS to API (works because page loaded via HTTP)
```

### Components

1. HTTP Proxy Server (Rust)
   - Simple HTTP proxy
   - Forwards to chat.beyondbetter.dev
   - Handles HTTPS upstream

2. DUI Changes
   - Configure webview to load from local proxy
   - Start/stop proxy with app lifecycle
   - Handle port selection and conflicts

3. BUI Changes
   - None required - existing code works as-is
   - API connections work normally

## Implementation Details

### 1. HTTP Proxy Server

```rust
// src/proxy/mod.rs
pub struct HttpProxy {
    port: u16,
    target_url: String,
    client: Client,
    maintenance_html: String,
}

#[derive(Serialize)]
pub struct ProxyInfo {
    port: u16,
    target: String,
}

#[tauri::command]
pub async fn get_proxy_info() -> Result<ProxyInfo, String> {
    // Return current proxy port and target
    Ok(ProxyInfo {
        port: CURRENT_PORT.load(Ordering::SeqCst),
        target: CURRENT_TARGET.read().await.clone(),
    })
}

#[tauri::command]
pub async fn set_proxy_target(target: String) -> Result<(), String> {
    // Validate target URL
    Url::parse(&target).map_err(|e| e.to_string())?;
    
    // Update target
    *CURRENT_TARGET.write().await = target;
    Ok(())
}

impl HttpProxy {
    const FALLBACK_PORTS: &'static [u16] = &[45819, 45820, 45821, 45822, 45823];
    const DEFAULT_TARGET: &'static str = "https://chat.beyondbetter.dev";
    
    pub async fn new() -> Result<Self, Error> {
        // Try ports until one works
        for &port in Self::FALLBACK_PORTS {
            if Self::is_port_available(port) {
                // Store current port in atomic for command access
                CURRENT_PORT.store(port, Ordering::SeqCst);
                
                return Ok(Self {
                    port,
                    target_url: Self::DEFAULT_TARGET.to_string(),
                    client: Client::new(),
                    maintenance_html: include_str!("../assets/maintenance.html").to_string(),
                });
            }
        }
        
        Err(Error::new(ErrorKind::AddrInUse, "No available ports"))
    }
    
    fn is_port_available(port: u16) -> bool {
        TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
    }
        Self {
            port,
            target_url: "https://chat.beyondbetter.dev".to_string(),
            client: Client::new(),
        }
    }

    pub async fn start(&self) -> Result<(), Error> {
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        let make_service = make_service_fn(|_| {
            let client = self.client.clone();
            let target_url = self.target_url.clone();
            
            async move {
                Ok::<_, Error>(service_fn(move |req| {
                    proxy_request(client.clone(), target_url.clone(), req)
                }))
            }
        });

        let server = Server::bind(&addr).serve(make_service);
        server.await?;
        Ok(())
    }
}

// Handle proxy requests
async fn proxy_request(
    client: Client,
    target_url: String,
    req: Request<Body>,
    maintenance_html: String,
) -> Result<Response<Body>, Error> {
    // Check if target is available (quick TCP check)
    if !is_target_available(&target_url).await {
        return Ok(create_maintenance_response(maintenance_html, None));
    }
    // Build target URL
    let path = req.uri().path();
    let query = req.uri().query().map(|q| format!("?{}", q)).unwrap_or_default();
    let url = format!("{}{}{}", target_url, path, query);

    // Create proxied request
    let mut proxy_req = client
        .request(req.method().clone(), &url)
        .body(req.into_body())?;

    // Copy headers except host
    for (key, value) in req.headers() {
        if key.as_str().to_lowercase() != "host" {
            proxy_req.headers_mut().insert(key.clone(), value.clone());
        }
    }

    // Add forwarding headers
    proxy_req.headers_mut().insert(
        "X-Forwarded-For",
        HeaderValue::from_str(&"127.0.0.1").unwrap()
    );
    proxy_req.headers_mut().insert(
        "X-Forwarded-Proto",
        HeaderValue::from_str("http").unwrap()
    );
    proxy_req.headers_mut().insert(
        "X-Forwarded-Host",
        HeaderValue::from_str(&format!("localhost:{}", port)).unwrap()
    );

    // Send request with timeout
    match tokio::time::timeout(Duration::from_secs(10), client.execute(proxy_req)).await {
        Ok(Ok(resp)) => Ok(resp.into()),
        Ok(Err(e)) => {
            error!("Proxy request failed: {}", e);
            Ok(create_maintenance_response(
                maintenance_html,
                Some(e.to_string())
            ))
        },
        Err(_) => {
            error!("Proxy request timed out");
            Ok(create_maintenance_response(
                maintenance_html,
                Some("Request timed out".to_string())
            ))
        }
    }
}
```

### 2. Shared State

```rust
// In proxy/mod.rs
use std::sync::atomic::{AtomicU16, Ordering};
use tokio::sync::RwLock;
use once_cell::sync::Lazy;

// Shared state for current port and target
static CURRENT_PORT: AtomicU16 = AtomicU16::new(0);
static CURRENT_TARGET: Lazy<RwLock<String>> = Lazy::new(|| {
    let target = if cfg!(debug_assertions) {
        "http://localhost:8080".to_string()
    } else {
        "https://chat.beyondbetter.dev".to_string()
    };
    RwLock::new(target)
});

### 3. DUI Integration

```rust
// In lib.rs
async fn start_app() {
    // Create and start proxy server
    let proxy = HttpProxy::new().await?;
    
    tokio::spawn(async move {
        if let Err(e) = proxy.start().await {
            error!("Proxy server error: {}", e);
        }
    });
    
    // Configure webview to use proxy
    // The URL will be updated once the webview loads
    let webview = WebviewBuilder::new()
        .url("about:blank")
        .build()?;

    // Initialize frontend with proxy info
    webview.evaluate_script("
        window.addEventListener('DOMContentLoaded', async () => {
            const { invoke } = window.__TAURI__;
            const proxyInfo = await invoke('get_proxy_info');
            
            // In debug mode, set target to localhost
            if (process.env.NODE_ENV === 'development') {
                await invoke('set_proxy_target', {
                    target: 'http://localhost:8080'
                });
            }
            
            // Update location to use proxy
            window.location.href = `http://localhost:${proxyInfo.port}`;
        });
    ").map_err(|e| format!("Failed to inject initialization script: {}", e))?;

    // Example error handling in the frontend:
    webview.evaluate_script("
        window.addEventListener('error', (event) => {
            console.error('Proxy initialization error:', event.error);
            // Could show error UI here
        });
    ")?;
}
```

// Helper functions

async fn is_target_available(url: &str) -> bool {
    // Parse URL to get host and port
    let url = Url::parse(url).ok()?;
    let host = url.host_str()?;
    let port = url.port().unwrap_or(if url.scheme() == "https" { 443 } else { 80 });
    
    // Try TCP connection
    TcpStream::connect((host, port)).await.is_ok()
}

fn create_maintenance_response(html: String, error: Option<String>) -> Response<Body> {
    let mut html = html;
    if let Some(error) = error {
        html = html.replace("<!--ERROR_MESSAGE-->", &format!("<p class=\"error\">{}</p>", error));
    }
    
    Response::builder()
        .status(503)
        .header("Content-Type", "text/html")
        .body(Body::from(html))
        .unwrap()
}

## Security Considerations

1. Proxy Server
   - Only listen on localhost
   - Forward to HTTPS target
   - No TLS needed locally (localhost)
   - Handle headers appropriately

2. Webview Content
   - Loaded via HTTP from localhost
   - Enables direct API connections
   - No mixed content issues

## Maintenance Page

Create a file at `src/assets/maintenance.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
        }
        h1 { color: #333; }
        .message { color: #666; }
        .error { color: #c00; }
    </style>
</head>
<body>
    <h1>Temporarily Unavailable</h1>
    <p class="message">
        The service is temporarily unavailable. Please try again in a few minutes.
    </p>
    <!--ERROR_MESSAGE-->
</body>
</html>
```

## Testing

1. Unit Tests
   - Proxy request handling
   - Header handling
   - Error cases

2. Integration Tests
   - Server startup/shutdown
   - Request forwarding
   - Response handling

3. Manual Testing
   - BUI loading via proxy
   - API connections
   - Error handling

## Initialization Order

1. Application Start
   - Create HttpProxy instance
   - This selects first available port
   - Initializes shared state (CURRENT_PORT, CURRENT_TARGET)

2. Webview Creation
   - Start with about:blank
   - Inject initialization script
   - Script waits for DOMContentLoaded

3. Frontend Initialization
   - Get proxy info via invoke
   - Set development target if needed
   - Update location to use proxy

## Configuration

### Development Mode
```rust
// Determined at compile time
if cfg!(debug_assertions) {
    // Default target is localhost:8080
    // Frontend can override via set_proxy_target
}
```

### Production Mode
```rust
// Default target is https://chat.beyondbetter.dev
// Target can still be changed at runtime if needed
```

## Development Workflow

1. Local Development
   - BUI continues to use direct HTTPS
   - DUI uses local proxy in development

2. Production
   - Same workflow for both
   - Proxy handles all webview content

## Next Steps

1. Implementation Order
   - Create proxy module
   - Add request handling
   - Integrate with DUI
   - Test and refine

2. Future Enhancements
   - Configuration options
   - Better error handling
   - Monitoring/metrics
   - Port selection handling