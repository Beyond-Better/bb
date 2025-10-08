import type { Context } from '@oak/oak';
import type { UserAuthSession } from 'api/auth/userAuthSession.ts';
import { SupabaseClientFactory } from 'api/auth/supabaseClientFactory.ts';
import { SessionRegistry } from 'api/auth/sessionRegistry.ts';
import { logger } from 'shared/logger.ts';
import type { BbState } from 'api/types/app.ts';
//import type { AuthError } from "api/types/auth.ts";
import type { EmailOtpType, VerifyTokenHashParams } from '@supabase/supabase-js';

/**
 * Get the session userAuthSession from app state
 */
function getUserAuthSession(ctx: Context<BbState>): UserAuthSession {
	// auth middleware guarantees userContext is defined, or returns early
	return ctx.state.userContext!.userAuthSession;
}

/**
 * Handle email/password login
 */
export async function handleLogin(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { email, password } = body;

		if (!email || !password) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Email and password are required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for login - needs auth storage to persist new session
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);

		const { data, error } = await clientWithAuthNoUser.auth.signInWithPassword({
			email,
			password,
		});
		//logger.info('AuthHandler: handleLogin:', { data, error });
		//logger.info('AuthHandler: handleLogin:', data.session);

		if (error) {
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		// Register session in sessionRegistry if login successful
		if (data.session && data.user?.id) {
			try {
				//logger.info(`AuthHandler: handleLogin: registering session for user: ${data.user.id}`);
				await SessionRegistry.getInstance().registerSession(data.user.id);
				logger.info(`AuthHandler: Registered session in sessionRegistry for user: ${data.user.id}`);
			} catch (registryError) {
				logger.error(`AuthHandler: Failed to register session in sessionRegistry:`, registryError);
				// If sessionRegistry fails, login should fail - no valid session management
				ctx.response.status = 500;
				ctx.response.body = {
					error: {
						code: 'SESSION_REGISTRATION_ERROR',
						message: 'Failed to establish user session',
					},
				};
				return;
			}
		}

		ctx.response.status = 200;
		ctx.response.body = {
			session: data.session,
			user: data.user,
		};
	} catch (error) {
		logger.error('AuthHandler: Login error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Handle logout
 */
export async function handleLogout(ctx: Context<BbState>) {
	try {
		const userAuthSession = getUserAuthSession(ctx);

		// Remove session from sessionRegistry before clearing
		try {
			const session = await userAuthSession.getSession();
			if (session?.user?.id) {
				await SessionRegistry.getInstance().removeSession(session.user.id);
				logger.info(`AuthHandler: Removed session from sessionRegistry for user: ${session.user.id}`);
			}
		} catch (registryError) {
			logger.warn(`AuthHandler: Error removing session from sessionRegistry (continuing):`, registryError);
			// Continue with logout even if registry removal fails
		}

		await userAuthSession.clearSession();

		ctx.response.status = 200;
		ctx.response.body = {
			success: true,
		};
	} catch (error) {
		logger.error('AuthHandler: Logout error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Get current session status
 */
export async function handleStatus(ctx: Context<BbState>) {
	try {
		const userAuthSession = getUserAuthSession(ctx);
		const session = await userAuthSession.getSession();
		//logger.error('AuthHandler: handleStatus:', { session });

		ctx.response.status = 200;
		ctx.response.body = {
			authenticated: !!session,
			session,
		};
	} catch (error) {
		logger.error('AuthHandler: Status check error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Handle OAuth callback
 */
export async function handleSignup(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { email, password, options } = body;
		const userData = options?.data || {};

		if (!email || !password) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Email and password are required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for signup - needs auth storage for potential session persistence
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);
		// Still need userAuthSession for verifyUrl
		const userAuthSession = getUserAuthSession(ctx);
		const verifyUrl = userAuthSession.getVerifyUrl();

		logger.info(`AuthHandler: Signup attempt for email: ${email}`);

		const { data, error } = await clientWithAuthNoUser.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: verifyUrl,
				data: userData,
			},
		});
		//logger.error('AuthHandler: handleSignup:', { data, error });

		if (error) {
			logger.error(`AuthHandler: Signup failed for ${email}:`, error);
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		logger.info(`AuthHandler: Signup successful for ${email}, verification email sent`);
		ctx.response.status = 200;
		ctx.response.body = {
			user: data.user,
		};
	} catch (error) {
		logger.error('AuthHandler: Signup error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

export async function handleCallback(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { token_hash, type }: { token_hash: string; type: EmailOtpType } = body;

		if (!token_hash || !type) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'token_hash and type are required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for callback verification - needs auth storage to persist verified session
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);

		//logger.info('AuthHandler: Verifying token hash', { token_hash, type });
		const verifyParams: VerifyTokenHashParams = { token_hash, type };
		const { data, error } = await clientWithAuthNoUser.auth.verifyOtp(verifyParams);
		//logger.error('AuthHandler: handleCallback:', { data, error });

		// 		// Get code from query params
		// 		const url = new URL(ctx.request.url);
		// 		const code = url.searchParams.get('code');
		// 		logger.info(`AuthHandler: Verify email: ${code}`);
		//
		// 		if (!code) {
		// 			ctx.response.status = 400;
		// 			ctx.response.body = {
		// 				error: {
		// 					code: 'INVALID_REQUEST',
		// 					message: 'Authorization code is required',
		// 				},
		// 			};
		// 			return;
		// 		}
		//
		// 		// Exchange code for session
		// 		logger.info('AuthHandler: Exchanging code for session');
		// 		const { data, error } = await client.auth.exchangeCodeForSession(code);
		// 		logger.error('AuthHandler: handleCallback:', { data, error });

		if (error) {
			//logger.debug('AuthHandler: Verify token failed:', error);
			logger.error('AuthHandler: Verify token failed');
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		logger.info('AuthHandler: Verify token successful, session established');

		// Register session in sessionRegistry if verification successful
		if (data.session && data.user?.id) {
			try {
				await SessionRegistry.getInstance().registerSession(data.user.id);
				logger.info(`AuthHandler: Registered session in sessionRegistry for user: ${data.user.id}`);
			} catch (registryError) {
				logger.error(`AuthHandler: Failed to register session in sessionRegistry:`, registryError);
				// If sessionRegistry fails, verification should fail - no valid session management
				ctx.response.status = 500;
				ctx.response.body = {
					error: {
						code: 'SESSION_REGISTRATION_ERROR',
						message: 'Failed to establish user session',
					},
				};
				return;
			}
		}

		ctx.response.status = 200;
		ctx.response.body = {
			user: data.user,
			session: data.session,
		};
	} catch (error) {
		logger.error('AuthHandler: Verify token error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Check if an email is verified using Supabase edge function
 */
export async function handleCheckEmailVerification(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { email } = body;

		if (!email) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Email is required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for email verification check - needs auth storage for function calls
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);

		logger.info(`AuthHandler: Checking email verification status for: ${email}`);

		// Call Supabase Edge Function to check email verification status
		const { data, error } = await clientWithAuthNoUser.functions.invoke('check-email-verification', {
			body: { email },
		});

		if (error) {
			logger.error('AuthHandler: Check email verification failed:', error);
			ctx.response.status = 500;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: 'failed_verification',
				},
			};
			return;
		}

		//logger.info(`AuthHandler: Email verification check for ${email}:`, data);
		ctx.response.status = 200;
		ctx.response.body = data;
	} catch (error) {
		logger.error('AuthHandler: Check email verification error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: 'Internal server error',
		};
	}
}

/**
 * Handle password reset request
 */
export async function handleResetPassword(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { email, options } = body;

		if (!email) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Email is required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for password reset - needs auth storage for reset process
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);
		// Still need userAuthSession for verifyUrl
		const userAuthSession = getUserAuthSession(ctx);

		logger.info(`AuthHandler: Password reset request for email: ${email}`);

		const { error } = await clientWithAuthNoUser.auth.resetPasswordForEmail(email, {
			redirectTo: options?.redirectTo ||
				`${userAuthSession.getVerifyUrl()}?type=recovery&next=/auth/update-password`,
		});

		if (error) {
			logger.error('AuthHandler: Password reset request failed:', error);
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		logger.info(`AuthHandler: Password reset email sent to ${email}`);
		ctx.response.status = 200;
		ctx.response.body = {
			success: true,
		};
	} catch (error) {
		logger.error('AuthHandler: Password reset request error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Handle password update
 */
export async function handleUpdatePassword(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { password } = body;

		if (!password) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Password is required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		//const userAuthSession = getUserAuthSession(ctx);

		// Use clientWithAuth for password update - requires user authentication for updateUser
		const clientWithAuthWithUser = await SupabaseClientFactory.getClient(ctx.state.userContext!);

		logger.info('AuthHandler: Password update request');

		const { data, error } = await clientWithAuthWithUser.auth.updateUser({
			password,
		});

		if (error) {
			logger.error('AuthHandler: Password update failed:', error);
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		logger.info('AuthHandler: Password updated successfully');
		ctx.response.status = 200;
		ctx.response.body = {
			user: data.user,
			success: true,
		};
	} catch (error) {
		logger.error('AuthHandler: Password update error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Resend verification email
 */
export async function handleResendVerification(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { email, type, options } = body;

		if (!email || !type) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Email and type are required',
					reason: 'required_fields_missing',
				},
			};
			return;
		}

		// Use clientWithAuth for resend verification - needs auth storage for resend process
		const clientWithAuthNoUser = await SupabaseClientFactory.getClient(null);

		logger.info(`AuthHandler: Resending verification email for: ${email}`);

		const { error } = await clientWithAuthNoUser.auth.resend({
			type: type,
			email,
			options,
		});

		if (error) {
			logger.error('AuthHandler: Resend verification email failed:', error);
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'AUTH_ERROR',
					message: error.message,
					reason: error.code,
				},
			};
			return;
		}

		logger.info(`AuthHandler: Verification email resent to ${email}`);
		ctx.response.status = 200;
		ctx.response.body = {
			success: true,
		};
	} catch (error) {
		logger.error('AuthHandler: Resend verification email error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: 'Internal server error',
		};
	}
}
