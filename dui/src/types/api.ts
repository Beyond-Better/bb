export interface ServiceStatus {
  pid_exists: boolean;
  process_responds: boolean;
  service_responds: boolean;
  pid: number | null;
  error: string | null;
}

export interface ServerStatus {
  api: ServiceStatus;
  bui: ServiceStatus;
  all_services_ready: boolean;
}

export interface TlsConfig {
  useTls: boolean;
  keyFile?: string;
  certFile?: string;
}

export interface ApiConfig {
  hostname: string;
  port: number;
  tls: TlsConfig;
  environment?: string;
  logLevel?: string;
}

export interface BuiConfig {
  hostname: string;
  port: number;
  tls: TlsConfig;
  environment?: string;
  logLevel?: string;
  //supabaseUrl: string;
  //supabaseAnonKey: string;
}

export interface GlobalConfig {
  api: ApiConfig;
  bui: BuiConfig;
}

export interface ServiceStartResult {
  success: boolean;
  pid: number | null;
  error: string | null;
  requires_settings: boolean;
}

export interface ServerStartResult {
  api: ServiceStartResult;
  bui: ServiceStartResult;
  all_services_ready: boolean;
}