export interface ApiStatus {
  pid_exists: boolean;
  process_responds: boolean;
  api_responds: boolean;
  pid: number | null;
  error: string | null;
}

export interface ApiConfig {
  hostname: string;
  port: number;
  tls: {
    useTls: boolean;
    keyFile?: string;
    certFile?: string;
  };
  environment?: string;
  logLevel?: string;
}

export interface ApiStartResult {
  success: boolean;
  pid?: number;
  error?: string;
}