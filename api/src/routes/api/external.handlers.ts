import type { Context } from '@oak/oak';

export const loadExternalContent = async (ctx: Context) => {
	// Load content from external web site
	ctx.response.body = { message: 'External content loaded' };
};
