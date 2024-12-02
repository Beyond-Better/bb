import type { Context, RouterContext } from '@oak/oak';
import { DoctorService } from 'shared/doctor/doctorService.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManager } from 'shared/configManager.ts';

/**
 * Run diagnostic checks and return results
 */
export async function checkHandler(ctx: Context) {
	try {
		const service = new DoctorService();
		await service.init();

		const results = await service.runDiagnostics({
			includeTls: true,
			includeApi: true,
		});

		// Calculate summary
		const summary = {
			total: results.length,
			errors: results.filter((r) => r.status === 'error').length,
			warnings: results.filter((r) => r.status === 'warning').length,
			ok: results.filter((r) => r.status === 'ok').length,
		};

		ctx.response.body = { results, summary };
	} catch (error) {
		logger.error('Doctor check failed:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: 'Failed to run diagnostic checks',
			details: (error as Error).message,
		};
	}
}

/**
 * Generate and return a diagnostic report
 */
export async function reportHandler(ctx: Context) {
	try {
		const service = new DoctorService();
		await service.init();

		const report = await service.generateReport(true);

		ctx.response.headers.set('Content-Type', 'application/json');
		ctx.response.headers.set(
			'Content-Disposition',
			`attachment; filename=bb-diagnostic-report-${new Date().toISOString()}.json`,
		);
		ctx.response.body = report;
	} catch (error) {
		logger.error('Doctor report generation failed:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: 'Failed to generate diagnostic report',
			details: (error as Error).message,
		};
	}
}

/**
 * Apply a specific fix
 * The fix type is determined by the URL path
 */

export async function applyFixHandler(
	{ params, request: _request, response }: RouterContext<'/v1/doctor/fix/:type', { type: string }>,
) {
	const { type: fixType } = params;
	//const { startDir } = await request.body.json();

	const configManager = await ConfigManager.getInstance();
	try {
		switch (fixType) {
			case 'api-port': {
				// Example fix implementation
				//const fullConfig = await ConfigManager.fullConfig(startDir);
				await configManager.setGlobalConfigValue('api.apiPort', '3000');
				response.body = { message: 'API port reset to default' };
				break;
			}
			case 'api-hostname': {
				await configManager.setGlobalConfigValue('api.apiHostname', 'localhost');
				response.body = { message: 'API hostname reset to default' };
				break;
			}
			case 'enable-tls': {
				// This would need to be implemented in the secure command
				response.status = 501;
				response.body = {
					error: 'TLS configuration changes require CLI command',
					details: 'Please run: bb secure on',
				};
				break;
			}
			default: {
				response.status = 400;
				response.body = {
					error: 'Unknown fix type',
					details: `Fix type '${fixType}' is not supported`,
				};
			}
		}
	} catch (error) {
		logger.error(`Doctor fix '${fixType}' failed:`, error);
		response.status = 500;
		response.body = {
			error: 'Failed to apply fix',
			details: (error as Error).message,
		};
	}
}
