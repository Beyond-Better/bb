import type { Context } from '@oak/oak';

export const runCliCommand = async (ctx: Context) => {
	// Run arbitrary CLI command
	ctx.response.body = { message: 'CLI command executed' };
};
