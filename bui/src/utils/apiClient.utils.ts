import type { JSX } from 'preact';

import { ConversationEntry, ConversationMetadata } from 'shared/types.ts';
import type { DisplaySuggestion } from '../types/suggestions.types.ts';

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

export interface FileSuggestionsResponse {
	suggestions: Array<{
		path: string;
		isDirectory: boolean;
		size?: number;
		modified?: string;
	}>;
	hasMore: boolean;
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
	needsUpdate: boolean; // We just updated
	needsSudo: boolean;
}

export class ApiClient {
	private apiUrl: string;

	constructor(apiUrl: string) {
		this.apiUrl = apiUrl;
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
		return this.request<T>(endpoint, {}, allowedCodes);
	}

	async delete<T>(endpoint: string, allowedCodes: number[] = []): Promise<T | null> {
		return this.request<T>(endpoint, { method: 'DELETE' }, allowedCodes);
	}

	async post<T>(endpoint: string, data: Record<string, unknown>, allowedCodes: number[] = []): Promise<T | null> {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(data),
		}, allowedCodes);
	}

	// Conversation Management Methods
	async createConversation(id: string, projectId: string): Promise<ConversationResponse | null> {
		return this.get<ConversationResponse>(
			`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`,
		);
	}

	async getConversations(projectId: string, limit = 200): Promise<ConversationListResponse | null> {
		return this.get<ConversationListResponse>(
			`/api/v1/conversation?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
		);
	}

	async getConversation(
		id: string,
		projectId: string,
	): Promise<(ConversationResponse & { logEntries: ConversationEntry[] }) | null> {
		return this.get<ConversationResponse & { logEntries: ConversationEntry[] }>(
			`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`,
			[404],
		);
	}

	async deleteConversation(id: string, projectId: string): Promise<void> {
		await this.delete(`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`, [404]);
	}

	async getStatus(): Promise<ApiStatus | null> {
		return this.get<ApiStatus>('/api/v1/status');
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

	async suggestFiles(partialPath: string, projectId: string): Promise<FileSuggestionsResponse | null> {
		return this.post<FileSuggestionsResponse>(
			'/api/v1/files/suggest',
			{ partialPath, projectId },
		);
	}

	async getDiagnostics(): Promise<DiagnosticResponse | null> {
		return this.get<DiagnosticResponse>('/api/v1/doctor/check');
	}

	async getDiagnosticReport(): Promise<Blob | null> {
		const response = await fetch(`${this.apiUrl}/api/v1/doctor/report`);
		if (!response.ok) return null;
		return response.blob();
	}

	async applyDiagnosticFix(fixEndpoint: string): Promise<{ message: string } | null> {
		return this.post<{ message: string }>(fixEndpoint, {});
	}

	async upgradeApi(): Promise<ApiUpgradeResponse | null> {
		return this.post<ApiUpgradeResponse>(
			'/api/v1/upgrade',
			{},
		);
	}

	async formatLogEntry(entryType: string, logEntry: any, projectId: string): Promise<LogEntryFormatResponse | null> {
		return this.post<LogEntryFormatResponse>(
			`/api/v1/format_log_entry/browser/${entryType}`,
			{ logEntry, projectId },
		);
	}
}

export function createApiClientManager(url: string): ApiClient {
	return new ApiClient(url);
}
