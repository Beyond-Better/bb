export class MockMCPManager {
	private responses = new Map<string, any>();
	private errors = new Map<string, Error>();

	setToolResponse(serverId: string, toolName: string, response: any) {
		this.responses.set(`${serverId}:${toolName}`, response);
	}

	setToolError(serverId: string, toolName: string, error: Error) {
		this.errors.set(`${serverId}:${toolName}`, error);
	}

	async executeMCPTool(
		serverId: string,
		toolName: string,
		_args: any,
	): Promise<{ content: any; toolResponse?: string }> {
		const key = `${serverId}:${toolName}`;

		if (this.errors.has(key)) {
			throw this.errors.get(key);
		}

		if (this.responses.has(key)) {
			const response = this.responses.get(key);
			// If response already has the new structure, return it as is
			if (response && typeof response === 'object' && 'content' in response) {
				return response;
			}
			// Otherwise, wrap in new structure for backward compatibility
			return { content: response };
		}

		throw new Error(`No mock response configured for ${key}`);
	}

	async listTools(_serverId: string): Promise<Array<{ name: string; description: string; inputSchema: any }>> {
		return [
			{
				name: 'weather',
				description: 'Get weather information for a location',
				inputSchema: {
					type: 'object',
					properties: {
						location: {
							type: 'string',
							description: 'The location to get weather for',
						},
					},
					required: ['location'],
				},
			},
		];
	}
}
