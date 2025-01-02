import { Status } from '@oak/oak';
import type { Context, State, Next } from '@oak/oak';
import type { Middleware } from '@oak/oak';
import { isAPIError } from 'api/errors/error.ts';
import type { APIError } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
//import type { BbState } from "../types/app.types.ts";

/**
 * Error Handler Middleware function
 * @param ctx
 * @param next
 * @returns Promise<void>
 */

export const errorHandler: Middleware = async (
	//ctx: Context<BbState>,
	ctx: Context<State, Record<string, unknown>>,
	next: Next
): Promise<void> => {
	try {
		await next();
	} catch (err) {
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();
		if (isAPIError(err)) {
			const error: APIError = err;
			const message: string = error.message || 'An error occurred';
			const status: Status = error.status ?? Status.InternalServerError;

			const responseBody: { message: string; name?: string; path?: string; args?: object; status?: Status } = {
				message: '',
			};

			if (globalConfig.api?.environment === 'production') { // || globalConfig.api?.environment === 'docker'
				responseBody.message = message;
			} else {
				const name: string = error.name || 'Error';
				const path: string = error.options?.path || 'Unknown path';
				const args: object = error.options?.args || error.options || {};

				if (
					globalConfig.api?.environment === 'local' || globalConfig.api?.environment === 'localdev'
				) {
					logger.error(error.message, args);
				}

				responseBody.message = message;
				responseBody.name = name;
				responseBody.path = path;
				responseBody.args = args;
				responseBody.status = status;
			}

			ctx.response.status = status;
			ctx.response.body = responseBody;
		} else {
			/**
			 * considering all non-API errors as internal server error,
			 * do not want to share internal server errors to
			 * end user in non "development" mode
			 */
			const message = globalConfig.api?.environment === 'local' ||
					globalConfig.api?.environment === 'localdev'
				? ((err as Error).message ?? 'Unknown error occurred')
				: 'Internal Server Error';

			ctx.response.status = Status.InternalServerError;
			ctx.response.body = { message };
		}
	}
};
