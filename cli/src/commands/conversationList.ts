import { Command } from 'cliffy/command';
import type { InteractionMetadata } from 'shared/types.ts';
import { resolve } from '@std/path';
import ApiClient from 'cli/apiClient.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
// import { createSpinner, startSpinner, stopSpinner } from '../utils/terminalHandler.utils.ts';
import { getProjectId, getWorkingRootFromStartDir } from 'shared/dataDir.ts';

export const conversationList = new Command()
	.description('List saved collaborations')
	.option('-d, --directory <dir:string>', 'The starting directory for the project', { default: Deno.cwd() })
	.option('-p, --page <page:number>', 'Page number', { default: 1 })
	.option('-l, --limit <limit:number>', 'Number of items per page', { default: 10 })
	.action(async ({ directory, page, limit }) => {
		// 		const spinner = createSpinner('Fetching saved collaborations...');
		// 		startSpinner(spinner, 'Fetching saved collaborations...');

		try {
			let projectId: string | undefined;
			try {
				const startDir = resolve(directory);
				const workingRoot = await getWorkingRootFromStartDir(startDir);
				projectId = await getProjectId(workingRoot);
				if (!projectId) throw new Error(`Could not find a project for: ${workingRoot}`);
			} catch (_error) {
				//console.error(`Could not set ProjectId: ${(error as Error).message}`);
				console.error('Not a valid project directory. Run `bb init`.');
				Deno.exit(1);
			}

			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			//const projectConfig = await configManager.getProjectConfig(projectId);
			const apiClient = await ApiClient.create(projectId);
			const response = await apiClient.listCollaborations(projectId, page, limit);
			//stopSpinner(spinner);

			if (response && response.collaborations) {
				const { collaborations, pagination } = response;
				if (collaborations.length === 0) {
					console.log('No saved collaborations found on this page.');
				} else {
					console.log('Saved collaborations:');
					console.log(
						`Page ${pagination.page} of ${pagination.totalPages} (Total items: ${pagination.totalItems})`,
					);
					collaborations.forEach(
						(collaboration: any, index: number) => {
							const createdAt = new Date(collaboration.createdAt).toLocaleString();
							const updatedAt = new Date(collaboration.updatedAt).toLocaleString();
							console.log(`${index + 1}. ID: ${collaboration.id} | Title: ${collaboration.title} | Type: ${collaboration.type}`);
							console.log(
								`   Interactions: ${collaboration.totalInteractions || 0} | Created: ${createdAt} | Updated: ${updatedAt}`,
							);
							if (collaboration.lastInteractionMetadata) {
								console.log(
									`   Last Provider: ${collaboration.lastInteractionMetadata.llmProviderName || 'N/A'} | Model: ${
										collaboration.lastInteractionMetadata.model || 'N/A'
									}`,
								);
							}
						},
					);

					// Add instructions for pagination
					console.log('\nPagination instructions:');
					if (pagination.page < pagination.totalPages) {
						console.log(
							`To view the next page, use: ${globalConfig.bbExeName} collaboration list --page ${
								pagination.page + 1
							} --limit ${limit}`,
						);
					}
					if (pagination.page > 1) {
						console.log(
							`To view the previous page, use: ${globalConfig.bbExeName} collaboration list --page ${
								pagination.page - 1
							} --limit ${limit}`,
						);
					}
					console.log(`Current items per page: ${limit}`);
					console.log(`To change the number of items per page, use the --limit option. For example:`);
					console.log(`${globalConfig.bbExeName} collaboration list --page ${pagination.page} --limit 20`);
				}
			} else {
				console.error('Failed to fetch saved collaborations');
			}
		} catch (error) {
			//stopSpinner(spinner);
			console.error('Error fetching saved collaborations:', (error as Error).message);
		}
	});
