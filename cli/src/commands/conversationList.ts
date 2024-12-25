import { Command } from 'cliffy/command';
import type { ConversationMetadata } from 'shared/types.ts';
import { resolve } from '@std/path';
import ApiClient from 'cli/apiClient.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
// import { createSpinner, startSpinner, stopSpinner } from '../utils/terminalHandler.utils.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

export const conversationList = new Command()
	.description('List saved conversations')
	.option('-d, --directory <dir:string>', 'The starting directory for the project', { default: Deno.cwd() })
	.option('-p, --page <page:number>', 'Page number', { default: 1 })
	.option('-l, --limit <limit:number>', 'Number of items per page', { default: 10 })
	.action(async ({ directory, page, limit }) => {
		// 		const spinner = createSpinner('Fetching saved conversations...');
		// 		startSpinner(spinner, 'Fetching saved conversations...');

		try {
			let projectId: string;
			try {
				const startDir = resolve(directory);
				const projectRoot = await getProjectRootFromStartDir(startDir);
				projectId = await getProjectId(projectRoot);
			} catch (_error) {
				//console.error(`Could not set ProjectId: ${(error as Error).message}`);
				console.error('Not a valid project directory. Run `bb init`.');
				Deno.exit(1);
			}

			const configManager = await ConfigManagerV2.getInstance();
			const globalConfig = await configManager.getGlobalConfig();
			//const projectConfig = await configManager.getProjectConfig(projectId);
			const apiClient = await ApiClient.create(projectId);
			const response = await apiClient.get(
				`/api/v1/conversation?projectId=${encodeURIComponent(projectId)}&page=${page}&limit=${limit}`,
			);
			//stopSpinner(spinner);

			if (response.ok) {
				const { conversations, pagination } = await response.json();
				if (conversations.length === 0) {
					console.log('No saved conversations found on this page.');
				} else {
					console.log('Saved conversations:');
					console.log(
						`Page ${pagination.page} of ${pagination.totalPages} (Total items: ${pagination.totalItems})`,
					);
					conversations.forEach(
						(conversation: ConversationMetadata, index: number) => {
							const createdAt = new Date(conversation.createdAt).toLocaleString();
							const updatedAt = new Date(conversation.updatedAt).toLocaleString();
							console.log(`${index + 1}. ID: ${conversation.id} | Title: ${conversation.title}`);
							console.log(
								`   Provider: ${conversation.llmProviderName || 'N/A'} | Model: ${
									conversation.model || 'N/A'
								} | Created: ${createdAt} | Updated: ${updatedAt}`,
							);
						},
					);

					// Add instructions for pagination
					console.log('\nPagination instructions:');
					if (pagination.page < pagination.totalPages) {
						console.log(
							`To view the next page, use: ${globalConfig.bbExeName} conversation list --page ${
								pagination.page + 1
							} --limit ${limit}`,
						);
					}
					if (pagination.page > 1) {
						console.log(
							`To view the previous page, use: ${globalConfig.bbExeName} conversation list --page ${
								pagination.page - 1
							} --limit ${limit}`,
						);
					}
					console.log(`Current items per page: ${limit}`);
					console.log(`To change the number of items per page, use the --limit option. For example:`);
					console.log(`${globalConfig.bbExeName} conversation list --page ${pagination.page} --limit 20`);
				}
			} else {
				console.error('Failed to fetch saved conversations:', response.statusText);
				const errorBody = await response.json();
				console.error('Error details:', errorBody.error);
			}
		} catch (error) {
			//stopSpinner(spinner);
			console.error('Error fetching saved conversations:', (error as Error).message);
		}
	});
