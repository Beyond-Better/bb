import { DiagnosticResult, DoctorReport } from '../types.ts';
import { logger } from 'shared/logger.ts';

interface ReportOptions {
	includeApiLogs?: boolean;
	sanitize?: boolean;
}

/**
 * Sanitizes sensitive information from configuration data
 * @param data Object to sanitize
 * @returns Sanitized copy of the object
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	if (typeof data !== 'object' || data === null) {
		return data;
	}
	const sensitiveKeys = ['token', 'key', 'secret', 'password', 'credential'];

	for (const [key, value] of Object.entries(data)) {
		// Check if key contains any sensitive terms
		if (sensitiveKeys.some((term) => key.toLowerCase().includes(term))) {
			result[key] = '[REDACTED]';
		} else if (value && typeof value === 'object') {
			// Recursively sanitize nested objects
			if (value && typeof value === 'object') {
				result[key] = sanitizeData(value as Record<string, unknown>);
			} else {
				result[key] = value;
			}
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Formats diagnostic results for the report
 * @param results Array of diagnostic results
 * @returns Formatted results with counts
 */
function formatDiagnostics(results: DiagnosticResult[]): {
	results: DiagnosticResult[];
	summary: {
		total: number;
		errors: number;
		warnings: number;
		ok: number;
	};
} {
	const summary = {
		total: results.length,
		errors: results.filter((r) => r.status === 'error').length,
		warnings: results.filter((r) => r.status === 'warning').length,
		ok: results.filter((r) => r.status === 'ok').length,
	};

	return {
		results,
		summary,
	};
}

/**
 * Reads and formats API logs
 * @param maxLines Maximum number of log lines to include
 * @returns Formatted log data
 */
async function getApiLogs(maxLines = 100): Promise<{
	api: string;
	lastErrors?: string[];
}> {
	try {
		// TODO: Implement actual log reading
		// For now, return placeholder
		return {
			api: 'API logs not yet implemented',
			lastErrors: [],
		};
	} catch (error) {
		logger.error('Failed to read API logs:', error);
		return {
			api: 'Failed to read API logs: ' + (error as Error).message,
			lastErrors: [],
		};
	}
}

/**
 * Generates a diagnostic report
 * @param results Diagnostic results to include
 * @param options Report generation options
 * @returns Formatted diagnostic report
 */
export async function generateReport(
	results: DiagnosticResult[],
	options: ReportOptions = {},
): Promise<DoctorReport> {
	const { sanitize = true, includeApiLogs = false } = options;

	try {
		const report: DoctorReport = {
			timestamp: new Date().toISOString(),
			bbVersion: Deno.env.get('BB_VERSION') || 'unknown',
			systemInfo: {
				os: Deno.build.os,
				arch: Deno.build.arch,
				resources: {
					diskSpace: {
						total: 0, // Will be populated by resource check
						free: 0,
						unit: 'bytes',
					},
					conversations: {
						count: 0, // Will be populated by resource check
						totalSize: 0,
						unit: 'bytes',
					},
				},
			},
			diagnostics: results,
			conversations: [], // Will be populated by conversation check
			tools: {
				core: [], // Will be populated by tools check
			},
		};

		// Add API logs if requested
		if (includeApiLogs) {
			report.logs = await getApiLogs();
		}

		// Sanitize if requested
		if (sanitize) {
			return sanitizeData(report) as DoctorReport;
		}

		return report;
	} catch (error) {
		logger.error('Failed to generate report:', error);
		throw new Error('Failed to generate diagnostic report: ' + (error as Error).message);
	}
}

/**
 * Saves a report to a file
 * @param report Report to save
 * @param filePath Path to save the report to
 */
export async function saveReport(report: DoctorReport, filePath: string): Promise<void> {
	try {
		const json = JSON.stringify(report, null, 2);
		await Deno.writeTextFile(filePath, json);
	} catch (error) {
		logger.error('Failed to save report:', error);
		throw new Error('Failed to save diagnostic report: ' + (error as Error).message);
	}
}
