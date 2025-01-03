import type { JSX } from 'preact';

import { ConversationEntry, ConversationMetadata } from 'shared/types.ts';
import type { Project } from '../hooks/useProjectState.ts';
import type { FileSuggestionsResponse } from 'api/utils/fileSuggestions.ts';
import type { ListDirectoryResponse } from 'api/utils/fileHandling.ts';
import type { Session, User } from '../types/auth.ts';
import type {
	BillingPreviewResults,
	BillingPreviewWithUsage,
	Plan,
	PlanResults,
	SubscriptionResults,
	SubscriptionWithUsage,
} from '../types/subscription.ts';

export interface AuthResponse {
	user?: User;
	session?: Session;
	error?: string;
}

export interface ApiStatus {
	status: string;
	message: string;
	platform: string;
	platformDisplay: string;
	trustStoreLocation?: string;
	tls: {
		enabled: boolean;
		certType?: 'custom' | 'self-signed';
		certPath?: string;
		certSource?: 'config' | 'project' | 'global';
		validFrom?: string;
		validUntil?: string;
		issuer?: string;
		subject?: string;
		expiryStatus?: 'valid' | 'expiring' | 'expired';
	};
	configType: 'project' | 'global';
	projectName?: string;
}

interface ConversationResponse {
	id: string;
	title: string;
	updatedAt: string;
	conversationStats: {
		conversationTurnCount: number;
	};
	tokenUsageConversation: {
		totalTokensTotal: number;
	};
}

export interface ConversationListResponse {
	conversations: ConversationMetadata[];
}

export interface LogEntryFormatResponse {
	formattedResult: {
		title: string | JSX.Element;
		subtitle?: string | JSX.Element;
		content: string | JSX.Element;
		preview: string | JSX.Element;
	};
}

export interface DiagnosticResult {
	category: 'config' | 'tls' | 'resources' | 'permissions' | 'api';
	status: 'ok' | 'warning' | 'error';
	message: string;
	details?: string;
	fix?: {
		description: string;
		command?: string;
		apiEndpoint?: string;
		requiresElevated?: boolean;
		requiresRestart?: boolean;
	};
}

export interface DiagnosticResponse {
	results: DiagnosticResult[];
	summary: {
		total: number;
		errors: number;
		warnings: number;
		ok: number;
	};
}

export interface ApiUpgradeResponse {
	success: boolean;
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
	needsSudo: boolean;
}

export class ApiClient {
	private apiUrl: string;

	constructor(apiUrl: string) {
		console.log(`APIClient: Initializing apiUrl with: ${apiUrl}`);
		const normalizedUrl = apiUrl.replace(/\/+$/, '');
		console.log(`APIClient: Normalized apiUrl to: ${normalizedUrl}`);
		this.apiUrl = normalizedUrl;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		allowedCodes: number[] = [],
	): Promise<T | null> {
		const url = `${this.apiUrl}${endpoint}`;
		console.log(`APIClient: sending ${options.method || 'GET'} to: ${url}`);

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					'Content-Type': 'application/json',
					...options.headers,
				},
			});

			if (!response.ok) {
				// Check if this status code is explicitly allowed
				if (allowedCodes.includes(response.status)) {
					return null;
				}
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json() as T;
		} catch (error) {
			console.error(
				`APIClient: ${options.method || 'GET'} request failed for ${endpoint}: ${(error as Error).message}`,
			);
			throw error;
		}
	}

	async get<T>(endpoint: string, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, {}, allowedCodes);
	}

	async delete<T>(endpoint: string, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, { method: 'DELETE' }, allowedCodes);
	}

	async post<T>(endpoint: string, data: Record<string, unknown>, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(data),
		}, allowedCodes);
	}

	async put<T>(endpoint: string, data: Record<string, unknown>, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, {
			method: 'PUT',
			body: JSON.stringify(data),
		}, allowedCodes);
	}

	// Subscription Methods
	async getCurrentSubscription(): Promise<SubscriptionWithUsage | null> {
		const results = await this.get<SubscriptionResults>('/api/v1/user/subscription/current');
		return results ? { ...results?.subscription, usage: results?.usage } : null;
	}

	async getAvailablePlans(): Promise<Plan[] | null> {
		const results = await this.get<PlanResults>('/api/v1/subscription/plans');
		return results?.plans || null;
	}

	async changePlan(planId: string): Promise<SubscriptionWithUsage | null> {
		const results = await this.post<SubscriptionResults>('/api/v1/user/subscription/change', { planId });
		return results ? { ...results?.subscription, usage: results?.usage } : null;
	}

	async getBillingPreview(planId: string): Promise<BillingPreviewWithUsage | null> {
		const results = await this.post<BillingPreviewResults>('/api/v1/user/subscription/preview', { planId });
		return results ? { ...results?.preview, usage: results?.usage } : null;
	}

	// Auth Methods
	async signIn(email: string, password: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/login', { email, password }) ??
			{ error: 'Failed to connect to API' };
	}

	async signOut(): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/logout', {}) ?? { error: 'Failed to connect to API' };
	}

	async getSession(): Promise<AuthResponse> {
		return await this.get<AuthResponse>('/api/v1/auth/session') ?? { error: 'Failed to connect to API' };
	}

	async signUp(email: string, password: string): Promise<AuthResponse> {
		const verifyUrl = new URL('/auth/verify', globalThis.location.href);
		return await this.post<AuthResponse>('/api/v1/auth/signup', {
			email,
			password,
			options: { emailRedirectTo: verifyUrl.toString() },
		}) ?? { error: 'Failed to connect to API' };
	}

	async verifyOtp(tokenHash: string, type: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/callback', {
			token_hash: tokenHash,
			type,
		}) ?? { error: 'Failed to connect to API' };
	}

	// Project Management Methods
	async listProjects(): Promise<{ projects: Project[] } | null> {
		return await this.get<{ projects: Project[] }>('/api/v1/project');
	}

	async getProject(projectId: string): Promise<{ project: Project } | null> {
		return await this.get<{ project: Project }>(`/api/v1/project/${projectId}`, [404]);
	}

	async createProject(project: Omit<Project, 'projectId'>): Promise<{ project: Project } | null> {
		return await this.post<{ project: Project }>('/api/v1/project', project);
	}

	async updateProject(
		projectId: string,
		updates: Partial<Omit<Project, 'projectId'>>,
	): Promise<{ project: Project } | null> {
		return await this.put<{ project: Project }>(`/api/v1/project/${projectId}`, updates);
	}

	async deleteProject(projectId: string): Promise<void> {
		await await this.delete(`/api/v1/project/${projectId}`, [404]);
	}

	async migrateAndAddProject(projectPath: string): Promise<Project | null> {
		return await this.post('/api/v1/project/migrate', { projectPath });
	}

	async findV1Projects(searchDir: string): Promise<{ projects: string[] } | null> {
		return await this.get<{ projects: string[] }>(
			`/api/v1/project/find?searchDir=${encodeURIComponent(searchDir)}`,
		);
	}

	// File Management Methods
	async suggestFiles(partialPath: string, projectId: string): Promise<FileSuggestionsResponse | null> {
		return await this.post<FileSuggestionsResponse>(
			'/api/v1/files/suggest',
			{ partialPath, projectId },
		);
	}

	async suggestFilesForPath(partialPath: string, rootPath: string, options: {
		limit?: number;
		caseSensitive?: boolean;
		type?: 'all' | 'file' | 'directory';
	} = {}): Promise<FileSuggestionsResponse | null> {
		return await this.post<FileSuggestionsResponse>(
			'/api/v1/files/suggest-for-path',
			{
				partialPath,
				rootPath,
				...options,
			},
		);
	}

	async listDirectory(
		dirPath: string,
		options: { only?: 'files' | 'directories'; matchingString?: string; includeHidden?: boolean } = {},
	): Promise<ListDirectoryResponse | null> {
		try {
			return await this.post<ListDirectoryResponse>('/api/v1/files/list-directory', {
				dirPath,
				...options,
			});
		} catch (error) {
			console.log(`APIClient: List directory failed: ${(error as Error).message}`);
			throw error;
		}
	}

	// Conversation Management Methods
	async createConversation(id: string, projectId: string): Promise<ConversationResponse | null> {
		return await this.get<ConversationResponse>(
			`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`,
		);
	}

	async getConversations(projectId: string, limit = 200): Promise<ConversationListResponse | null> {
		return await this.get<ConversationListResponse>(
			`/api/v1/conversation?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
		);
	}

	async getConversation(
		id: string,
		projectId: string,
	): Promise<(ConversationResponse & { logEntries: ConversationEntry[] }) | null> {
		return await this.get<ConversationResponse & { logEntries: ConversationEntry[] }>(
			`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`,
			[404],
		);
	}

	async deleteConversation(id: string, projectId: string): Promise<void> {
		await this.delete(`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`, [404]);
	}

	async getStatus(): Promise<ApiStatus | null> {
		return await this.get<ApiStatus>('/api/v1/status');
	}

	async getStatusHtml(): Promise<string | null> {
		const response = await fetch(`${this.apiUrl}/api/v1/status`, {
			headers: {
				'Accept': 'text/html',
			},
		});
		if (!response.ok) return null;
		return response.text();
	}

	async getDiagnostics(): Promise<DiagnosticResponse | null> {
		return await this.get<DiagnosticResponse>('/api/v1/doctor/check');
	}

	async getDiagnosticReport(): Promise<Blob | null> {
		const response = await fetch(`${this.apiUrl}/api/v1/doctor/report`);
		if (!response.ok) return null;
		return response.blob();
	}

	async applyDiagnosticFix(fixEndpoint: string): Promise<{ message: string } | null> {
		return await this.post<{ message: string }>(fixEndpoint, {});
	}

	async upgradeApi(): Promise<ApiUpgradeResponse | null> {
		return await this.post<ApiUpgradeResponse>(
			'/api/v1/upgrade',
			{},
		);
	}

	async formatLogEntry(
		entryType: string,
		logEntry: unknown,
		projectId: string,
	): Promise<LogEntryFormatResponse | null> {
		return await this.post<LogEntryFormatResponse>(
			`/api/v1/format_log_entry/browser/${entryType}`,
			{ logEntry, projectId },
		);
	}
}

export function createApiClientManager(url: string): ApiClient {
	return new ApiClient(url);
}
