// Matches the Rust GlobalConfig structure with camelCase
export interface RustGlobalConfig {
  version: string;
  myPersonsName: string;
  myAssistantsName: string;
  noBrowser: boolean;
  api: {
    hostname: string;
    port: number;
    maxTurns: number;
    llmKeys?: {
      anthropic?: string;
      openai?: string;
      voyageai?: string;
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
  myPersonsName: string;
  myAssistantsName: string;
  'api.maxTurns': number;
  'api.llmKeys.anthropic': string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}