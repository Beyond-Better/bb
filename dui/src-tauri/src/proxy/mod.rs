use crate::logging::{AccessLogEntry, AccessLogger};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use http::{Request, Response};
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Client, Server};
use hyper_tls::HttpsConnector;
use log::{debug, error, info};
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;

const FALLBACK_PORTS: &[u16] = &[
    45000, 45001, 45002, 45003, 45004, 45005, 45006, 45007, 45008, 45009,
];
const DEFAULT_TARGET: &str = "https://chat.beyondbetter.dev";
const MAINTENANCE_HTML: &str = include_str!("maintenance.html");

#[derive(Debug)]
#[allow(dead_code)]
pub struct HttpProxy {
    client: Client<HttpsConnector<hyper::client::HttpConnector>>,
    pub(crate) target_url: Arc<RwLock<String>>,
    pub(crate) port: u16,
    access_logger: Arc<RwLock<AccessLogger>>,
    pub(crate) debug_mode: Arc<RwLock<bool>>,
    server_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
}

// Implement Clone manually since JoinHandle doesn't implement Clone
impl Clone for HttpProxy {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            target_url: self.target_url.clone(),
            port: self.port,
            access_logger: self.access_logger.clone(),
            debug_mode: self.debug_mode.clone(),
            server_handle: self.server_handle.clone(),
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProxyInfo {
    pub port: u16,
    pub target: String,
    pub is_running: bool,
}

impl HttpProxy {
    pub async fn new(log_dir: std::path::PathBuf) -> std::io::Result<Self> {
        let debug_mode = Arc::new(RwLock::new(cfg!(debug_assertions))); // Default to compile-time setting

        // Try ports until one works
        for &port in FALLBACK_PORTS {
            if Self::is_port_available(port) {
                info!("Starting proxy server on port {}", port);

                return Ok(Self {
                    client: {
                        debug!("Creating HTTP connector with HTTPS support");
                        let mut http = hyper::client::HttpConnector::new();
                        http.enforce_http(false);
                        debug!("Creating HTTPS connector with TLS support");
                        let https = HttpsConnector::new_with_connector(http);
                        debug!("Building client with HTTPS/TLS support");
                        Client::builder().build::<_, hyper::Body>(https)
                    },
                    target_url: Arc::new(RwLock::new(DEFAULT_TARGET.to_string())),
                    port,
                    access_logger: Arc::new(RwLock::new(AccessLogger::new(
                        log_dir,
                        debug_mode.clone(),
                    )?)),
                    debug_mode,
                    server_handle: Arc::new(RwLock::new(None)),
                });
            }
        }

        error!("No available ports found in range {:?}", FALLBACK_PORTS);
        Err(std::io::Error::new(
            std::io::ErrorKind::AddrInUse,
            format!("No available ports in range {:?}", FALLBACK_PORTS),
        ))
    }

    fn is_port_available(port: u16) -> bool {
        std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
    }

    pub async fn is_running(&self) -> bool {
        self.server_handle.read().await.is_some()
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut handle = self.server_handle.write().await;
        if let Some(h) = handle.take() {
            debug!("Stopping proxy server");
            h.abort();
            info!("Proxy server stopped");
        }
        Ok(())
    }

    fn is_websocket_request(req: &Request<Body>) -> bool {
        req.headers()
            .get(hyper::header::UPGRADE)
            .and_then(|h| h.to_str().ok())
            .map(|h| h.to_lowercase().contains("websocket"))
            .unwrap_or(false)
    }

    async fn handle_websocket_request(
        &self,
        req: Request<Body>,
    ) -> Result<Response<Body>, std::io::Error> {
        let target = self.target_url.read().await.clone();
        let path = req.uri().path().to_string();
        let query = req
            .uri()
            .query()
            .map(|q| format!("?{}", q))
            .unwrap_or_default();

        // Convert http(s):// to ws(s):// for the target URL
        let ws_target = if target.starts_with("https://") {
            format!(
                "wss://{}{}{}",
                target.strip_prefix("https://").unwrap(),
                path,
                query
            )
        } else {
            format!(
                "ws://{}{}{}",
                target.strip_prefix("http://").unwrap_or(&target),
                path,
                query
            )
        };

        debug!("Websocket: Upgrade request to: {}", ws_target);

        // Create the WebSocket client connection
        match connect_async(&ws_target).await {
            Ok((ws_stream, _)) => {
                debug!("Websocket: Connection established to target");

                // Get WebSocket key before starting upgrade
                let ws_key = req
                    .headers()
                    .get("Sec-WebSocket-Key")
                    .and_then(|h| h.to_str().ok())
                    .map(|s| s.to_string())
                    .ok_or_else(|| {
                        std::io::Error::new(
                            std::io::ErrorKind::InvalidInput,
                            "Missing Sec-WebSocket-Key header",
                        )
                    })?;

                let (_response_sender, response_body) = Body::channel();

                let upgrade_fut = hyper::upgrade::on(req);
                let ws_stream_clone = ws_stream;

                // Spawn task to handle WebSocket after upgrade
                tokio::spawn(async move {
                    let upgraded = match upgrade_fut.await {
                        Ok(u) => u,
                        Err(e) => {
                            error!("Websocket: Upgrade failed: {}", e);
                            return;
                        }
                    };

                    let client_ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
                        upgraded,
                        tokio_tungstenite::tungstenite::protocol::Role::Server,
                        None,
                    )
                    .await;

                    let (mut client_write, mut client_read) = client_ws.split();
                    let (mut server_write, mut server_read) = ws_stream_clone.split();

                    // Wait a moment for the connection to stabilize
                    tokio::time::sleep(Duration::from_millis(100)).await;

                    let server_to_client = tokio::spawn(async move {
                        debug!("Websocket: Starting server to client forwarding");
                        while let Some(Ok(msg)) = server_read.next().await {
                            match msg {
                                Message::Ping(data) => {
                                    if let Err(e) = client_write.send(Message::Pong(data)).await {
                                        error!("Websocket: Error sending pong to client: {}", e);
                                        break;
                                    }
                                }
                                Message::Pong(_) => {}
                                Message::Close(_) => {
                                    debug!("Websocket: Received server close");
                                    break;
                                }
                                msg => {
                                    if let Err(e) = client_write.send(msg).await {
                                        error!("Websocket: Error forwarding to client: {}", e);
                                        break;
                                    }
                                }
                            }
                        }
                    });

                    let client_to_server = tokio::spawn(async move {
                        debug!("Websocket: Starting client to server forwarding");
                        while let Some(Ok(msg)) = client_read.next().await {
                            match msg {
                                Message::Ping(data) => {
                                    if let Err(e) = server_write.send(Message::Pong(data)).await {
                                        error!("Websocket: Error sending pong to server: {}", e);
                                        break;
                                    }
                                }
                                Message::Pong(_) => {}
                                Message::Close(_) => {
                                    debug!("Websocket: Received client close");
                                    break;
                                }
                                msg => {
                                    if let Err(e) = server_write.send(msg).await {
                                        error!("Websocket: Error forwarding to server: {}", e);
                                        break;
                                    }
                                }
                            }
                        }
                    });

                    match tokio::try_join!(server_to_client, client_to_server) {
                        Ok(_) => debug!("Websocket: Connection closed normally"),
                        Err(e) => error!("Websocket: Connection error: {}", e),
                    };
                });

                // Return upgrade response with proper WebSocket headers
                Ok(Response::builder()
                    .status(101)
                    .header(hyper::header::UPGRADE, "websocket")
                    .header(hyper::header::CONNECTION, "upgrade")
                    .header(
                        "Sec-WebSocket-Accept",
                        tungstenite::handshake::derive_accept_key(ws_key.as_bytes()),
                    )
                    .header("Sec-WebSocket-Version", "13")
                    .body(response_body)
                    .unwrap())
            }
            Err(e) => {
                error!("Failed to connect to WebSocket target: {}", e);
                Ok(Response::builder()
                    .status(500)
                    .body(Body::from(format!("WebSocket connection failed: {}", e)))
                    .unwrap())
            }
        }
    }

    pub async fn start(&self) -> std::io::Result<()> {
        // Check if already running
        if self.is_running().await {
            debug!("Proxy server is already running");
            return Ok(());
        }

        if *self.debug_mode.read().await {
            debug!("Starting proxy server in debug mode");
        }
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        debug!(
            "Starting proxy server with debug_mode={:?}",
            *self.debug_mode.read().await
        );

        // Create a new proxy instance for the service
        let proxy = self.clone();

        let make_svc = make_service_fn(move |_conn| {
            let proxy = proxy.clone();
            async move {
                let svc = service_fn(move |req| {
                    let proxy = proxy.clone();
                    async move { proxy.handle_request(req).await }
                });
                let svc = ServiceBuilder::new()
                    .layer(TraceLayer::new_for_http())
                    .service(svc);
                Ok::<_, Infallible>(svc)
            }
        });

        let server = Server::bind(&addr).serve(make_svc);
        info!("Proxy server listening on http://{}", addr);

        // Store server handle for shutdown
        let handle = tokio::spawn(async move {
            if let Err(e) = server.await {
                error!("Proxy server error: {}", e);
            }
        });
        *self.server_handle.write().await = Some(handle);

        Ok(())
    }

    async fn handle_request(&self, req: Request<Body>) -> Result<Response<Body>, std::io::Error> {
        // Extract headers before consuming the request
        let headers = req.headers().clone();

        // Handle health check endpoint
        if req.uri().path() == "/_health" {
            debug!("Health check request received");
            return Ok(Response::builder()
                .status(200)
                .body(Body::from("OK"))
                .unwrap());
        }

        // Check for WebSocket upgrade request
        if Self::is_websocket_request(&req) {
            return self.handle_websocket_request(req).await;
        }

        let start_time = Instant::now();
        let method = req.method().to_string();
        let path = req.uri().path().to_string();
        let target = self.target_url.read().await.clone();

        // Build target URL
        let url = format!(
            "{}{}{}",
            target,
            path,
            req.uri()
                .query()
                .map(|q| format!("?{}", q))
                .unwrap_or_default()
        );

        debug!("Proxying request: {} {} -> {}", method, path, url);
        debug!("Ensuring target uses HTTPS scheme");
        if !url.starts_with("https://") {
            error!("Invalid target URL scheme - must be HTTPS");
            return Ok(Response::builder()
                .status(500)
                .body(Body::from(MAINTENANCE_HTML.replace(
                    "<!--ERROR_MESSAGE-->",
                    "<p class='text-red-600 dark:text-red-400'>Error: Invalid target URL scheme - must be HTTPS</p>"
                )))
                .unwrap());
        }
        if let Ok(parsed_url) = reqwest::Url::parse(&url) {
            debug!(
                "Parsed URL - scheme: {}, host: {:?}, port: {:?}",
                parsed_url.scheme(),
                parsed_url.host_str(),
                parsed_url.port()
            );
        }
        debug!("Request headers: {:?}", headers);
        debug!(
            "Target URL scheme: {}",
            reqwest::Url::parse(&url)
                .map(|u| u.scheme().to_string())
                .unwrap_or_else(|_| "invalid URL".to_string())
        );

        // Create proxied request builder with extracted headers
        let mut proxy_req_builder = Request::builder().method(req.method()).uri(&url);

        // Copy headers except Host (which we'll set to the target)
        for (key, value) in headers.iter() {
            if key != hyper::header::HOST {
                proxy_req_builder = proxy_req_builder.header(key, value);
            }
        }

        // Set Host header to match the target domain
        if let Ok(parsed_url) = reqwest::Url::parse(&url) {
            if let Some(host) = parsed_url.host_str() {
                let host_value = if let Some(port) = parsed_url.port() {
                    format!("{}:{}", host, port)
                } else {
                    host.to_string()
                };
                proxy_req_builder = proxy_req_builder.header(hyper::header::HOST, host_value);
            }
        }

        // Add forwarding headers
        proxy_req_builder = proxy_req_builder
            .header("X-Forwarded-For", "127.0.0.1")
            .header("X-Forwarded-Proto", "http")
            .header("X-Forwarded-Host", format!("localhost:{}", self.port));

        // Build the request with the original body
        let proxy_req = proxy_req_builder
            .body(req.into_body())
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        // Send request with timeout
        let response =
            match tokio::time::timeout(Duration::from_secs(10), self.client.request(proxy_req))
                .await
            {
                Ok(Ok(resp)) => {
                    let status = resp.status().as_u16();
                    let duration = start_time.elapsed().as_millis() as u64;

                    debug!(
                        "Proxy request successful: {} {} -> {} ({}ms)",
                        method, path, target, duration
                    );
                    debug!("Response status: {}, headers: {:?}", status, resp.headers());

                    // Log successful request
                    self.log_access(&method, &path, status, duration, &target, None)
                        .await;

                    Ok(resp)
                }
                Ok(Err(e)) => {
                    let error_msg = e.to_string();
                    error!("Proxy request failed: {}", error_msg);

                    self.log_access(
                        &method,
                        &path,
                        500,
                        start_time.elapsed().as_millis() as u64,
                        &target,
                        Some(&error_msg),
                    )
                    .await;

                    Ok(Response::builder()
                        .status(500)
                        .body(Body::from(MAINTENANCE_HTML.replace(
                            "<!--ERROR_MESSAGE-->",
                            &format!(
                                "<p class='text-red-600 dark:text-red-400'>Error: {}</p>",
                                error_msg
                            ),
                        )))
                        .unwrap())
                }
                Err(_) => {
                    let error_msg = "Request timed out".to_string();
                    error!("Proxy request timed out");

                    self.log_access(
                        &method,
                        &path,
                        504,
                        start_time.elapsed().as_millis() as u64,
                        &target,
                        Some(&error_msg),
                    )
                    .await;

                    Ok(Response::builder()
                    .status(504)
                    .body(Body::from(MAINTENANCE_HTML.replace(
                        "<!--ERROR_MESSAGE-->",
                        "<p class='text-red-600 dark:text-red-400'>Error: Request timed out</p>"
                    )))
                    .unwrap())
                }
            };

        response
    }

    async fn log_access(
        &self,
        method: &str,
        path: &str,
        status: u16,
        duration_ms: u64,
        target: &str,
        error: Option<&str>,
    ) {
        let entry = AccessLogEntry {
            timestamp: Utc::now(),
            method: method.to_string(),
            path: path.to_string(),
            status,
            duration_ms,
            target: target.to_string(),
            error: error.map(String::from),
        };

        if let Err(e) = self.access_logger.write().await.log_request(&entry).await {
            error!("Failed to write access log: {}", e);
        }
    }
}
