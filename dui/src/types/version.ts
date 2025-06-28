export interface VersionInfo {
  version: string;
  installLocation: string;
  canAutoUpdate: boolean;
  binaryVersion?: string | null;
}

export interface DuiUpdateInfo {
  version: string;
  date?: string | null;
  body: string;
  download_url: string;
}

export interface VersionCompatibility {
  compatible: boolean;
  currentVersion: string;
  requiredVersion: string;
  updateAvailable: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  hasBreakingChanges?: boolean;
  criticalNotice?: string;
}

export interface InstallProgress {
  stage: 'idle' | 'preparing' | 'downloading' | 'installing' | 'backup' | 'complete' | 'upgrading-server' | 'checking-dui' | 'downloading-dui' | 'installing-dui';
  progress: number;
  message?: string;
}

export interface InstallError {
  code: string;
  message: string;
  details?: string;
}

export interface VersionState {
  versionInfo?: VersionInfo;
  versionCompatibility?: VersionCompatibility;
  duiUpdateInfo?: DuiUpdateInfo | null;
  error?: string;
  installProgress?: InstallProgress;
  installError?: InstallError;
}

// Installation location types
export type InstallLocationType = 'system' | 'user';

export interface InstallLocation {
  type: InstallLocationType;
  path: string;
  writable: boolean;
}

// Event payload types
export interface InstallProgressEvent {
  stage: InstallProgress['stage'];
  progress: number;
  message?: string;
}