import { logger } from 'shared/logger.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { interactionManager } from 'api/llms/interactionManager.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';

/**
 * Structure representing a ProjectEditor instance and its components
 */
/**
 * Structure representing interaction information for instance inspection
 */
export interface InteractionInstanceInfo {
	id: string;
	type: string;
	title?: string;
	model: string;
	llmProvider: {
		name: string;
	};
	requestParams?: {
		model: string;
		temperature?: number;
		maxTokens?: number;
		extendedThinking?: boolean;
		usePromptCaching?: boolean;
	};
}

/**
 * Structure representing a ProjectEditor instance and its components
 */
export interface EditorInstanceInfo {
	conversationId: string;
	projectId: string;
	primaryDsConnectionRoot: string;
	hasInitialized: boolean;
	components: {
		orchestratorController: {
			initialized: boolean;
			hasAgentController: boolean;
			toolManager?: {
				toolCount: number;
				toolSetType: string;
				loadedToolNames: string[];
			};
			interactionStats?: {
				totalStats: number;
				totalTokenUsage: number;
			};
			interactions?: InteractionInstanceInfo[];
			promptManager?: {
				initialized: boolean;
			};
		};
		resourceManager: {
			initialized: boolean;
		};
	};
}

/**
 * Structure representing an LLM interaction instance
 */
export interface InteractionInfo {
	id: string;
	type: string;
	title?: string;
	model?: string;
	statementCount: number;
	hasParent: boolean;
	parentId?: string;
	childrenCount: number;
	childrenIds: string[];
	fileCount?: number;
}

/**
 * Structure containing all instance information from the API
 */
export interface InstanceOverview {
	timestamp: string;
	projectEditorCount: number;
	editors: Record<string, EditorInstanceInfo>;
	interactions: {
		totalCount: number;
		orphanedCount: number; // Interactions not attached to an active ProjectEditor
		items: Record<string, InteractionInfo>;
		hierarchy: {
			roots: string[]; // IDs of root interactions (no parent)
			childToParent: Record<string, string>; // Child ID to parent ID mapping
		};
	};
	mcpManager: {
		initialized: boolean;
		serverCount: number;
		serverIds: string[];
	};
}

/**
 * Collects information about an interaction for instance inspection
 */
function inspectInteractionForEditor(interaction: LLMInteraction): InteractionInstanceInfo {
	return {
		id: interaction.id,
		type: interaction.interactionType,
		title: interaction.title,
		model: interaction.model,
		llmProvider: {
			name: interaction.llmProviderName,
		},
		requestParams: interaction.requestParams
			? {
				model: interaction.requestParams.model,
				temperature: interaction.requestParams.temperature,
				maxTokens: interaction.requestParams.maxTokens,
				extendedThinking: interaction.requestParams.extendedThinking?.enabled,
				usePromptCaching: interaction.requestParams.usePromptCaching,
			}
			: undefined,
	};
}

/**
 * Collects metadata about a ProjectEditor instance without capturing the entire object
 */
async function inspectEditor(conversationId: string, editor: ProjectEditor): Promise<EditorInstanceInfo> {
	const baseController = editor.orchestratorController;

	// Collect interactions from the controller's interactionManager
	let interactions: InteractionInstanceInfo[] | undefined;
	if (baseController?.interactionManager) {
		const allInteractions = baseController.interactionManager.getAllInteractions();
		interactions = allInteractions.map((interaction) => inspectInteractionForEditor(interaction));
	}

	return {
		conversationId,
		projectId: editor.projectId,
		primaryDsConnectionRoot: editor.primaryDsConnectionRoot || 'not defined',
		hasInitialized: baseController !== undefined,
		components: {
			orchestratorController: {
				initialized: baseController !== undefined,
				hasAgentController: baseController?.agentController !== undefined,
				toolManager: baseController?.toolManager
					? {
						toolCount: baseController.toolManager.getAllToolsMetadata().size,
						toolSetType: Array.isArray(baseController.toolManager.toolSet)
							? baseController.toolManager.toolSet.join(',')
							: baseController.toolManager.toolSet,
						loadedToolNames: baseController.toolManager.getLoadedToolNames(),
					}
					: undefined,
				interactionStats: baseController
					? {
						totalStats: baseController.getInteractionStatsCount(),
						totalTokenUsage: baseController.getInteractionTokenUsageCount(),
					}
					: undefined,
				interactions,
				promptManager: baseController?.promptManager
					? {
						initialized: true,
					}
					: undefined,
			},
			resourceManager: {
				initialized: editor.resourceManager !== undefined,
			},
		},
	};
}

/**
 * Gets a structured overview of all instantiated objects in the API
 * @param options Configuration options
 * @returns A structured representation of all instantiated objects
 */
/**
 * Collects information about an LLM interaction
 */
function inspectInteraction(interaction: LLMInteraction): InteractionInfo {
	return {
		id: interaction.id,
		type: interaction.constructor.name,
		title: interaction.title,
		model: interaction.model,
		statementCount: 'statementCount' in interaction ? (interaction as LLMInteraction).statementCount : 0,
		hasParent: interactionManager.getParentInteraction(interaction.id) !== undefined,
		parentId: interactionManager.getParentInteraction(interaction.id)?.id,
		childrenCount: interactionManager.getChildInteractions(interaction.id).length,
		childrenIds: interactionManager.getChildInteractions(interaction.id).map((child) => child.id),
		fileCount: 'getResources' in interaction
			? (interaction as LLMConversationInteraction).getResources()?.size
			: undefined,
	};
}

export async function getInstanceOverview(_options: { detailed?: boolean } = {}): Promise<InstanceOverview> {
	const projectEditors = projectEditorManager.getActiveEditors();
	const mcpManager = await getMCPManager();

	// Get all interactions from interactionManager
	const allInteractions = interactionManager.getAllInteractions();
	const interactionItems: Record<string, InteractionInfo> = {};
	const childToParentMap: Record<string, string> = {};
	const rootInteractionIds: string[] = [];

	// Track active conversation IDs to identify orphaned interactions
	const activeConversationIds = new Set<string>();
	for (const [conversationId] of projectEditors) {
		activeConversationIds.add(conversationId);
	}

	// Count orphaned interactions (not attached to active ProjectEditor)
	let orphanedCount = 0;

	// Build interaction map and hierarchy
	for (const interaction of allInteractions) {
		// Map interaction details
		interactionItems[interaction.id] = inspectInteraction(interaction);

		// Track parent-child relationships
		const parentInteraction = interactionManager.getParentInteraction(interaction.id);
		if (parentInteraction) {
			childToParentMap[interaction.id] = parentInteraction.id;
		} else {
			rootInteractionIds.push(interaction.id);

			// Check if this root interaction is orphaned (not in an active ProjectEditor)
			if (!activeConversationIds.has(interaction.id)) {
				orphanedCount++;
			}
		}
	}

	const result: InstanceOverview = {
		timestamp: new Date().toISOString(),
		projectEditorCount: projectEditors.size,
		editors: {},
		interactions: {
			totalCount: allInteractions.length,
			orphanedCount,
			items: interactionItems,
			hierarchy: {
				roots: rootInteractionIds,
				childToParent: childToParentMap,
			},
		},
		mcpManager: {
			initialized: mcpManager !== undefined,
			serverCount: mcpManager?.servers?.size || 0,
			serverIds: Array.from(mcpManager?.servers?.keys() || []),
		},
	};

	// Inspect each ProjectEditor instance
	for (const [conversationId, editor] of projectEditors) {
		result.editors[conversationId] = await inspectEditor(conversationId, editor);
	}

	return result;
}

/**
 * Logs the instance overview to the console
 * @param options Configuration options
 */
export async function logInstanceOverview(options: { detailed?: boolean } = {}): Promise<void> {
	const overview = await getInstanceOverview(options);

	logger.info(
		`API Instance Overview - ${overview.projectEditorCount} active editors, ${overview.interactions.totalCount} interactions (${overview.interactions.orphanedCount} orphaned)`,
	);

	if (options.detailed) {
		// Use logger.dir to get full object inspection
		logger.dir(overview);
	} else {
		// Log a more concise summary for editors
		logger.info('===== PROJECT EDITORS =====');
		for (const [conversationId, editor] of Object.entries(overview.editors)) {
			logger.info(`Editor[${conversationId}]: Project ${editor.projectId} - Components:`, {
				orchestrator: editor.components.orchestratorController.initialized ? '✓' : '✗',
				resourceManager: editor.components.resourceManager.initialized ? '✓' : '✗',
				agentController: editor.components.orchestratorController.hasAgentController ? '✓' : '✗',
				toolManager: editor.components.orchestratorController.toolManager
					? `✓ (${editor.components.orchestratorController.toolManager.toolCount} tools)`
					: '✗',
				interactions: editor.components.orchestratorController.interactions
					? `✓ (${editor.components.orchestratorController.interactions.length} interactions)`
					: '✗',
			});

			// Log interaction details if available
			if (
				editor.components.orchestratorController.interactions &&
				editor.components.orchestratorController.interactions.length > 0
			) {
				for (const interaction of editor.components.orchestratorController.interactions) {
					logger.info(`  Interaction[${interaction.id}]: ${interaction.type}`, {
						title: interaction.title || '(no title)',
						model: interaction.model,
						provider: interaction.llmProvider.name,
					});
				}
			}
		}

		// Log interactions summary
		logger.info('===== INTERACTIONS =====');
		if (overview.interactions.totalCount === 0) {
			logger.info('No active interactions');
		} else {
			// Log root interactions
			logger.info(`Root interactions: ${overview.interactions.hierarchy.roots.length}`);
			for (const rootId of overview.interactions.hierarchy.roots) {
				const interaction = overview.interactions.items[rootId];
				logger.info(
					`Root[${interaction.id}]: ${interaction.type}${interaction.title ? ` - ${interaction.title}` : ''}`,
					{
						model: interaction.model || '(none)',
						statements: interaction.statementCount,
						files: interaction.fileCount !== undefined ? interaction.fileCount : '(unknown)',
						children: interaction.childrenCount,
					},
				);
			}

			// Log orphaned interactions if any
			if (overview.interactions.orphanedCount > 0) {
				logger.warn(`Found ${overview.interactions.orphanedCount} orphaned root interactions!`);
			}
		}

		logger.info('===== MCP SERVERS =====');
		logger.info(`Servers:`, {
			mcpManager: overview.mcpManager.initialized ? `✓ (${overview.mcpManager.serverCount} servers)` : '✗',
		});
	}

	// Always log the formatted overview to a separate log file for reference
	try {
		const formattedOutput = await formatInstanceOverview(options);
		Deno.writeTextFileSync('bb-instances.log', formattedOutput);
		logger.info(`Instance overview written to bb-instances.log`);
	} catch (err) {
		logger.warn(`Could not write instance overview to file: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Returns a formatted string representation of the instance overview
 * @param options Configuration options
 * @returns A string representation of the instance overview
 */
export async function formatInstanceOverview(options: { detailed?: boolean } = {}): Promise<string> {
	const overview = await getInstanceOverview(options);
	const detailed = options.detailed ?? false;

	const lines = [
		`API Instance Overview - ${overview.timestamp}`,
		`Active ProjectEditors: ${overview.projectEditorCount}`,
		`Total Interactions: ${overview.interactions.totalCount} (${overview.interactions.orphanedCount} orphaned)`,
		'--------------------------------------------',
	];

	// Project Editors Section
	lines.push(`\nPROJECT EDITORS:`);
	for (const [conversationId, editor] of Object.entries(overview.editors)) {
		lines.push(`• Editor[${conversationId}]:`);
		lines.push(`  - Project: ${editor.projectId} (${editor.primaryDsConnectionRoot})`);
		lines.push(`  - Components:`);

		// Orchestrator Controller
		lines.push(`    ◦ OrchestratorController: ${editor.components.orchestratorController.initialized ? '✓' : '✗'}`);
		if (editor.components.orchestratorController.initialized) {
			if (editor.components.orchestratorController.hasAgentController) {
				lines.push(`      ▪ AgentController: ✓`);
			}

			// Tool Manager
			if (editor.components.orchestratorController.toolManager) {
				const tm = editor.components.orchestratorController.toolManager;
				lines.push(`      ▪ ToolManager: ${tm.toolCount} tools (${tm.toolSetType})`);
				if (detailed && tm.loadedToolNames.length > 0) {
					lines.push(`        Tools: ${tm.loadedToolNames.join(', ')}`);
				}
			}

			// Interactions
			if (editor.components.orchestratorController.interactions) {
				const interactions = editor.components.orchestratorController.interactions;
				lines.push(`      ▪ Interactions: ${interactions.length}`);
				if (detailed || interactions.length <= 3) {
					for (const interaction of interactions) {
						lines.push(
							`        ${interaction.id} (${interaction.type}): ${interaction.llmProvider.name} - ${interaction.model}`,
						);
						if (interaction.title) {
							lines.push(`          Title: ${interaction.title}`);
						}
						if (interaction.requestParams) {
							lines.push(
								`          Params: temp=${interaction.requestParams.temperature}, maxTokens=${interaction.requestParams.maxTokens}, cache=${interaction.requestParams.usePromptCaching}`,
							);
						}
					}
				} else {
					lines.push(`        (showing first 3 of ${interactions.length})`);
					for (const interaction of interactions.slice(0, 3)) {
						lines.push(
							`        ${interaction.id} (${interaction.type}): ${interaction.llmProvider.name} - ${interaction.model}`,
						);
					}
				}
			}

			// Interaction Stats
			if (editor.components.orchestratorController.interactionStats) {
				const stats = editor.components.orchestratorController.interactionStats;
				lines.push(`      ▪ Interactions Tracked: ${stats.totalStats}, Token Usage: ${stats.totalTokenUsage}`);
			}
		}

		// Resource Manager
		lines.push(`    ◦ ResourceManager: ${editor.components.resourceManager.initialized ? '✓' : '✗'}`);
		lines.push('');
	}

	// Interactions Section
	lines.push(`\nINTERACTIONS:`);
	if (overview.interactions.totalCount === 0) {
		lines.push('  No active interactions');
	} else {
		// First show root interactions
		lines.push(`  Root Interactions: ${overview.interactions.hierarchy.roots.length}`);

		for (const rootId of overview.interactions.hierarchy.roots) {
			const interaction = overview.interactions.items[rootId];
			lines.push(
				`  • ${interaction.id} (${interaction.type})${interaction.title ? `: ${interaction.title}` : ''}`,
			);
			if (interaction.fileCount !== undefined) {
				lines.push(`    - Files: ${interaction.fileCount}`);
			}
			if (interaction.model) {
				lines.push(`    - Model: ${interaction.model}`);
			}
			if (interaction.statementCount > 0) {
				lines.push(`    - Statements: ${interaction.statementCount}`);
			}

			// Show children if detailed or if there are only a few
			if ((detailed || interaction.childrenCount < 5) && interaction.childrenCount > 0) {
				lines.push(`    - Children (${interaction.childrenCount}):`);
				for (const childId of interaction.childrenIds) {
					const child = overview.interactions.items[childId];
					lines.push(`      ◦ ${child.id} (${child.type})${child.title ? `: ${child.title}` : ''}`);
				}
			} else if (interaction.childrenCount > 0) {
				lines.push(`    - Children: ${interaction.childrenCount}`);
			}

			lines.push('');
		}

		// Stats about orphaned interactions
		if (overview.interactions.orphanedCount > 0) {
			lines.push(`  Orphaned Root Interactions: ${overview.interactions.orphanedCount}`);
			if (detailed) {
				const orphanedIds = overview.interactions.hierarchy.roots.filter(
					(rootId) => !Object.keys(overview.editors).includes(rootId),
				);
				for (const orphanedId of orphanedIds) {
					const orphaned = overview.interactions.items[orphanedId];
					lines.push(`  • ${orphaned.id} (${orphaned.type})${orphaned.title ? `: ${orphaned.title}` : ''}`);
				}
			}
		}
	}
	// MCP Manager Section
	lines.push(`\nMCP MANAGER:`);
	if (!overview.mcpManager.initialized) {
		lines.push('  No active MCP servers');
	} else {
		// Servers
		if (overview.mcpManager.serverCount > 0) {
			lines.push(
				`  ▪ Servers (${overview.mcpManager.serverCount}): ${overview.mcpManager.serverIds.join(', ')}`,
			);
		}
	}

	return lines.join('\n');
}
