import type { JSX } from 'preact';

import type {
	CollaborationLogDataEntry,
	CollaborationValues,
	InteractionStats,
	ProjectId,
	TokenUsage,
	TokenUsageStatsForInteraction,
} from 'shared/types.ts';
import type { SystemMeta } from 'shared/types/version.ts';
import type {
	ClientDataSourceConnection,
	ClientProjectData,
	ClientProjectWithConfigForUpdates,
	ClientProjectWithConfigSources,
} from 'shared/types/project.ts';
import type { DataSourceProviderInfo } from 'shared/types/dataSource.ts';
import type { CollaborationParams } from 'shared/types/collaboration.ts';
import type { GlobalConfig, MCPServerConfig, ProjectConfig } from 'shared/config/types.ts';
import type { ResourceSuggestionsResponse } from 'api/utils/resourceSuggestions.ts';
import type { ListDirectoryResponse } from 'api/utils/fileHandling.ts';
import type { Session, User } from '../types/auth.ts';
import type { LLMModelConfig } from '../types/llm.types.ts';
import type {
	BillingPreviewResults,
	BillingPreviewWithUsage,
	BlockPurchase,
	BlockPurchaseResults,
	EnhancedPurchaseHistory,
	EnhancedPurchaseHistoryResults,
	PaymentMethod,
	PaymentMethodResults,
	Plan,
	PlanResults,
	PurchaseHistoryFilters,
	PurchasesBalance,
	Subscription,
	SubscriptionResults,
	SubscriptionWithPaymentMethods,
	UsageAnalytics,
	UsageAnalyticsResults,
} from '../types/subscription.ts';
import { savePreferredProtocol } from './connectionManager.utils.ts';

export interface AuthResponse {
	user?: User;
	session?: Session;
	error?: { code?: string; message: string; reason?: string };
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

// Pricing tier interfaces
export interface PricingTier {
	tier: number;
	name: string;
	threshold: { min: number; max: number | null };
	// Note: Actual pricing must be loaded from backend edge function, not from JSON
	price?: number; // Placeholder for future backend-loaded pricing
}

export interface TieredPricingConfig {
	tiers: PricingTier[];
	tierDeterminedBy: 'totalInputTokens' | 'inputTokens' | 'totalTokens';
}

export interface ModelPricingInfo {
	// IMPORTANT: All pricing values below are RAW model registry data
	// Actual user pricing must be loaded from backend edge functions

	// Basic token pricing (flat rate models) - RAW DATA ONLY
	token_pricing?: {
		input: number; // Raw price - NOT user pricing
		output: number; // Raw price - NOT user pricing
	};

	// Tiered pricing configurations - Token thresholds are valid, prices are RAW
	inputTokensTieredConfig?: TieredPricingConfig;
	outputTokensTieredConfig?: TieredPricingConfig;

	// Cache pricing (for prompt caching enabled models) - RAW DATA ONLY
	inputTokensCacheTypes?: Record<string, {
		description: string;
		inheritsTiers: boolean;
		multiplier: number; // Raw multiplier - NOT user pricing
		explicitPricing?: {
			tiers: Array<{ tier: number; price: number }>; // Raw prices - NOT user pricing
		};
	}>;

	// Content type pricing (for multimodal models) - RAW DATA ONLY
	inputTokensContentTypes?: Record<string, {
		multiplier: number; // Raw multiplier - NOT user pricing
		explicitPricing?: {
			tiers: Array<{ tier: number; price: number }>; // Raw prices - NOT user pricing
		};
	}>;

	// Pricing metadata
	pricing_metadata?: {
		currency: string;
		effectiveDate: string;
	};
}

// Model capability types
export interface ModelCapabilities {
	contextWindow: number;
	maxOutputTokens: number;
	pricing?: ModelPricingInfo;
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

interface CollaborationResponse {
	id: string;
	title: string;
	type?: string;
	llmProviderName?: string;
	model?: string;
	updatedAt: string;
	createdAt: string;
	totalInteractions?: number;
	lastInteractionId?: string;
	lastInteractionMetadata?: {
		llmProviderName: string;
		model: string;
		updatedAt: string;
	};
	interactionStats?: {
		statementTurnCount: number;
		interactionTurnCount: number;
		statementCount: number;
	};
	tokenUsageStats?: {
		tokenUsageInteraction: TokenUsage;
		tokenUsageTurn: TokenUsage;
		tokenUsageStatement: TokenUsage;
		//totalTokensTotal?: TokenUsage;
	};
	modelConfig?: LLMModelConfig;
	collaborationParams?: CollaborationParams;
}

export interface CollaborationListResponse {
	collaborations: CollaborationValues[];
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

// OAuth API Response Types
export interface MCPOAuthAuthorizeResponse {
	authorizationUrl: string;
	state?: string;
	codeVerifier?: string;
}

export interface MCPOAuthTokenResponse {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
	tokenType?: string;
	scope?: string;
}

export interface MCPOAuthServerStatus {
	connected: boolean;
	serverInfo?: {
		name: string;
		version?: string;
		capabilities?: string[];
	};
	lastChecked?: string;
	error?: string;
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
					// For allowed error codes, try to return the JSON response body
					try {
						return await response.json() as T;
					} catch {
						// If response body is not valid JSON, return null
						return null;
					}
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
	async getCurrentSubscription(): Promise<SubscriptionResults | null> {
		const results = await this.get<SubscriptionResults>('/api/v1/user/subscription/current');
		console.log('APIClient: getCurrentSubscription', results);
		return results
			? {
				subscription: results?.subscription,
				futureSubscription: results?.futureSubscription,
				paymentMethods: results?.paymentMethods || [],
			}
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
		couponCode?: string,
	): Promise<SubscriptionWithPaymentMethods | null> {
		const data: {
			planId: string;
			payment_method_id: string | null;
			paymentMethodId: string | null;
			couponCode?: string;
		} = {
			planId,
			payment_method_id: paymentMethodId, // Original format - may be expected by some endpoints
			paymentMethodId: paymentMethodId, // New format - matches the property name in the edge function
		};
		if (couponCode) {
			data.couponCode = couponCode;
		}
		const results = await this.post<SubscriptionResults>('/api/v1/user/subscription/change', data);
		return results ? { ...results?.subscription, payment_methods: results?.paymentMethods } : null;
	}

	async cancelSubscription(
		immediate: boolean = false,
	): Promise<{ success: boolean; subscription: Subscription }> {
		const result = await this.post<{ success: boolean; subscription: Subscription }>(
			'/api/v1/user/subscription/cancel',
			{ immediate },
		);
		return result ?? { success: false, subscription: {} as Subscription };
	}

	async getBillingPreview(planId: string, couponCode?: string): Promise<BillingPreviewWithUsage | null> {
		const requestBody: { planId: string; couponCode?: string; preview: boolean } = {
			planId,
			preview: true, // Always request preview mode
		};
		if (couponCode) {
			requestBody.couponCode = couponCode;
		}
		const results = await this.post<BillingPreviewResults>('/api/v1/user/subscription/preview', requestBody);
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

	// NEW ANALYTICS ENDPOINTS FOR RESTRUCTURED BILLING TABS

	// Usage Analytics for Usage & History tab
	async getUsageAnalytics(params?: URLSearchParams): Promise<UsageAnalytics | null> {
		const queryString = params ? `?${params.toString()}` : '';
		const result = await this.get<UsageAnalyticsResults>(`/api/v1/user/billing/usage/analytics${queryString}`);
		return result?.analytics || null;
	}

	// Enhanced Purchase History with filtering for Usage & History tab
	async getEnhancedPurchaseHistory(filters?: PurchaseHistoryFilters): Promise<EnhancedPurchaseHistory | null> {
		let endpoint = '/api/v1/user/billing/history/enhanced';

		if (filters) {
			const params = new URLSearchParams();
			if (filters.transaction_type && filters.transaction_type !== 'all') {
				params.append('type', filters.transaction_type);
			}
			if (filters.date_start) params.append('date_start', filters.date_start);
			if (filters.date_end) params.append('date_end', filters.date_end);
			if (filters.status && filters.status !== 'all') {
				params.append('status', filters.status);
			}
			if (filters.page) params.append('page', filters.page.toString());
			if (filters.per_page) params.append('per_page', filters.per_page.toString());

			const queryString = params.toString();
			if (queryString) {
				endpoint += `?${queryString}`;
			}
		}

		const result = await this.get<EnhancedPurchaseHistoryResults>(endpoint);
		return result?.history || null;
	}

	// Auto Top-up Methods
	async getAutoTopupStatus(): Promise<
		{
			settings: {
				enabled: boolean;
				min_balance_cents: number;
				purchase_amount_cents: number;
				max_per_day_cents: number;
			};
			rate_limits: {
				daily_topup_count: number;
				daily_topup_amount_cents: number;
				failure_count: number;
				temporary_disable_until: string | null;
			};
			recent_purchases: Array<{
				purchase_id: string;
				amount_usd: number;
				purchase_status: string;
				auto_triggered: boolean;
				created_at: string;
			}>;
		} | null
	> {
		return await this.get<{
			settings: {
				enabled: boolean;
				min_balance_cents: number;
				purchase_amount_cents: number;
				max_per_day_cents: number;
			};
			rate_limits: {
				daily_topup_count: number;
				daily_topup_amount_cents: number;
				failure_count: number;
				temporary_disable_until: string | null;
			};
			recent_purchases: Array<{
				purchase_id: string;
				amount_usd: number;
				purchase_status: string;
				auto_triggered: boolean;
				created_at: string;
			}>;
		}>('/api/v1/user/billing/auto-topup');
	}

	async updateAutoTopupSettings(settings: {
		enabled: boolean;
		min_balance_cents: number;
		purchase_amount_cents: number;
		max_per_day_cents: number;
	}): Promise<{ success: boolean; message: string } | null> {
		return await this.put<{ success: boolean; message: string }>('/api/v1/user/billing/auto-topup', settings);
	}

	async triggerAutoTopup(): Promise<
		{
			success: boolean;
			purchase_id?: string;
			amount_cents?: number;
			message: string;
			retry_after_seconds?: number;
		} | null
	> {
		return await this.post<{
			success: boolean;
			purchase_id?: string;
			amount_cents?: number;
			message: string;
			retry_after_seconds?: number;
		}>('/api/v1/user/billing/auto-topup', {});
	}

	// Auth Methods
	async signIn(email: string, password: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/login', { email, password }, [400, 401]) ??
			{ error: { message: 'SignIn: Failed to connect to API' } };
	}

	async signOut(): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/logout', {}, [400, 401]) ??
			{ error: { message: 'SignOut: Failed to connect to API' } };
	}

	async getSession(): Promise<AuthResponse> {
		return await this.get<AuthResponse>('/api/v1/auth/session', [400, 401]) ??
			{ error: { message: 'GetSession: Failed to connect to API' } };
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
		}, [400, 401]) ?? { error: { message: 'SignUp: Failed to connect to API' } };
	}

	async verifyOtp(tokenHash: string, type: string): Promise<AuthResponse> {
		return await this.post<AuthResponse>('/api/v1/auth/callback', {
			token_hash: tokenHash,
			type,
		}, [400, 401]) ?? { error: { message: 'VerifyToken: Failed to connect to API' } };
	}

	async checkEmailVerification(
		email: string,
	): Promise<{ verified?: boolean; exists?: boolean; error?: { code?: string; message: string; reason?: string } }> {
		return await this.post<
			{ verified?: boolean; exists?: boolean; error?: { code?: string; message: string; reason?: string } }
		>(
			'/api/v1/auth/check-email-verification',
			{
				email,
			},
			[400, 401],
		) ?? { error: { message: 'CheckEmailVerification: Failed to connect to API' } };
	}

	async resendVerificationEmail(
		email: string,
	): Promise<{ error?: { code?: string; message: string; reason?: string } }> {
		return await this.post<{ error?: { code?: string; message: string; reason?: string } }>(
			'/api/v1/auth/resend-verification',
			{
				email,
				type: 'signup',
				options: {
					emailRedirectTo: `${globalThis.location.origin}/auth/verify`,
				},
			},
			[400, 401],
		) ?? { error: { message: 'ResendVerification: Failed to connect to API' } };
	}

	async resetPasswordForEmail(
		email: string,
	): Promise<{ error?: { code?: string; message: string; reason?: string } }> {
		return await this.post<{ error?: { code?: string; message: string; reason?: string } }>(
			'/api/v1/auth/reset-password',
			{
				email,
				// options: {
				// 	redirectTo: `${globalThis.location.origin}/auth/verify?type=recovery&next=/auth/update-password`,
				// },
			},
			[400, 401],
		) ?? { error: { message: 'ResetPassword: Failed to connect to API' } };
	}

	async updatePassword(
		password: string,
	): Promise<{ user?: User; success?: boolean; error?: { code?: string; message: string; reason?: string } }> {
		return await this.post<
			{ user?: User; success?: boolean; error?: { code?: string; message: string; reason?: string } }
		>('/api/v1/auth/update-password', {
			password,
		}, [400, 401]) ?? { error: { message: 'UpdatePassword: Failed to connect to API' } };
	}

	// Project Management Methods
	async listProjects(): Promise<{ projects: ClientProjectWithConfigSources[] } | null> {
		return await this.get<{ projects: ClientProjectWithConfigSources[] }>('/api/v1/project');
	}

	async getProject(projectId: ProjectId): Promise<{ project: ClientProjectWithConfigSources } | null> {
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
		projectId: ProjectId,
		updates: Partial<ClientProjectWithConfigForUpdates>,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }, Partial<ClientProjectWithConfigForUpdates>>(
			`/api/v1/project/${projectId}`,
			updates,
		);
	}

	async deleteProject(projectId: ProjectId): Promise<void> {
		await this.delete(`/api/v1/project/${projectId}`, [404]);
	}

	async migrateAndAddProject(projectPath: string): Promise<ClientProjectData | null> {
		return await this.post('/api/v1/project/migrate', { projectPath });
	}

	// Data Source Management Methods
	async updateDsConnection(
		projectId: ProjectId,
		dsConnectionId: string,
		updates: Partial<ClientDataSourceConnection>,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/datasource/${dsConnectionId}`,
			updates,
		);
	}

	async setPrimaryDsConnection(
		projectId: ProjectId,
		dsConnectionId: string,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.put<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/primary-datasource`,
			{ dsConnectionId },
		);
	}

	async addDsConnection(
		projectId: ProjectId,
		dsConnection: ClientDataSourceConnection,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.post<{ project: ClientProjectWithConfigSources }, ClientDataSourceConnection>(
			`/api/v1/project/${projectId}/datasource`,
			dsConnection,
		);
	}

	async removeDsConnection(
		projectId: ProjectId,
		dsConnectionId: string,
	): Promise<{ project: ClientProjectWithConfigSources } | null> {
		return await this.delete<{ project: ClientProjectWithConfigSources }>(
			`/api/v1/project/${projectId}/datasource/${dsConnectionId}`,
		);
	}

	async getDsProvidersForProject(projectId: ProjectId): Promise<{ dsProviders: DataSourceProviderInfo[] } | null> {
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
	async suggestResources(partialPath: string, projectId: ProjectId): Promise<ResourceSuggestionsResponse | null> {
		return await this.post<ResourceSuggestionsResponse>(
			'/api/v1/resources/suggest',
			{ partialPath, projectId },
		);
	}

	async suggestResourcesForPath(partialPath: string, rootPath: string, options: {
		limit?: number;
		caseSensitive?: boolean;
		type?: 'all' | 'file' | 'directory';
	} = {}): Promise<ResourceSuggestionsResponse | null> {
		return await this.post<ResourceSuggestionsResponse>(
			'/api/v1/resources/suggest-for-path',
			{
				partialPath,
				rootPath,
				...options,
			},
		);
	}

	async listDirectory(
		dirPath: string,
		options: {
			only?: 'files' | 'directories';
			matchingString?: string;
			includeHidden?: boolean;
			strictRoot?: boolean;
		} = {},
	): Promise<ListDirectoryResponse | null> {
		try {
			return await this.post<ListDirectoryResponse>('/api/v1/resources/list-directory', {
				dirPath,
				...options,
			});
		} catch (error) {
			console.log(`APIClient: List directory failed: ${(error as Error).message}`);
			throw error;
		}
	}

	// Collaboration Management Methods
	async listCollaborations(projectId: ProjectId, page = 1, limit = 500): Promise<
		{
			collaborations: CollaborationValues[];
			pagination: {
				page: number;
				pageSize: number;
				totalPages: number;
				totalItems: number;
			};
		} | null
	> {
		return await this.get<{
			collaborations: CollaborationValues[];
			pagination: {
				page: number;
				pageSize: number;
				totalPages: number;
				totalItems: number;
			};
		}>(
			`/api/v1/collaborations?projectId=${encodeURIComponent(projectId)}&page=${page}&limit=${limit}`,
		);
	}

	async createCollaboration(title: string, type: string, projectId: ProjectId): Promise<
		{
			collaborationId: string;
			title: string;
			type: string;
			createdAt: string;
			updatedAt: string;
		} | null
	> {
		return await this.post<{
			collaborationId: string;
			title: string;
			type: string;
			createdAt: string;
			updatedAt: string;
		}>('/api/v1/collaborations', {
			title,
			type,
			projectId,
		});
	}

	async getCollaboration(
		collaborationId: string,
		projectId: ProjectId,
	): Promise<(CollaborationValues & { logDataEntries: CollaborationLogDataEntry[]; error?: string }) | null> {
		//): Promise<(CollaborationResponse & { logDataEntries: CollaborationLogDataEntry[] }) | null> {
		return await this.get<CollaborationValues & { logDataEntries: CollaborationLogDataEntry[]; error?: string }>(
			`/api/v1/collaborations/${collaborationId}?projectId=${encodeURIComponent(projectId)}`,
			[404],
		);
	}

	async deleteCollaboration(collaborationId: string, projectId: ProjectId): Promise<void> {
		await this.delete(`/api/v1/collaborations/${collaborationId}?projectId=${encodeURIComponent(projectId)}`, [
			404,
		]);
	}

	async updateCollaborationTitle(collaborationId: string, title: string, projectId: ProjectId): Promise<void> {
		await this.put(`/api/v1/collaborations/${collaborationId}/title?projectId=${encodeURIComponent(projectId)}`, {
			title,
		});
	}

	async toggleCollaborationStar(collaborationId: string, starred: boolean, projectId: ProjectId): Promise<void> {
		await this.put(`/api/v1/collaborations/${collaborationId}/star?projectId=${encodeURIComponent(projectId)}`, {
			starred,
		});
	}

	async createInteraction(collaborationId: string, projectId: ProjectId, parentInteractionId?: string): Promise<
		{
			collaborationId: string;
			interactionId: string;
		} | null
	> {
		return await this.post<{
			collaborationId: string;
			interactionId: string;
		}>(`/api/v1/collaborations/${collaborationId}/interactions`, {
			projectId,
			parentInteractionId,
		});
	}

	async getInteraction(
		collaborationId: string,
		interactionId: string,
		projectId: ProjectId,
	): Promise<(CollaborationResponse & { logDataEntries: CollaborationLogDataEntry[]; error?: string }) | null> {
		return await this.get<CollaborationResponse & { logDataEntries: CollaborationLogDataEntry[]; error?: string }>(
			`/api/v1/collaborations/${collaborationId}/interactions/${interactionId}?projectId=${
				encodeURIComponent(projectId)
			}`,
			[404],
		);
	}

	async chatInteraction(
		collaborationId: string,
		interactionId: string,
		statement: string,
		projectId: ProjectId,
		maxTurns?: number,
	): Promise<
		{
			collaborationId: string;
			interactionId: string;
			logEntry: CollaborationLogDataEntry;
			collaborationTitle: string;
			interactionStats: InteractionStats;
			tokenUsageStatsForInteraction: TokenUsageStatsForInteraction;
		} | null
	> {
		return await this.post<{
			collaborationId: string;
			interactionId: string;
			logEntry: CollaborationLogDataEntry;
			collaborationTitle: string;
			interactionStats: InteractionStats;
			tokenUsageStatsForInteraction: TokenUsageStatsForInteraction;
		}>(`/api/v1/collaborations/${collaborationId}/interactions/${interactionId}`, {
			statement,
			projectId,
			maxTurns,
		});
	}

	async deleteInteraction(collaborationId: string, interactionId: string, projectId: ProjectId): Promise<void> {
		await this.delete(
			`/api/v1/collaborations/${collaborationId}/interactions/${interactionId}?projectId=${
				encodeURIComponent(projectId)
			}`,
			[404],
		);
	}

	async getCollaborationDefaults(projectId: ProjectId): Promise<CollaborationValues | null> {
		return await this.get<CollaborationValues>(
			`/api/v1/collaborations/defaults?projectId=${encodeURIComponent(projectId)}`,
		);
	}

	// OAuth Methods for MCP Server Management

	/**
	 * Initiate OAuth authorization flow for MCP server
	 * @param serverId MCP server ID
	 * @param state Optional client-generated state for CSRF protection
	 * @returns Authorization URL and flow parameters
	 */
	async mcpServerOAuthAuthorize(serverId: string, state?: string): Promise<MCPOAuthAuthorizeResponse | null> {
		try {
			const requestBody = state ? { state } : {};
			return await this.post<MCPOAuthAuthorizeResponse>(`/api/v1/mcp/servers/${serverId}/authorize`, requestBody);
		} catch (error) {
			console.error(`APIClient: MCP OAuth authorize failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Handle OAuth callback for MCP server
	 * @param serverId MCP server ID
	 * @param code Authorization code from OAuth provider
	 * @param state State parameter for CSRF protection
	 * @param codeVerifier PKCE code verifier (optional)
	 * @returns Token response
	 */
	async mcpServerOAuthCallback(
		serverId: string,
		code: string,
		state?: string,
		codeVerifier?: string,
	): Promise<MCPOAuthTokenResponse | null> {
		try {
			return await this.post<MCPOAuthTokenResponse>(`/api/v1/mcp/servers/${serverId}/callback`, {
				code,
				state,
				codeVerifier,
			});
		} catch (error) {
			console.error(`APIClient: MCP OAuth callback failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Perform client credentials OAuth flow for MCP server
	 * @param serverId MCP server ID
	 * @returns Token response
	 */
	async mcpServerOAuthClientCredentials(serverId: string): Promise<MCPOAuthTokenResponse | null> {
		try {
			return await this.post<MCPOAuthTokenResponse>(`/api/v1/mcp/servers/${serverId}/client-credentials`, {});
		} catch (error) {
			console.error(
				`APIClient: MCP OAuth client credentials failed for ${serverId}: ${(error as Error).message}`,
			);
			return null;
		}
	}

	/**
	 * Refresh OAuth token for MCP server
	 * @param serverId MCP server ID
	 * @returns Token response with new access token
	 */
	async mcpServerOAuthRefresh(serverId: string): Promise<MCPOAuthTokenResponse | null> {
		try {
			return await this.post<MCPOAuthTokenResponse>(`/api/v1/mcp/servers/${serverId}/refresh`, {});
		} catch (error) {
			console.error(`APIClient: MCP OAuth token refresh failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Get MCP server connection status
	 * @param serverId MCP server ID
	 * @returns Server status and connection info
	 */
	async mcpServerStatus(serverId: string): Promise<MCPOAuthServerStatus | null> {
		try {
			return await this.get<MCPOAuthServerStatus>(`/api/v1/mcp/servers/${serverId}/status`);
		} catch (error) {
			console.error(`APIClient: MCP server status check failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Get OAuth configuration status for MCP server
	 * @param serverId MCP server ID
	 * @returns OAuth configuration status including discovery and dynamic registration info
	 */
	async mcpServerOAuthConfig(serverId: string): Promise<
		{
			serverId: string;
			hasOAuth: boolean;
			grantType?: string;
			configurationStatus: 'complete' | 'missing_client_credentials' | 'discovery_failed';
			supportsDynamicRegistration: boolean;
			dynamicRegistrationStatus: 'successful' | 'failed' | 'not_attempted' | 'not_supported';
			discoveredEndpoints?: {
				authorization_endpoint?: string;
				token_endpoint?: string;
				registration_endpoint?: string;
			};
			hasClientCredentials: boolean;
			hasAccessToken: boolean;
		} | null
	> {
		try {
			return await this.get<{
				serverId: string;
				hasOAuth: boolean;
				grantType?: string;
				configurationStatus: 'complete' | 'missing_client_credentials' | 'discovery_failed';
				supportsDynamicRegistration: boolean;
				dynamicRegistrationStatus: 'successful' | 'failed' | 'not_attempted' | 'not_supported';
				discoveredEndpoints?: {
					authorization_endpoint?: string;
					token_endpoint?: string;
					registration_endpoint?: string;
				};
				hasClientCredentials: boolean;
				hasAccessToken: boolean;
			}>(`/api/v1/mcp/servers/${serverId}/oauth-config`);
		} catch (error) {
			console.error(`APIClient: MCP OAuth config check failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	// MCP Server Management Methods

	/**
	 * Add new MCP server configuration
	 * @param serverConfig MCP server configuration
	 * @returns Success response with server info
	 */
	async addMCPServer(serverConfig: MCPServerConfig): Promise<
		{
			success: boolean;
			message: string;
			serverId: string;
			connected: boolean;
			connectionError?: string;
		} | null
	> {
		try {
			// Ensure required fields are provided
			if (!serverConfig.name?.trim()) {
				throw new Error('Server name is required');
			}
			if (!serverConfig.id?.trim()) {
				throw new Error('Server ID is required');
			}

			return await this.post<{
				success: boolean;
				message: string;
				serverId: string;
				connected: boolean;
				connectionError?: string;
			}, MCPServerConfig>('/api/v1/mcp/servers', serverConfig);
		} catch (error) {
			console.error(`APIClient: Add MCP server failed for ${serverConfig.id}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Update existing MCP server configuration
	 * @param serverId MCP server ID
	 * @param serverConfig Updated MCP server configuration (excluding ID)
	 * @returns Success response with server info
	 */
	async updateMCPServer(serverId: string, serverConfig: Omit<MCPServerConfig, 'id'>): Promise<
		{
			success: boolean;
			message: string;
			serverId: string;
		} | null
	> {
		try {
			// Ensure name is provided for API validation
			if (!serverConfig.name?.trim()) {
				throw new Error('Server name is required');
			}

			return await this.put<{
				success: boolean;
				message: string;
				serverId: string;
			}, Omit<MCPServerConfig, 'id'>>(`/api/v1/mcp/servers/${serverId}`, serverConfig);
		} catch (error) {
			console.error(`APIClient: Update MCP server failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Remove MCP server configuration
	 * @param serverId MCP server ID
	 * @returns Success response
	 */
	async removeMCPServer(serverId: string): Promise<
		{
			success: boolean;
			message: string;
		} | null
	> {
		try {
			return await this.delete<{
				success: boolean;
				message: string;
			}>(`/api/v1/mcp/servers/${serverId}`);
		} catch (error) {
			console.error(`APIClient: Remove MCP server failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Connect to MCP server manually
	 * @param serverId MCP server ID
	 * @returns Success response
	 */
	async connectMCPServer(serverId: string): Promise<
		{
			success: boolean;
			message: string;
			requiresAuth?: boolean;
		} | null
	> {
		try {
			return await this.post<{
				success: boolean;
				message: string;
				requiresAuth?: boolean;
			}>(`/api/v1/mcp/servers/${serverId}/connect`, {});
		} catch (error) {
			console.error(`APIClient: Connect MCP server failed for ${serverId}: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * List all MCP servers
	 * @returns Array of MCP server configurations with status
	 */
	async listMCPServers(): Promise<
		{
			servers: Array<{
				id: string;
				name: string;
				description?: string;
				transport: 'stdio' | 'http';
				status: 'connected' | 'disconnected' | 'error';
				oauth?: {
					grantType: 'authorization_code' | 'client_credentials';
					hasToken: boolean;
					expiresAt?: string;
				};
			}>;
		} | null
	> {
		try {
			return await this.get<{
				servers: Array<{
					id: string;
					name: string;
					description?: string;
					transport: 'stdio' | 'http';
					status: 'connected' | 'disconnected' | 'error';
					oauth?: {
						grantType: 'authorization_code' | 'client_credentials';
						hasToken: boolean;
						expiresAt?: string;
					};
				}>;
			}>('/api/v1/mcp/servers');
		} catch (error) {
			console.error(`APIClient: List MCP servers failed: ${(error as Error).message}`);
			return null;
		}
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

	async getProjectConfig(projectId: ProjectId): Promise<ProjectConfig | null> {
		const result = await this.get<ProjectConfig>(`/api/v1/config/project/${projectId}`);
		//console.log('APIClient.getProjectConfig response:', JSON.stringify(result, null, 2));
		return result;
	}

	async updateProjectConfig(projectId: ProjectId, key: string, value: string): Promise<ConfigUpdateResponse | null> {
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
		projectId: ProjectId,
		collaborationId: string,
	): Promise<LogEntryFormatResponse | null> {
		return await this.post<LogEntryFormatResponse>(
			`/api/v1/format_log_entry/browser/${entryType}`,
			{ logEntry, projectId, collaborationId },
		);
	}

	// List all available models
	async listModels(
		page?: number,
		pageSize?: number,
	): Promise<
		{
			models: Array<
				{
					id: string;
					displayName: string;
					provider: string;
					providerLabel: string;
					contextWindow: number;
					responseSpeed: string;
				}
			>;
			pagination: { total: number; page: number; pageSize: number; pageCount: number };
		} | null
	> {
		const params = new URLSearchParams();
		if (page !== undefined) params.append('page', page.toString());
		if (pageSize !== undefined) params.append('pageSize', pageSize.toString());
		const query = params.toString() ? `?${params.toString()}` : '';
		return await this.get<
			{
				models: Array<
					{
						id: string;
						displayName: string;
						provider: string;
						providerLabel: string;
						contextWindow: number;
						responseSpeed: string;
					}
				>;
				pagination: { total: number; page: number; pageSize: number; pageCount: number };
			}
		>(`/api/v1/model${query}`);
	}

	// Get model capabilities from the API
	async getModelCapabilities(modelName: string): Promise<ModelResponse | null> {
		return await this.get<ModelResponse>(`/api/v1/model/${encodeURIComponent(modelName)}`);
	}

	// Feature Access Methods
	async checkExternalToolsAccess(): Promise<{ hasAccess: boolean; reason: string } | null> {
		return await this.get<{ hasAccess: boolean; reason: string }>('/api/v1/user/features/external-tools');
	}

	async getUserFeatures(): Promise<
		{
			profile: {
				models: string[];
				datasources: { name: string; read: boolean; write: boolean }[];
				tools: string[];
				limits: { tokensPerMinute: number; requestsPerMinute: number };
				support: {
					community: boolean;
					email: boolean;
					priorityQueue: boolean;
					earlyAccess: boolean;
					workspaceIsolation: boolean;
					sso: boolean;
					dedicatedCSM: boolean;
					onPremises: boolean;
				};
			};
		} | null
	> {
		return await this.get<{
			profile: {
				models: string[];
				datasources: { name: string; read: boolean; write: boolean }[];
				tools: string[];
				limits: { tokensPerMinute: number; requestsPerMinute: number };
				support: {
					community: boolean;
					email: boolean;
					priorityQueue: boolean;
					earlyAccess: boolean;
					workspaceIsolation: boolean;
					sso: boolean;
					dedicatedCSM: boolean;
					onPremises: boolean;
				};
			};
		}>('/api/v1/user/features');
	}

	async checkFeatureAccess(featureKey: string): Promise<
		{
			result: {
				access_granted: boolean;
				// deno-lint-ignore no-explicit-any
				feature_value: any;
				access_reason: string;
				resolved_from: string;
			};
		} | null
	> {
		return await this.post<{
			result: {
				access_granted: boolean;
				// deno-lint-ignore no-explicit-any
				feature_value: any;
				access_reason: string;
				resolved_from: string;
			};
		}>('/api/v1/user/features/check', { featureKey });
	}

	async batchCheckFeatureAccess(featureKeys: string[]): Promise<
		{
			results: Record<string, {
				access_granted: boolean;
				// deno-lint-ignore no-explicit-any
				feature_value: any;
				access_reason: string;
				resolved_from: string;
			}>;
		} | null
	> {
		return await this.post<{
			results: Record<string, {
				access_granted: boolean;
				// deno-lint-ignore no-explicit-any
				feature_value: any;
				access_reason: string;
				resolved_from: string;
			}>;
		}>('/api/v1/user/features/batch', { featureKeys });
	}
}

export function createApiClientManager(url: string): ApiClient {
	return new ApiClient(url);
}
