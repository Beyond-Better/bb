import type { Context } from '@oak/oak';
import type { SessionManager } from '../../auth/session.ts';
import { logger } from 'shared/logger.ts';
import type { BbState } from '../../types/app.types.ts';
//import type { AuthError } from "../../types/auth.ts";
import type { EmailOtpType, VerifyTokenHashParams } from '@supabase/supabase-js';

/**
 * Get the session manager from app state
 */
function getSessionManager(ctx: Context<BbState>): SessionManager {
	return ctx.app.state.auth.sessionManager;
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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		const { data, error } = await client.auth.signInWithPassword({
			email,
			password,
		});
		logger.error('AuthHandler: handleLogin:', { data, error });

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
		const manager = getSessionManager(ctx);
		await manager.clearSession();

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
		const manager = getSessionManager(ctx);
		const session = await manager.getSession();
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

		// Get verifyUrl from session manager
		const manager = getSessionManager(ctx);
		const client = manager.getClient();
		const verifyUrl = manager.getVerifyUrl();

		logger.info(`AuthHandler: Signup attempt for email: ${email}`);

		const { data, error } = await client.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: verifyUrl,
				data: userData,
			},
		});
		logger.error('AuthHandler: handleSignup:', { data, error });

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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		//logger.info('AuthHandler: Verifying token hash', { token_hash, type });
		const verifyParams: VerifyTokenHashParams = { token_hash, type };
		const { data, error } = await client.auth.verifyOtp(verifyParams);
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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		logger.info(`AuthHandler: Checking email verification status for: ${email}`);

		// Call Supabase Edge Function to check email verification status
		const { data, error } = await client.functions.invoke('check-email-verification', {
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

		logger.info(`AuthHandler: Email verification check for ${email}:`, data);
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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		logger.info(`AuthHandler: Password reset request for email: ${email}`);

		const { error } = await client.auth.resetPasswordForEmail(email, {
			redirectTo: options?.redirectTo || `${manager.getVerifyUrl()}?type=recovery&next=/auth/update-password`,
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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		logger.info('AuthHandler: Password update request');

		const { data, error } = await client.auth.updateUser({
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

		const manager = getSessionManager(ctx);
		const client = manager.getClient();

		logger.info(`AuthHandler: Resending verification email for: ${email}`);

		const { error } = await client.auth.resend({
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
