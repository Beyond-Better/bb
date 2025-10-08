import type { UserContext } from 'shared/types/userContext.ts';
import { UserAuthSession } from 'api/auth/userAuthSession.ts';
import { logger } from 'shared/logger.ts';
import { AuthenticationError } from 'api/errors/error.ts';

/**
 * API token information for request authentication
 */
export interface ApiTokenInfo {
	userId: string;
	tokenId: string;
	scopes: string[];
	expiresAt?: number;
	metadata?: Record<string, unknown>;
}

/**
 * Session registry that manages multiple user userAuthSessions and API tokens
 * Provides thread-safe access to user contexts without passing UserAuthSession around
 */
export class SessionRegistry {
	private static instance: SessionRegistry;
	private userAuthSessions = new Map<string, UserAuthSession>();
	private userContexts = new Map<string, UserContext>();
	private apiTokens = new Map<string, ApiTokenInfo>();

	// Request-scoped context (using AsyncLocalStorage pattern for Deno)
	// Or, temporaray solution until full multi-user support is implemented
	private currentContext: UserContext | null = null;

	private constructor() {
		logger.info('SessionRegistry: Initializing session registry');
	}

	static getInstance(): SessionRegistry {
		if (!SessionRegistry.instance) {
			SessionRegistry.instance = new SessionRegistry();
		}
		return SessionRegistry.instance;
	}

	// ============================================================================
	// SESSION MANAGEMENT
	// ============================================================================

	/**
	 * Register a new user session
	 */
	async registerSession(userId: string): Promise<UserContext> {
		logger.info(`SessionRegistry: Registering session for user: ${userId}`);

		let userAuthSession: UserAuthSession | undefined = this.userAuthSessions.get(userId);
		if (!userAuthSession) {
			logger.info(`SessionRegistry: Creating userAuthSession for user: ${userId}`);
			// Create new session manager for this user
			userAuthSession = await new UserAuthSession(userId).initialize();
			logger.info(`SessionRegistry: Created userAuthSession for user: ${userId}`);

			// Store session
			this.userAuthSessions.set(userId, userAuthSession);
		}

		// Create user context
		const session = await userAuthSession.getSession();
		//logger.info(`SessionRegistry: Got session for user: ${userId}`, session);
		if (!session?.user) {
			logger.warn(`SessionRegistry: No session for user: ${userId}`);
			// throw new AuthenticationError('Invalid session - no user found', {
			// 	name: 'SessionRegistration',
			// 	userId,
			// });
		}

		const userContext: UserContext = {
			userId,
			user: session?.user || { id: userId, email: '' },
			userAuthSession,
		};
		this.userContexts.set(userId, userContext);

		logger.info(`SessionRegistry: Session registered successfully for user: ${userId}`);
		return userContext;
	}

	/**
	 * Remove a user session and clean up resources
	 */
	async removeSession(userId: string): Promise<void> {
		logger.info(`SessionRegistry: Removing session for user: ${userId}`);

		const userAuthSession = this.userAuthSessions.get(userId);
		if (userAuthSession) {
			await userAuthSession.clearSession();
			//await userAuthSession.destroy();
			this.userAuthSessions.delete(userId);
		}

		this.userContexts.delete(userId);

		// Remove all API tokens for this user
		const tokensToRemove = Array.from(this.apiTokens.entries())
			.filter(([_, tokenInfo]) => tokenInfo.userId === userId)
			.map(([tokenId]) => tokenId);

		tokensToRemove.forEach((tokenId) => this.apiTokens.delete(tokenId));

		logger.info(`SessionRegistry: Session removed for user: ${userId}`);
	}

	/**
	 * Get session manager for a user
	 */
	getUserAuthSession(userId: string): UserAuthSession | null {
		return this.userAuthSessions.get(userId) || null;
	}

	/**
	 * Get user context for a user
	 */
	getUserContext(userId: string): UserContext | null {
		return this.userContexts.get(userId) || null;
	}

	/**
	 * List all active user userAuthSessions
	 */
	getActiveSessions(): string[] {
		return Array.from(this.userAuthSessions.keys());
	}

	// ============================================================================
	// API TOKEN MANAGEMENT
	// ============================================================================

	/**
	 * Generate an API token for a user
	 */
	// deno-lint-ignore require-await
	async generateApiToken(
		userId: string,
		scopes: string[] = ['api:read', 'api:write'],
		expiresIn?: number,
		metadata?: Record<string, unknown>,
	): Promise<string> {
		// Verify user has active session
		if (!this.userAuthSessions.has(userId)) {
			throw new AuthenticationError('User session not found', {
				name: 'TokenGeneration',
				userId,
			});
		}

		// Generate secure token
		const tokenId = crypto.randomUUID();
		const tokenSecret = crypto.randomUUID();
		const token = `bb_${tokenId}_${tokenSecret}`;

		const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;

		const tokenInfo: ApiTokenInfo = {
			userId,
			tokenId,
			scopes,
			expiresAt,
			metadata,
		};

		this.apiTokens.set(token, tokenInfo);

		logger.info(`SessionRegistry: Generated API token for user: ${userId}, scopes: ${scopes.join(',')}`);
		return token;
	}

	/**
	 * Validate an API token and return user context
	 */
	// deno-lint-ignore require-await
	async validateApiToken(token: string): Promise<UserContext | null> {
		if (!token.startsWith('bb_')) {
			return null;
		}

		const tokenInfo = this.apiTokens.get(token);
		if (!tokenInfo) {
			return null;
		}

		// Check expiration
		if (tokenInfo.expiresAt && Date.now() > tokenInfo.expiresAt) {
			this.apiTokens.delete(token);
			logger.warn(`SessionRegistry: Expired API token removed for user: ${tokenInfo.userId}`);
			return null;
		}

		const userContext = this.userContexts.get(tokenInfo.userId);
		if (!userContext) {
			// Clean up orphaned token
			this.apiTokens.delete(token);
			return null;
		}

		return userContext;
	}

	/**
	 * Revoke an API token
	 */
	revokeApiToken(token: string): boolean {
		return this.apiTokens.delete(token);
	}

	/**
	 * Revoke all API tokens for a user
	 */
	revokeUserTokens(userId: string): number {
		const tokensToRevoke = Array.from(this.apiTokens.entries())
			.filter(([_, tokenInfo]) => tokenInfo.userId === userId)
			.map(([token]) => token);

		tokensToRevoke.forEach((token) => this.apiTokens.delete(token));

		logger.info(`SessionRegistry: Revoked ${tokensToRevoke.length} API tokens for user: ${userId}`);
		return tokensToRevoke.length;
	}

	// ============================================================================
	// CONTEXT MANAGEMENT
	// ============================================================================

	/**
	 * Set current request context (for use in request middleware)
	 */
	setCurrentContext(context: UserContext): void {
		this.currentContext = context;
	}

	/**
	 * Get current request context
	 */
	getCurrentContext(): UserContext | null {
		return this.currentContext;
	}

	/**
	 * Update user context with project/collaboration info
	 */
	updateUserContext(
		userId: string,
		updates: Partial<Pick<UserContext, 'projectId' | 'collaborationId' | 'interactionId'>>,
	): void {
		const context = this.userContexts.get(userId);
		if (context) {
			Object.assign(context, updates);
		}
	}

	/**
	 * Execute a function with a specific user context
	 */
	async withUserContext<T>(userId: string, fn: (context: UserContext) => Promise<T>): Promise<T> {
		const context = this.userContexts.get(userId);
		if (!context) {
			throw new AuthenticationError('User context not found', {
				name: 'ContextExecution',
				userId,
			});
		}

		const previousContext = this.currentContext;
		this.currentContext = context;

		try {
			return await fn(context);
		} finally {
			this.currentContext = previousContext;
		}
	}

	/**
	 * Get current user session manager (convenience method)
	 */
	getCurrentUserAuthSession(): UserAuthSession | null {
		return this.currentContext?.userAuthSession || null;
	}

	/**
	 * Get current user ID (convenience method)
	 */
	getCurrentUserId(): string | null {
		return this.currentContext?.userId || null;
	}

	// ============================================================================
	// CLEANUP
	// ============================================================================

	/**
	 * Clean up expired tokens and inactive userAuthSessions
	 */
	// deno-lint-ignore require-await
	async cleanup(): Promise<void> {
		logger.info('SessionRegistry: Starting cleanup');

		// Remove expired tokens
		const now = Date.now();
		const expiredTokens = Array.from(this.apiTokens.entries())
			.filter(([_, tokenInfo]) => tokenInfo.expiresAt && now > tokenInfo.expiresAt)
			.map(([token]) => token);

		expiredTokens.forEach((token) => this.apiTokens.delete(token));

		if (expiredTokens.length > 0) {
			logger.info(`SessionRegistry: Removed ${expiredTokens.length} expired API tokens`);
		}

		logger.info('SessionRegistry: Cleanup completed');
	}

	/**
	 * Shutdown and clean up all userAuthSessions
	 */
	async shutdown(): Promise<void> {
		logger.info('SessionRegistry: Starting shutdown');

		// Clean up all userAuthSessions
		const cleanupPromises = Array.from(this.userAuthSessions.entries()).map(async ([userId, userAuthSession]) => {
			try {
				await userAuthSession.destroy();
				logger.debug(`SessionRegistry: Cleaned up session for user: ${userId}`);
			} catch (error) {
				logger.error(`SessionRegistry: Error cleaning up session for user ${userId}:`, error);
			}
		});

		await Promise.allSettled(cleanupPromises);

		// Clear all maps
		this.userAuthSessions.clear();
		this.apiTokens.clear();
		this.userContexts.clear();
		this.currentContext = null;

		logger.info('SessionRegistry: Shutdown completed');
	}
}

// Export the SessionRegistry class so consumers can call SessionRegistry.getInstance()
// This avoids circular dependency issues caused by top-level instantiation
