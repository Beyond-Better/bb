#!/usr/bin/env -S deno run --allow-all

/**
 * A debugging utility script for logging all instances in the API.
 * This script calls the API endpoint to get real instance data from the running server.
 *
 * Usage:
 *   deno task tool:debug-instances [--detailed] [--json] [--log] [--output file]
 *
 * Options:
 *   --detailed    Show full detailed output of each instance
 *   --json        Output as JSON instead of formatted text
 *   --log         Also write output to bb-instances.log
 *   --orphaned    Focus on orphaned interactions
 *   --output      Write output to the specified file
 */

import { parseArgs } from '@std/cli';
import { logger } from 'shared/logger.ts';

// Function to fetch data from API
async function fetchInstancesFromApi(options: {
	detailed?: boolean;
	format?: string;
	log?: boolean;
}) {
	try {
		// Get API hostname and port from environment or use defaults
		const hostname = Deno.env.get('BB_API_HOSTNAME') || 'localhost';
		const port = Deno.env.get('BB_API_PORT') || '3162';
		const protocol = Deno.env.get('BB_API_PROTOCOL') || 'https';

		// Build query parameters
		const params = new URLSearchParams();
		if (options.detailed) params.set('detailed', 'true');
		if (options.log) params.set('log', 'true');
		params.set('format', options.format || 'json');

		const url = `${protocol}://${hostname}:${port}/api/v1/debug/instances?${params.toString()}`;
		logger.info(`Fetching instance data from API: ${url}`);

		// Make API request with TLS verification disabled for local development
		const response = await fetch(url, {
			headers: {
				'Accept': options.format === 'text' ? 'text/plain' : 'application/json',
			},
			// Skip TLS verification for local development
			// @ts-ignore - Deno specific fetch options
			cert: Deno.env.get('BB_API_CERT_PATH'),
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		if (options.format === 'text') {
			return await response.text();
		} else {
			return await response.json();
		}
	} catch (error) {
		logger.error(`Failed to fetch instance data: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}

async function main() {
	const args = parseArgs(Deno.args, {
		boolean: ['detailed', 'json', 'log', 'orphaned'],
		string: ['output'],
		default: { detailed: false, json: false, log: false, orphaned: false, output: '' },
	});

	logger.info('Debugging API Instances...');

	try {
		// Fetch the overview from API
		const format = args.json ? 'json' : 'text';
		const data = await fetchInstancesFromApi({
			detailed: args.detailed || args.orphaned, // Always get detailed if orphaned is requested
			format,
			log: args.log,
		});

		// Display the result
		console.log(format === 'json' ? JSON.stringify(data, null, 2) : data);

		// Output to specified file if requested
		if (args.output) {
			try {
				const content = format === 'json' ? JSON.stringify(data, null, 2) : data;
				await Deno.writeTextFile(args.output, content);
				logger.info(`Instance overview written to ${args.output}`);
			} catch (err) {
				logger.error(`Failed to write to ${args.output}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		// Process orphaned data if requested and we got JSON data
		if (args.orphaned && format === 'json') {
			const overview = data.overview;
			logger.info('\n===== ORPHANED INTERACTIONS =====');
			if (!overview.interactions || overview.interactions.totalCount === 0) {
				logger.info('No interactions found');
			} else if (overview.interactions.orphanedCount === 0) {
				logger.info('No orphaned interactions found');
			} else {
				logger.warn(`Found ${overview.interactions.orphanedCount} orphaned interactions!`);

				const orphanedIds = overview.interactions.hierarchy.roots.filter(
					(rootId: string) => !Object.keys(overview.editors).includes(rootId),
				);

				for (const orphanedId of orphanedIds) {
					const orphaned = overview.interactions.items[orphanedId];
					logger.info(`Orphaned[${orphaned.id}]: ${orphaned.type} - ${orphaned.title || 'Untitled'}`);
					logger.info(`  Model: ${orphaned.model || 'Unknown'}`);
					logger.info(`  Statement Count: ${orphaned.statementCount}`);
					if (orphaned.childrenCount > 0) {
						logger.info(`  Child Interactions: ${orphaned.childrenCount}`);
					}
				}
			}
		}

		// Log results summary if we have JSON data
		if (format === 'json') {
			const overview = data.overview;
			logger.info(
				`Found ${overview.projectEditorCount} active ProjectEditors and ${
					overview.interactions?.totalCount || 0
				} interactions`,
			);
		}
	} catch (error) {
		logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		Deno.exit(1);
	}

	logger.info('Debug complete.');
}

if (import.meta.main) {
	await main();
}
