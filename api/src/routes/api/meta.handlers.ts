import { Context } from '@oak/oak';
import { SEPARATOR } from '@std/path';
import { logger } from 'shared/logger.ts';
import { VERSION } from 'version.ts';

/**
 * @openapi
 * /api/v1/meta:
 *   get:
 *     summary: Get system metadata
 *     description: Returns system-level information including OS type, path separator, and API version
 *     responses:
 *       200:
 *         description: System metadata
 *       500:
 *         description: Internal server error
 */
export const getMeta = async (
    { response }: { response: Context['response'] },
) => {
    try {
        logger.info('MetaHandler: getMeta called');
        
        const meta = {
            os: Deno.build.os,
            pathSeparator: SEPARATOR,
            apiVersion: VERSION,
        };

        response.status = 200;
        response.body = { meta };
    } catch (error) {
        logger.error(`MetaHandler: Error in getMeta: ${(error as Error).message}`);
        response.status = 500;
        response.body = { error: 'Failed to get system metadata', details: (error as Error).message };
    }
};