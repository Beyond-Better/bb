export type DiagnosticCategory = 'config' | 'tls' | 'resources' | 'permissions' | 'api';
export type DiagnosticStatus = 'ok' | 'warning' | 'error';

export interface DiagnosticFix {
	description: string;
	command?: string; // CLI command to run
	apiEndpoint?: string; // API endpoint for BUI
	requiresElevated?: boolean;
	requiresRestart?: boolean;
}

export interface DiagnosticResult {
	category: DiagnosticCategory;
	status: DiagnosticStatus;
	message: string;
	details?: string;
	fix?: DiagnosticFix;
}

export interface SystemResources {
	diskSpace: {
		total: number;
		free: number;
		unit: 'bytes';
	};
	conversations: {
		count: number;
		totalSize: number;
		unit: 'bytes';
	};
}

export interface DoctorReport extends Record<string, unknown> {
	timestamp: string;
	bbVersion: string;
	systemInfo: {
		os: string;
		arch: string;
		resources: SystemResources;
	};
	diagnostics: DiagnosticResult[];
	conversations: Array<{
		id: string;
		size: number;
		lastModified: string;
	}>;
	tools: {
		core: string[];
		custom?: string[];
	};
	logs?: {
		api: string;
		lastErrors?: string[];
	};
}
