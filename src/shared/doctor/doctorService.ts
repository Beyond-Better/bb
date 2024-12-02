import { DiagnosticResult, DoctorReport, SystemResources } from './types.ts';
import { checkConfig } from './checks/config.ts';
import { checkTls } from './checks/tls.ts';
import { generateReport } from './utils/report.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

/**
 * Options for running diagnostics
 */
export interface DiagnosticOptions {
	includeTls?: boolean;
	includeApi?: boolean;
}

/**
 * Service class for running system diagnostics and generating reports
 * Coordinates various health checks and aggregates results
 */
export class DoctorService {
	private results: DiagnosticResult[] = [];
	private configManager!: ConfigManager;

	constructor() {
		// ConfigManager instance will be initialized in init()
	}

	/**
	 * Initializes the service by setting up required dependencies
	 * @throws Error if initialization fails
	 */
	async init(): Promise<void> {
		try {
			this.configManager = await ConfigManager.getInstance();
		} catch (error) {
			logger.error('Failed to initialize DoctorService:', error);
			throw new Error('Failed to initialize DoctorService: ' + (error as Error).message);
		}
	}

	/**
	 * Runs all configured diagnostic checks
	 * @param options Configuration for which checks to run
	 * @returns Array of diagnostic results
	 * @throws Error if diagnostics fail to run
	 */
	async runDiagnostics(options: DiagnosticOptions = {}): Promise<DiagnosticResult[]> {
		if (!this.configManager) {
			await this.init();
		}

		this.results = [];

		try {
			// Always run config and resource checks
			await this.checkConfiguration();
			await this.checkResourceUsage();

			// Optional checks based on context
			if (options.includeTls) {
				await this.checkTlsStatus();
			}
			if (options.includeApi) {
				await this.checkApiHealth();
			}

			return this.results;
		} catch (error) {
			logger.error('Error running diagnostics:', error);
			this.results.push({
				category: 'config',
				status: 'error',
				message: 'Failed to complete diagnostics',
				details: (error as Error).message,
			});
			return this.results;
		}
	}

	/**
	 * Generates a comprehensive diagnostic report
	 * @param includeApiLogs Whether to include API logs in the report
	 * @returns Complete diagnostic report
	 * @throws Error if report generation fails
	 */
	async generateReport(includeApiLogs = false): Promise<DoctorReport> {
		if (!this.configManager) {
			await this.init();
		}

		try {
			// Run all diagnostics first
			await this.runDiagnostics({
				includeTls: true,
				includeApi: true,
			});

			// Generate report using utility
			return await generateReport(this.results, {
				includeApiLogs,
				sanitize: true,
			});
		} catch (error) {
			logger.error('Failed to generate report:', error);
			throw new Error('Failed to generate diagnostic report: ' + (error as Error).message);
		}
	}

	private async checkConfiguration(): Promise<void> {
		try {
			const results = await checkConfig();
			this.results.push(...results);
		} catch (error) {
			logger.error('Error in configuration check:', error);
			this.results.push({
				category: 'config',
				status: 'error',
				message: 'Configuration check failed',
				details: (error as Error).message,
			});
		}
	}

	private async checkTlsStatus(): Promise<void> {
		try {
			const results = await checkTls();
			this.results.push(...results);
		} catch (error) {
			logger.error('Error in TLS check:', error);
			this.results.push({
				category: 'tls',
				status: 'error',
				message: 'TLS check failed',
				details: (error as Error).message,
			});
		}
	}

	/**
	 * Checks API health by verifying connectivity and response times
	 * @private
	 */
	private async checkApiHealth(): Promise<void> {
		// Will be implemented in separate api.ts
		logger.debug('API health check not yet implemented');
	}

	/**
	 * Checks resource usage including disk space and conversation sizes
	 * @private
	 */
	private async checkResourceUsage(): Promise<void> {
		// Will be implemented in separate resources.ts
		logger.debug('Resource usage check not yet implemented');
	}
}
