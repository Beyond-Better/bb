import { ConversationEntry, ConversationMetadata } from 'shared/types.ts';

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
	formattedContent: string;
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
	async createConversation(id: string, startDir: string): Promise<ConversationResponse | null> {
		return this.get<ConversationResponse>(
			`/api/v1/conversation/${id}?startDir=${encodeURIComponent(startDir)}`,
		);
	}

	async getConversations(startDir: string, limit = 200): Promise<ConversationListResponse | null> {
		return this.get<ConversationListResponse>(
			`/api/v1/conversation?startDir=${encodeURIComponent(startDir)}&limit=${limit}`,
		);
	}

	async getConversation(
		id: string,
		startDir: string,
	): Promise<(ConversationResponse & { logEntries: ConversationEntry[] }) | null> {
		return this.get<ConversationResponse & { logEntries: ConversationEntry[] }>(
			`/api/v1/conversation/${id}?startDir=${encodeURIComponent(startDir)}`,
			[404],
		);
	}

	async deleteConversation(id: string, startDir: string): Promise<void> {
		await this.delete(`/api/v1/conversation/${id}?startDir=${encodeURIComponent(startDir)}`, [404]);
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

	async formatLogEntry(entryType: string, logEntry: any, startDir: string): Promise<LogEntryFormatResponse | null> {
		return this.post<LogEntryFormatResponse>(
			`/api/v1/format_log_entry/browser/${entryType}`,
			{ logEntry, startDir },
		);
	}
}

export function createApiClientManager(url: string): ApiClient {
	return new ApiClient(url);
}
