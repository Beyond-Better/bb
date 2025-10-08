import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import type { ModelRegistryService, ModelSelectionPreferences } from 'api/llms/modelRegistryService.ts';
//import type { GlobalConfig } from 'shared/config/types.ts';
import { SessionRegistry } from 'api/auth/sessionRegistry.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';

import type {
	McpServerInfo,
	SamplingCreateMessageParams,
	SamplingCreateMessageResult,
	SamplingMessage,
	SamplingModelPreferences,
} from 'api/types/mcp.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
//import type { CreateMessageResultSchema } from 'mcp/types.js';

/**
 * Internal result format for sampling responses
 */
interface SamplingResult {
	text: string;
	stopReason: 'endTurn' | 'stopSequence' | 'maxTokens' | 'error';
}

/**
 * Service for handling MCP server requests including sampling, notifications, and elicitation
 * Extracted from MCPManager to improve modularity and testability
 */
export class MCPRequestHandlerService {
	private modelRegistryService: ModelRegistryService;

	constructor(
		private servers: Map<string, McpServerInfo>,
		//private globalConfig: GlobalConfig,
		modelRegistryService: ModelRegistryService,
	) {
		this.modelRegistryService = modelRegistryService;
		logger.debug('MCPRequestHandlerService: ModelRegistryService injected for sampling requests');
	}

	// ============================================================================
	// SAMPLING REQUEST HANDLING
	// ============================================================================

	/**
	 * Handle MCP sampling requests from servers
	 */
	async handleSamplingRequest(
		serverId: string,
		params: SamplingCreateMessageParams,
		meta: Record<string, unknown>,
	): Promise<SamplingCreateMessageResult> {
		try {
			logger.info(`MCPRequestHandlerService: Received sampling request from server ${serverId}`, {
				messageCount: params.messages.length,
				hasSystemPrompt: !!params.systemPrompt,
				maxTokens: params.maxTokens,
				model: params.model,
				meta,
			});

			// 1. Human-in-the-loop approval (required by spec)
			const approved = await this.requestUserApproval(serverId, params);
			if (!approved) {
				throw {
					code: -1,
					message: 'User rejected sampling request',
				};
			}

			// 2. Map model preferences to BB's available models
			const modelPreferences: SamplingModelPreferences = { hints: [{ name: String(params.model) }] };
			const selectedModel = this.selectModelForSampling(modelPreferences);

			// 3. Forward to BB's LLM system (placeholder for now)
			const response = await this.forwardSamplingToLLM({
				messages: params.messages,
				systemPrompt: params.systemPrompt,
				maxTokens: params.maxTokens,
				model: selectedModel,
			}, meta);

			// 4. Optional: Let user review response before sending
			const finalResponse = await this.reviewSamplingResponse(serverId, response);

			return {
				role: 'assistant',
				content: {
					type: 'text',
					text: finalResponse.text,
				},
				model: selectedModel,
				stopReason: response.stopReason || 'endTurn',
			};
		} catch (error) {
			logger.error(`MCPRequestHandlerService: Sampling request failed for server ${serverId}:`, error);
			// Return proper JSON-RPC error
			if (typeof error === 'object' && error !== null && 'code' in error) {
				throw error; // Already formatted error
			}
			throw {
				code: -32603,
				message: `Sampling request failed: ${errorMessage(error)}`,
			};
		}
	}

	// ============================================================================
	// NOTIFICATION HANDLING (Future Implementation)
	// ============================================================================

	/**
	 * Handle MCP notification requests from servers
	 * TODO: Implement when MCP notification spec is finalized
	 */
	// deno-lint-ignore require-await
	async handleNotificationRequest(
		serverId: string,
		notificationData: Record<string, unknown>,
		meta: Record<string, unknown>,
	): Promise<void> {
		logger.info(`MCPRequestHandlerService: Received notification from server ${serverId}`, {
			notificationData,
			note: 'Notification handling not yet implemented',
			meta,
		});

		// TODO: Implement notification handling logic
		// This might include:
		// - User notification display
		// - System event logging
		// - Integration with BB's UI system
		// - Filtering and routing based on notification type
	}

	// ============================================================================
	// ELICITATION HANDLING (Future Implementation)
	// ============================================================================

	/**
	 * Handle MCP elicitation requests from servers
	 * TODO: Implement when MCP elicitation spec is finalized
	 */
	// deno-lint-ignore require-await
	async handleElicitationRequest(
		serverId: string,
		elicitationData: Record<string, unknown>,
		meta: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		logger.info(`MCPRequestHandlerService: Received elicitation from server ${serverId}`, {
			elicitationData,
			note: 'Elicitation handling not yet implemented',
			meta,
		});

		// TODO: Implement elicitation handling logic
		// This might include:
		// - User input collection
		// - Form rendering and validation
		// - Integration with BB's UI system
		// - Response formatting and validation

		// Placeholder response
		return {
			status: 'not_implemented',
			message: 'Elicitation handling not yet implemented',
		};
	}

	/**
	 * Request user approval for sampling request (placeholder implementation)
	 */
	// deno-lint-ignore require-await
	private async requestUserApproval(
		serverId: string,
		params: SamplingCreateMessageParams,
	): Promise<boolean> {
		// TODO: Implement actual user approval system
		// This could integrate with BB's future user interface system
		// For now, we'll auto-approve with logging

		const serverInfo = this.servers.get(serverId);
		const serverName = serverInfo?.config.name || serverId;

		logger.warn(
			`MCPRequestHandlerService: Auto-approving sampling request from ${serverName} (placeholder implementation)`,
			{
				serverId,
				serverName,
				messageCount: params.messages.length,
				systemPrompt: !!params.systemPrompt,
				maxTokens: params.maxTokens,
				modelHints: params.modelPreferences?.hints?.map((h: { name: string }) => h.name),
				note: 'This should be replaced with actual user approval UI',
			},
		);

		// Auto-approve for now - this should be replaced with actual user interaction
		return true;
	}

	/**
	 * Forward sampling request to BB's LLM system
	 */
	private async forwardSamplingToLLM(
		request: {
			messages: SamplingMessage[];
			systemPrompt?: string;
			maxTokens?: number;
			model: string;
		},
		meta: Record<string, unknown>,
	): Promise<SamplingResult> {
		logger.info('MCPRequestHandlerService: Forwarding sampling request to BB LLM system', {
			model: request.model,
			messageCount: request.messages.length,
			hasSystemPrompt: !!request.systemPrompt,
			maxTokens: request.maxTokens,
			meta,
		});

		// Validate required metadata fields
		const projectId = meta.projectId as string;
		let collaborationId = meta.collaborationId as string;
		const userId = meta.userId as string;
		const serverName = (meta.serverName as string) || 'unknown';
		const serverId = (meta.serverId as string) || 'unknown';

		if (!projectId || !collaborationId || !userId) {
			logger.warn('MCPRequestHandlerService: No project ID or collaboration ID passed in _meta', { meta });
			// return { text: `[ERROR] Provided metadata didn't include a valid project ID or collaboration ID. Does the MCP server return the '_meta' sent in original request?`, stopReason: 'endTurn' };
		}

		const userContext = userId ? SessionRegistry.getInstance().getUserContext(userId) : null;
		if (userId && !userContext) {
			logger.warn(`MCPRequestHandlerService: No userContext found for ${userId} from session registry`);
			// return { text: `[ERROR] Provided metadata didn't include a valid user ID. Does the MCP server return the '_meta' sent in original request?`, stopReason: 'endTurn' };
		}

		let projectEditor: ProjectEditor | null = null;
		try {
			// Get project editor
			if (userContext && projectId && collaborationId) {
				projectEditor = await projectEditorManager.getOrCreateEditor(
					projectId,
					collaborationId,
					userContext,
				);
			} else {
				const projectEditorWithCollaborationId = projectEditorManager
					.getCurrentEditorWithCollaborationId();
				if (projectEditorWithCollaborationId) {
					projectEditor = projectEditorWithCollaborationId.projectEditor;
					collaborationId = projectEditorWithCollaborationId.collaborationId;
				}
			}

			if (!projectEditor) {
				logger.error('MCPRequestHandlerService: Failed to get projectEditor:');
				return {
					text: `[ERROR] Failed to get project editor}`,
					stopReason: 'error',
				};
			}
		} catch (error) {
			logger.error('MCPRequestHandlerService: Error in forwardSamplingToLLM:', error);
			return {
				text: `[ERROR] Failed to process sampling request: ${errorMessage(error)}`,
				stopReason: 'error',
			};
		}

		try {
			// Prepare statement parameters with model configuration
			const statementParams: StatementParams = {
				rolesModelConfig: {
					orchestrator: {
						model: request.model,
						temperature: 0.1, // Conservative temperature for sampling requests
						maxTokens: request.maxTokens || 4096, // Default to 4096 if not specified
						...(request.systemPrompt && { system: request.systemPrompt }),
					},
					chat: null,
					agent: null,
				},
			};

			// Prepare MCP server details
			const mcpServerDetails = {
				name: serverName,
				id: serverId,
			};

			// Create sampling params from request
			const samplingParams = {
				messages: request.messages,
				systemPrompt: request.systemPrompt,
				maxTokens: request.maxTokens,
			};

			// Handle sampling request
			const response = await projectEditor.handleSamplingRequest(
				samplingParams,
				collaborationId,
				mcpServerDetails,
				statementParams,
			);

			// Extract text from response
			const text = extractTextFromContent(response.messageResponse.answerContent) ||
				response.messageResponse.answer || '';

			// Map stop reason from BB format to MCP format
			const stopReason: 'endTurn' | 'stopSequence' | 'maxTokens' =
				response.messageResponse.messageStop?.stopReason === 'max_tokens'
					? 'maxTokens'
					: response.messageResponse.messageStop?.stopReason === 'stop_sequence'
					? 'stopSequence'
					: 'endTurn';

			return {
				text,
				stopReason,
			};
		} catch (error) {
			logger.error('MCPRequestHandlerService: Error in forwardSamplingToLLM:', error);
			return {
				text: `[ERROR] Failed to process sampling request: ${errorMessage(error)}`,
				stopReason: 'error',
			};
		}
	}

	/**
	 * Review sampling response before sending (placeholder)
	 */
	// deno-lint-ignore require-await
	private async reviewSamplingResponse(
		serverId: string,
		response: { text: string; stopReason?: string },
	): Promise<{ text: string }> {
		// TODO: Implement actual response review system
		// This could integrate with BB's future user interface system
		// For now, we'll auto-approve with logging

		const serverInfo = this.servers.get(serverId);
		const serverName = serverInfo?.config.name || serverId;

		logger.debug(
			`MCPRequestHandlerService: Auto-approving sampling response for ${serverName} (placeholder implementation)`,
			{
				serverId,
				serverName,
				responseLength: response.text.length,
				stopReason: response.stopReason,
				note: 'This should be replaced with actual response review UI',
			},
		);

		// Auto-approve for now - this should be replaced with actual user review
		return { text: response.text };
	}

	/**
	 * Public method to handle sampling requests
	 * Can be used when SDK supports sampling or for manual processing
	 */
	async processSamplingRequest(
		serverId: string,
		params: SamplingCreateMessageParams,
		meta: Record<string, unknown>,
	): Promise<SamplingCreateMessageResult> {
		return await this.handleSamplingRequest(serverId, params, meta);
	}

	// ============================================================================
	// MODEL SELECTION FOR SAMPLING
	// ============================================================================

	/**
	 * Select appropriate model based on MCP model preferences
	 * Delegates to ModelRegistryService for smart selection
	 */
	private selectModelForSampling(preferences?: SamplingModelPreferences): string {
		logger.info(`MCPRequestHandlerService: Converting model prefrences for sampling: `, preferences);
		// Convert MCP preferences to generic preferences
		const genericPreferences = this.convertMCPPreferencesToGeneric(preferences);

		// Delegate to ModelRegistryService for smart selection
		return this.modelRegistryService.selectModelByPreferences(genericPreferences);
	}

	/**
	 * Convert MCP-specific SamplingModelPreferences to generic ModelSelectionPreferences
	 */
	private convertMCPPreferencesToGeneric(
		preferences?: SamplingModelPreferences,
	): ModelSelectionPreferences | undefined {
		if (!preferences) {
			return undefined;
		}

		return {
			costPriority: preferences.costPriority,
			speedPriority: preferences.speedPriority,
			intelligencePriority: preferences.intelligencePriority,
			hints: preferences.hints?.map((hint) => ({
				name: hint.name,
				description: `MCP hint from sampling request`,
			})),
		};
	}
}
