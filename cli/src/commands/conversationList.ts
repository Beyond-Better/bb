import { Command } from 'cliffy/command/mod.ts';
import type { ConversationMetadata } from 'shared/types.ts';
import { resolve } from '@std/path';
import ApiClient from 'cli/apiClient.ts';
import { ConfigManager } from 'shared/configManager.ts';
// import { createSpinner, startSpinner, stopSpinner } from '../utils/terminalHandler.utils.ts';

export const conversationList = new Command()
	.description('List saved conversations')
	.option('-d, --directory <dir:string>', 'The starting directory for the project', { default: Deno.cwd() })
	.option('-p, --page <page:number>', 'Page number', { default: 1 })
	.option('-l, --limit <limit:number>', 'Number of items per page', { default: 10 })
	.action(async ({ directory, page, limit }) => {
		// 		const spinner = createSpinner('Fetching saved conversations...');
		// 		startSpinner(spinner, 'Fetching saved conversations...');

		try {
			const startDir = resolve(directory);
			const fullConfig = await ConfigManager.fullConfig(startDir);
			const apiClient = await ApiClient.create(startDir);
			const response = await apiClient.get(
				`/api/v1/conversation?startDir=${encodeURIComponent(startDir)}&page=${page}&limit=${limit}`,
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
							`To view the next page, use: ${fullConfig.bbExeName} conversation list --page ${
								pagination.page + 1
							} --limit ${limit}`,
						);
					}
					if (pagination.page > 1) {
						console.log(
							`To view the previous page, use: ${fullConfig.bbExeName} conversation list --page ${
								pagination.page - 1
							} --limit ${limit}`,
						);
					}
					console.log(`Current items per page: ${limit}`);
					console.log(`To change the number of items per page, use the --limit option. For example:`);
					console.log(`${fullConfig.bbExeName} conversation list --page ${pagination.page} --limit 20`);
				}
			} else {
				console.error('Failed to fetch saved conversations:', response.statusText);
				const errorBody = await response.json();
				console.error('Error details:', errorBody.error);
			}
		} catch (error) {
			// 			stopSpinner(spinner);
			console.error('Error fetching saved conversations:', error.message);
		}
	});
