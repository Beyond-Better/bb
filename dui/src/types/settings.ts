// Matches the Rust GlobalConfig structure with camelCase
export interface RustGlobalConfig {
  version: string;
  noBrowser: boolean;
  api: {
    hostname: string;
    port: number;
    tls?: {
      useTls: boolean;
    };
  };
  bui: {
    hostname: string;
    port: number;
  };
  cli: {
    historySize: number;
  };
  dui: {
    projectsDirectory: string;
    recentProjects: number;
  };
}

// Frontend form values (using dot notation for nested values)
export interface GlobalConfigValues {
  'api.tls.useTls': boolean;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}