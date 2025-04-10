import { Command } from 'cliffy/command';
import { colors } from 'cliffy/ansi/colors';
import { resolve } from '@std/path';
import ApiClient from 'cli/apiClient.ts';
//import { ensureApiReady } from '../utils/api.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

// Debug commands for the CLI
export const debug = new Command()
	.description('Debug commands for the BB API')
	.action(() => {
		debug.showHelp();
	})
	.command(
		'instances',
		new Command()
			.description('Show a list of all instantiated objects in the API')
			.option('-r, --directory <dir:string>', 'The starting directory for the project', { default: Deno.cwd() })
			.option('-d, --detailed', 'Show detailed information about each instance')
			.option('-f, --format <format:string>', 'Output format (json or text)', {
				default: 'text',
			})
			.option('-l, --log', 'Write findings to log file (bb-instances.log)')
			.option('-o, --output <file:string>', 'Write output to specified file')
			.option('-p, --orphaned', 'Focus on orphaned interactions that are not attached to active editors')
			.action(async (options) => {
				//await ensureApiReady();

				try {
					// Get project ID from the current directory
					let projectId: string;
					try {
						const startDir = resolve(options.directory);
						const projectRoot = await getProjectRootFromStartDir(startDir);
						projectId = await getProjectId(projectRoot);
					} catch (_error) {
						console.error('Not a valid project directory. Run `bb init`.');
						Deno.exit(1);
					}

					// Create API client using the same pattern as conversationList.ts
					const apiClient = await ApiClient.create(projectId);

					// Prepare query parameters
					const params = new URLSearchParams();
					if (options.detailed || options.orphaned) params.set('detailed', 'true'); // Always get detailed if orphaned is requested
					params.set('format', options.format);
					if (options.log) params.set('log', 'true');

					const endpoint = `/api/v1/debug/instances?${params.toString()}`;
					console.log(colors.yellow(`Querying API instances...`));

					// Make the API call using the ApiClient
					const response = await apiClient.get(endpoint);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					let responseData;
					if (options.format === 'json') {
						responseData = await response.json();
						// Pretty print the JSON response
						const formattedJson = JSON.stringify(responseData, null, 2);
						console.log(formattedJson);

						// Write to output file if specified
						if (options.output) {
							await Deno.writeTextFile(options.output, formattedJson);
							console.log(colors.green(`Output written to ${options.output}`));
						}

						// Print a summary of the findings
						const overview = responseData.overview;
						console.log(colors.green(
							`Found ${overview.projectEditorCount} active ProjectEditors and ${
								overview.interactions?.totalCount || 0
							} interactions`,
						));

						// Process orphaned data if requested
						if (options.orphaned) {
							console.log(colors.cyan(`\n===== ORPHANED INTERACTIONS =====`));
							if (!overview.interactions || overview.interactions.totalCount === 0) {
								console.log('No interactions found');
							} else if (overview.interactions.orphanedCount === 0) {
								console.log('No orphaned interactions found');
							} else {
								console.log(
									colors.yellow(
										`Found ${overview.interactions.orphanedCount} orphaned interactions!`,
									),
								);

								const orphanedIds = overview.interactions.hierarchy.roots.filter(
									(rootId: string) => !Object.keys(overview.editors).includes(rootId),
								);

								for (const orphanedId of orphanedIds) {
									const orphaned = overview.interactions.items[orphanedId];
									console.log(
										colors.yellow(
											`Orphaned[${orphaned.id}]: ${orphaned.type} - ${
												orphaned.title || 'Untitled'
											}`,
										),
									);
									console.log(`  Model: ${orphaned.model || 'Unknown'}`);
									console.log(`  Statement Count: ${orphaned.statementCount}`);
									if (orphaned.childrenCount > 0) {
										console.log(`  Child Interactions: ${orphaned.childrenCount}`);
									}
								}
							}
						}
					} else {
						// Text format
						responseData = await response.text();
						console.log(responseData);

						// Write to output file if specified
						if (options.output) {
							await Deno.writeTextFile(options.output, responseData);
							console.log(colors.green(`Output written to ${options.output}`));
						}
					}

					// Note if logging was enabled
					if (options.log) {
						console.log(colors.green('Instance overview also written to bb-instances.log'));
					}
				} catch (error) {
					console.error(
						colors.red(
							`Failed to get instance information: ${
								error instanceof Error ? error.message : String(error)
							}`,
						),
					);
					Deno.exit(1);
				}
			}),
	);
