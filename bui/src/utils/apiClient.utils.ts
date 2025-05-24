import type { JSX } from 'preact';

import type { ConversationLogDataEntry, ConversationMetadata } from 'shared/types.ts';
import type { SystemMeta } from 'shared/types/version.ts';
import type {
	ClientDataSourceConnection,
	ClientProjectData,
	ClientProjectWithConfigForUpdates,
	ClientProjectWithConfigSources,
} from 'shared/types/project.ts';
import type { DataSourceProviderInfo } from 'shared/types/dataSource.ts';
import type { GlobalConfig, ProjectConfig } from 'shared/config/types.ts';
import type { FileSuggestionsResponse } from 'api/utils/fileSuggestions.ts';
import type { ListDirectoryResponse } from 'api/utils/fileHandling.ts';
import type { Session, User } from '../types/auth.ts';
import type {
	BillingPreviewResults,
	BillingPreviewWithUsage,
	BlockPurchase,
	BlockPurchaseResults,
	PaymentMethod,
	PaymentMethodResults,
	Plan,
	PlanResults,
	PurchasesBalance,
	SubscriptionResults,
	SubscriptionWithUsage,
	SubscriptionWithUsageWithPaymentMethods,
} from '../types/subscription.ts';
import { savePreferredProtocol } from './connectionManager.utils.ts';

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

// Model capability types
export interface ModelCapabilities {
	contextWindow: number;
	maxOutputTokens: number;
	pricing?: Record<string, unknown>;
	supportedFeatures: {
		extendedThinking?: boolean;
		promptCaching?: boolean;
		[key: string]: boolean | undefined;
	};
	defaults?: Record<string, unknown>;
	constraints?: {
		temperature?: { min: number; max: number };
		[key: string]: { min: number; max: number } | undefined;
	};
	systemPromptBehavior?: string;
	[key: string]: unknown;
}

export interface ModelDetails {
	id: string;
	displayName: string;
	provider: string;
	providerLabel: string;
	capabilities: ModelCapabilities;
}

export interface ModelResponse {
	model: ModelDetails;
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

export interface ConfigUpdateResponse {
	message: string;
}

export class ApiClient {
	private apiUrl: string;
	private protocolRetryCount: number = 0;
	private readonly MAX_PROTOCOL_RETRIES = 1;

	constructor(apiUrl: string) {
		console.log(`APIClient: Initializing apiUrl with: ${apiUrl}`);
		const normalizedUrl = apiUrl.replace(/\/+$/, '');
		console.log(`APIClient: Normalized apiUrl to: ${normalizedUrl}`);
		this.apiUrl = normalizedUrl;
	}

	/**
	 * Update the API URL, typically after a protocol switch
	 */
	updateApiUrl(newUrl: string): void {
		this.apiUrl = newUrl.replace(/\/+$/, '');
		console.log(`APIClient: Updated apiUrl to: ${this.apiUrl}`);
	}

	/**
	 * Switch between HTTP and HTTPS protocols
	 */
	switchProtocol(): string {
		const isSecure = this.apiUrl.startsWith('https://');
		const newUrl = isSecure
			? this.apiUrl.replace('https://', 'http://')
			: this.apiUrl.replace('http://', 'https://');

		console.log(
			`APIClient: Switching protocol from ${isSecure ? 'HTTPS' : 'HTTP'} to ${!isSecure ? 'HTTPS' : 'HTTP'}`,
		);
		this.apiUrl = newUrl;

		// Save this as the preferred protocol
		savePreferredProtocol(!isSecure);

		return newUrl;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		allowedCodes: number[] = [],
	): Promise<T | null> {
		const url = `${this.apiUrl}${endpoint}`;
		//console.log(`APIClient: sending ${options.method || 'GET'} to: ${url}`);

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

			// Reset protocol retry count on success
			this.protocolRetryCount = 0;

			return await response.json() as T;
		} catch (error) {
			console.error(
				`APIClient: ${options.method || 'GET'} request failed for ${endpoint}: ${(error as Error).message}`,
			);

			// If this looks like a protocol or connection issue and we haven't tried too many times,
			// attempt to switch protocols and retry once
			const isConnectionError = error instanceof Error &&
				(error.message.includes('Failed to fetch') ||
					error.message.includes('NetworkError') ||
					error.message.includes('Network request failed'));

			if (isConnectionError && this.protocolRetryCount < this.MAX_PROTOCOL_RETRIES) {
				this.protocolRetryCount++;
				console.log(`APIClient: Connection error detected, trying with alternate protocol`);
				this.switchProtocol();

				// Retry the request with the new protocol
				return this.request<T>(endpoint, options, allowedCodes);
			}

			throw error;
		}
	}

	public get baseUrl() {
		return this.apiUrl;
	}

	async get<T>(endpoint: string, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, {}, allowedCodes);
	}

	async delete<T>(endpoint: string, allowedCodes: number[] = []): Promise<T | null> {
		return await this.request<T>(endpoint, { method: 'DELETE' }, allowedCodes);
	}

	async post<T, D = Record<string, unknown>>(
		endpoint: string,
		data: D,
		allowedCodes: number[] = [],
	): Promise<T | null> {
		return await this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(data),
		}, allowedCodes);
	}

	async put<T, D = Record<string, unknown>>(
		endpoint: string,
		data: D,
		allowedCodes: number[] = [],
	): Promise<T | null> {
		return await this.request<T>(endpoint, {
			method: 'PUT',
			body: JSON.stringify(data),
		}, allowedCodes);
	}

	// Stripe Configuration
	async getStripeConfig(): Promise<{ stripeKey: string }> {
		const result = await this.get<{ stripeKey: string }>('/api/v1/user/billing/config');
		return result ?? { stripeKey: '' };
	}

	// Payment Methods
	async createSetupIntent(): Promise<{ clientSecret: string; setupIntentId: string }> {
		const result = await this.post<{ clientSecret: string; setupIntentId: string }>(
			'/api/v1/user/billing/payment-methods/setup',
			{},
		);
		return result ?? { clientSecret: '', setupIntentId: '' };
	}

	// New method to get customer session
	async createCustomerSession(): Promise<{ clientSecret: string }> {
		const result = await this.post<{ clientSecret: string }>(
			'/api/v1/user/billing/customer-session',
			{},
		);
		return result ?? { clientSecret: '' };
	}

	async listPaymentMethods(): Promise<PaymentMethod[] | null> {
		const result = await this.get<PaymentMethodResults>('/api/v1/user/billing/payment-methods');
		console.log('APIClient: listPaymentMethods', result);
		return result?.paymentMethods || null;
	}

	async setDefaultPaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message: string }> {
		const result = await this.post<{ success: boolean; message: string }>(
			'/api/v1/user/billing/payment-methods/default',
			{ payment_method_id: paymentMethodId },
		);
		return result ?? { success: false, message: 'Failed to set default payment method' };
	}

	async removePaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message: string }> {
		const result = await this.delete<{ success: boolean; message: string }>(
			`/api/v1/user/billing/payment-methods/${paymentMethodId}`,
		);
		return result ?? { success: false, message: 'Failed to remove payment method' };
	}

	async savePaymentMethod(paymentMethodId: string): Promise<{
		success: boolean;
		message: string;
		paymentMethod: PaymentMethod;
	}> {
		const result = await this.post<{
			success: boolean;
			message: string;
			paymentMethod: PaymentMethod;
		}>(
			'/api/v1/user/billing/payment-methods/default',
			{ paymentMethodId },
		);
		return result ?? {
			success: false,
			message: 'Failed to save payment method',
			paymentMethod: {} as PaymentMethod,
		};
	}

	// Payment Intent
	async createPaymentIntent(params: {
		amount: number;
		subscription_id: string;
		purchase_id: string | null;
		payment_type: 'subscription' | 'token_purchase';
		stripe_payment_method_id: string;
		source?: string;
	}): Promise<{ clientSecret: string }> {
		console.log('APIClient: createPaymentIntent', params);
		const args = {
			amount: params.amount,
			stripe_payment_method_id: params.stripe_payment_method_id,
			metadata: {
				subscription_id: params.subscription_id,
				purchase_id: params.purchase_id,
				payment_type: params.payment_type,
				source: params.source || 'unknown',
			},
		};
		const result = await this.post<{ clientSecret: string }>(
			'/api/v1/user/billing/payment-intent',
			args,
		);
		return result ?? { clientSecret: '' };
	}

	// Subscription Methods
	async getCurrentSubscription(): Promise<SubscriptionWithUsageWithPaymentMethods | null> {
		const results = await this.get<SubscriptionResults>('/api/v1/user/subscription/current');
		console.log('APIClient: getCurrentSubscription', results);
		return results
			? { ...results?.subscription, usage: results?.usage, payment_methods: results?.paymentMethods }
			: null;
	}

	async getAvailablePlans(): Promise<Plan[] | null> {
		const results = await this.get<PlanResults>('/api/v1/subscription/plans');
		//console.log('APIClient: getAvailablePlans', results);
		return results?.plans || null;
	}

	async changePlan(
		planId: string,
		paymentMethodId: string | null,
	): Promise<SubscriptionWithUsageWithPaymentMethods | null> {
		const data: { planId: string; payment_method_id: string | null; paymentMethodId: string | null } = {
			planId,
			payment_method_id: paymentMethodId, // Original format - may be expected by some endpoints
			paymentMethodId: paymentMethodId, // New format - matches the property name in the edge function
		};
		const results = await this.post<SubscriptionResults>('/api/v1/user/subscription/change', data);
		return results
			? { ...results?.subscription, usage: results?.usage, payment_methods: results?.paymentMethods }
			: null;
	}

	async cancelSubscription(
		immediate: boolean = false,
	): Promise<{ success: boolean; subscription: SubscriptionWithUsage }> {
		const result = await this.post<{ success: boolean; subscription: SubscriptionWithUsage }>(
			'/api/v1/user/subscription/cancel',
			{ immediate },
		);
		return result ?? { success: false, subscription: {} as SubscriptionWithUsage };
	}

	async getBillingPreview(planId: string): Promise<BillingPreviewWithUsage | null> {
		const results = await this.post<BillingPreviewResults>('/api/v1/user/subscription/preview', {
			planId,
		});
		return results ? { ...results?.preview, usage: results?.usage } : null;
	}

	// Usage Block Purchase
	async purchaseUsageBlock(amount: number, paymentMethodId: string): Promise<BlockPurchase | null> {
		const results = await this.post<BlockPurchaseResults>('/api/v1/user/billing/usage/purchase', {
			amount,
			paymentMethodId,
		});
		return results ? { ...results?.token_purchase } : null;
	}

	// Usage Block List
	async listUsageBlocks(): Promise<PurchasesBalance | null> {
		return await this.get<PurchasesBalance>('/api/v1/user/billing/usage/blocks');
	}

	// Auth Methods
	async signIn(email: string, password: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/login', { email, password }) ??
			{ error: 'SignIn: Failed to connect to API' };
	}

	async signOut(): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/logout', {}) ??
			{ error: 'SignOut: Failed to connect to API' };
	}

	async getSession(): Promise<AuthResponse> {
		return await this.get<AuthResponse>('/api/v1/auth/session') ??
			{ error: 'GetSession: Failed to connect to API' };
	}

	async signUp(
		email: string,
		password: string,
		metadata?: {
			first_name: string | null;
			last_name: string | null;
			marketing_consent: boolean;
			accepted_terms: boolean;
		},
	): Promise<AuthResponse> {
		const verifyUrl = new URL('/auth/verify', globalThis.location.href);
		return await this.post<AuthResponse>('/api/v1/auth/signup', {
			email,
			password,
			options: {
				emailRedirectTo: verifyUrl.toString(),
				data: metadata,
			},
		}) ?? { error: 'SignUp: Failed to connect to API' };
	}

	async verifyOtp(tokenHash: string, type: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/callback', {
			token_hash: tokenHash,
			type,
		}) ?? { error: 'VerifyToken: Failed to connect to API' };
	}

	async checkEmailVerification(email: string): Promise<{ verified?: boolean; exists?: boolean; error?: string }> {
		return await this.post<{ verified?: boolean; exists?: boolean; error?: string }>(
			'/api/v1/auth/check-email-verification',
			{
				email,
			},
		) ?? { error: 'CheckEmailVerification: Failed to connect to API' };
	}

	async resendVerificationEmail(email: string): Promise<{ error?: string }> {
		return await this.post<{ error?: string }>('/api/v1/auth/resend-verification', {
			email,
			type: 'signup',
			options: {
				emailRedirectTo: `${globalThis.location.origin}/auth/verify`,
			},
		}) ?? { error: 'ResendVerification: Failed to connect to API' };
	}

	// Project Management Methods
	async listProjects(): Promise<{ projects: ClientProjectWithConfigSources[] } | null> {
		return await this.get<{ projects: ClientProjectWithConfigSources[] }>('/api/v1/project');
	}

	async getProject(projectId: string): Promise<{ project: ClientProjectWithConfigSources } | null> {
		const result = await this.get<{ project: ClientProjectWithConfigSources }>(`/api/v1/project/${projectId}`, [
			404,
		]);
		console.log('APIClient.getProject response:', JSON.stringify(result, null, 2));
		return result;
	}

	async blankProject(): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.get<{ project: ClientProjectWithConfigSources }>(`/api/v1/project/new`);
	}

	async createProject(
		project: ClientProjectWithConfigForUpdates,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.post<{ project: ClientProjectWithConfigSources }, ClientProjectWithConfigForUpdates>(
			'/api/v1/project',
			project,
		);
	}

	async updateProject(
		projectId: string,
		updates: Partial<ClientProjectWithConfigForUpdates>,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }, Partial<ClientProjectWithConfigForUpdates>>(
			`/api/v1/project/${projectId}`,
			updates,
		);
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.delete(`/api/v1/project/${projectId}`, [404]);
	}

	async migrateAndAddProject(projectPath: string): Promise<ClientProjectData | null> {
		return await this.post('/api/v1/project/migrate', { projectPath });
	}

	// Data Source Management Methods
	async updateDsConnection(
		projectId: string,
		dsConnectionId: string,
		updates: Partial<ClientDataSourceConnection>,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/datasource/${dsConnectionId}`,
			updates,
		);
	}

	async setPrimaryDsConnection(
		projectId: string,
		dsConnectionId: string,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/primary-datasource`,
			{ dsConnectionId },
		);
	}

	async addDsConnection(
		projectId: string,
		dsConnection: ClientDataSourceConnection,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.post<{ project: ClientProjectWithConfigSources }, ClientDataSourceConnection>(
			`/api/v1/project/${projectId}/datasource`,
			dsConnection,
		);
	}

	async removeDsConnection(
		projectId: string,
		dsConnectionId: string,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.delete<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/datasource/${dsConnectionId}`,
		);
	}

	async getDsProvidersForProject(projectId: string): Promise<{ dsProviders: DataSourceProviderInfo[] } | null> {
		console.log(`APIClient: getDsProvidersForProject: ${projectId}`);
		return await this.get<{ dsProviders: DataSourceProviderInfo[] }>(
			`/api/v1/project/${projectId}/datasource/types`,
		);
	}
	async getDsProviders(mcpServers?: string[]): Promise<{ dsProviders: DataSourceProviderInfo[] } | null> {
		let endpoint = `/api/v1/datasource/types`;

		// If mcpServers parameter is provided, add it as a query parameter
		if (mcpServers && mcpServers.length > 0) {
			const mcpServersParam = encodeURIComponent(JSON.stringify(mcpServers));
			endpoint += `?mcpServers=${mcpServersParam}`;
		}

		return await this.get<{ dsProviders: DataSourceProviderInfo[] }>(endpoint);
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
	): Promise<(ConversationResponse & { logDataEntries: ConversationLogDataEntry[] }) | null> {
		return await this.get<ConversationResponse & { logDataEntries: ConversationLogDataEntry[] }>(
			`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`,
			[404],
		);
	}

	async deleteConversation(id: string, projectId: string): Promise<void> {
		await this.delete(`/api/v1/conversation/${id}?projectId=${encodeURIComponent(projectId)}`, [404]);
	}

	async getMeta(): Promise<SystemMeta | null> {
		return await this.get<{ meta: SystemMeta }>('/api/v1/meta').then((response) => response?.meta ?? null);
	}

	async getStatus(): Promise<ApiStatus | null> {
		return await this.get<ApiStatus>('/api/v1/status');
	}

	async getStatusHtml(): Promise<string | null> {
		try {
			const response = await fetch(`${this.apiUrl}/api/v1/status`, {
				headers: {
					'Accept': 'text/html',
				},
			});
			if (!response.ok) return null;

			// Reset protocol retry count on success
			this.protocolRetryCount = 0;

			return response.text();
		} catch (error) {
			console.error(`APIClient: Status request failed: ${(error as Error).message}`);

			// Try with alternate protocol
			const isConnectionError = error instanceof Error &&
				(error.message.includes('Failed to fetch') ||
					error.message.includes('NetworkError') ||
					error.message.includes('Network request failed'));

			if (isConnectionError && this.protocolRetryCount < this.MAX_PROTOCOL_RETRIES) {
				this.protocolRetryCount++;
				console.log(`APIClient: Connection error detected, trying with alternate protocol`);
				this.switchProtocol();

				// Retry the request with the new protocol
				return this.getStatusHtml();
			}

			return null;
		}
	}

	async getDiagnostics(): Promise<DiagnosticResponse | null> {
		return await this.get<DiagnosticResponse>('/api/v1/doctor/check');
	}

	async getDiagnosticReport(): Promise<Blob | null> {
		try {
			const response = await fetch(`${this.apiUrl}/api/v1/doctor/report`);
			if (!response.ok) return null;
			return response.blob();
		} catch (error) {
			console.error(`APIClient: Diagnostic report request failed: ${(error as Error).message}`);

			// Try with alternate protocol
			const isConnectionError = error instanceof Error &&
				(error.message.includes('Failed to fetch') ||
					error.message.includes('NetworkError') ||
					error.message.includes('Network request failed'));

			if (isConnectionError && this.protocolRetryCount < this.MAX_PROTOCOL_RETRIES) {
				this.protocolRetryCount++;
				console.log(`APIClient: Connection error detected, trying with alternate protocol`);
				this.switchProtocol();

				// Retry the request with the new protocol
				return this.getDiagnosticReport();
			}

			return null;
		}
	}

	async applyDiagnosticFix(fixEndpoint: string): Promise<{ message: string } | null> {
		return await this.post<{ message: string }>(fixEndpoint, {});
	}

	// Configuration Management Methods
	async getGlobalConfig(): Promise<GlobalConfig | null> {
		return await this.get<GlobalConfig>('/api/v1/config/global');
	}

	async updateGlobalConfig(key: string, value: string): Promise<ConfigUpdateResponse | null> {
		return await this.put<ConfigUpdateResponse>('/api/v1/config/global', { key, value });
	}

	async getProjectConfig(projectId: string): Promise<ProjectConfig | null> {
		const result = await this.get<ProjectConfig>(`/api/v1/config/project/${projectId}`);
		console.log('APIClient.getProjectConfig response:', JSON.stringify(result, null, 2));
		return result;
	}

	async updateProjectConfig(projectId: string, key: string, value: string): Promise<ConfigUpdateResponse | null> {
		return await this.put<ConfigUpdateResponse>(`/api/v1/config/project/${projectId}`, { key, value });
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
		conversationId: string,
	): Promise<LogEntryFormatResponse | null> {
		return await this.post<LogEntryFormatResponse>(
			`/api/v1/format_log_entry/browser/${entryType}`,
			{ logEntry, projectId, conversationId },
		);
	}

	// Get model capabilities from the API
	async getModelCapabilities(modelName: string): Promise<ModelResponse | null> {
		return await this.get<ModelResponse>(`/api/v1/model/${encodeURIComponent(modelName)}`);
	}
}

export function createApiClientManager(url: string): ApiClient {
	return new ApiClient(url);
}
