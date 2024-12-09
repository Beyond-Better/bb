export interface VersionInfo {
  version: string;
  installLocation: string;
  canAutoUpdate: boolean;
  binaryVersion?: string | null;
}

export interface VersionCompatibility {
  compatible: boolean;
  currentVersion: string;
  requiredVersion: string;
  updateAvailable: boolean;
  latestVersion?: string;
}

export interface InstallProgress {
  stage: 'idle' | 'preparing' | 'downloading' | 'installing' | 'backup' | 'complete';
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