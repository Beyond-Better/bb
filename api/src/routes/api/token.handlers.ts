import type { Context } from '@oak/oak';

export const getTokenUsage = async (ctx: Context) => {
	// Get current token usage
	ctx.response.body = { message: 'Current token usage' };
};
