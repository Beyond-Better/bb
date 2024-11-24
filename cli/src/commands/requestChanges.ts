import { Command } from 'cliffy/command/mod.ts';
import ApiClient from 'cli/apiClient.ts';

export const requestChanges = new Command()
	.name('request')
	.description('Request changes from the LLM')
	.option('-p, --prompt <string>', 'Prompt for requesting changes')
	.option('-i, --id <string>', 'Conversation ID')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		try {
			const startDir = Deno.cwd();
			const apiClient = await ApiClient.create(startDir);
			const response = await apiClient.post('/api/v1/request-changes', {
				prompt: options.prompt,
				conversationId: options.id,
			});

			if (response.ok) {
				const data = await response.json();
				if (options.text) {
					console.log(data.changes);
				} else {
					console.log(JSON.stringify(data, null, 2));
				}
			} else {
				const errorBody = await response.text();
				console.error(JSON.stringify(
					{
						error: 'Failed to request changes',
						status: response.status,
						body: errorBody,
					},
					null,
					2,
				));
			}
		} catch (error) {
			console.error(JSON.stringify(
				{
					error: 'Error requesting changes',
					message: (error as Error).message,
				},
				null,
				2,
			));
		}
	});
