export interface ApiStatus {
  running: boolean;
  pid?: number;
  error?: string;
}

export interface ApiConfig {
  apiHostname?: string;
  apiPort?: number;
  apiUseTls?: boolean;
  environment?: string;
  logLevel?: string;
}

export interface ApiStartResult {
  success: boolean;
  pid?: number;
  error?: string;
}