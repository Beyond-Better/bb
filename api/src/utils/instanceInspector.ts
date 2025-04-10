import { logger } from 'shared/logger.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { interactionManager } from 'api/llms/interactionManager.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';

/**
 * Structure representing a ProjectEditor instance and its components
 */
export interface EditorInstanceInfo {
	conversationId: string;
	projectId: string;
	projectRoot: string;
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
			llmProvider?: {
				name: string;
				model?: string;
			};
			promptManager?: {
				initialized: boolean;
			};
		};
		mcpManager: {
			initialized: boolean;
			serverCount: number;
			serverIds: string[];
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
}

/**
 * Collects metadata about a ProjectEditor instance without capturing the entire object
 */
function inspectEditor(conversationId: string, editor: ProjectEditor): EditorInstanceInfo {
	const baseController = editor.orchestratorController;

	return {
		conversationId,
		projectId: editor.projectId,
		projectRoot: editor.projectRoot,
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
				llmProvider: baseController?.llmProvider
					? {
						name: baseController.llmProvider.llmProviderName,
						model: baseController.llmProvider.getDefaultModel(),
					}
					: undefined,
				promptManager: baseController?.promptManager
					? {
						initialized: true,
					}
					: undefined,
			},
			mcpManager: {
				initialized: editor.mcpManager !== undefined,
				serverCount: editor.mcpManager?.servers?.size || 0,
				serverIds: Array.from(editor.mcpManager?.servers?.keys() || []),
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
		fileCount: 'getFiles' in interaction ? (interaction as LLMConversationInteraction).getFiles()?.size : undefined,
	};
}

export function getInstanceOverview(_options: { detailed?: boolean } = {}): InstanceOverview {
	const projectEditors = projectEditorManager.getActiveEditors();

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
	};

	// Inspect each ProjectEditor instance
	for (const [conversationId, editor] of projectEditors) {
		result.editors[conversationId] = inspectEditor(conversationId, editor);
	}

	return result;
}

/**
 * Logs the instance overview to the console
 * @param options Configuration options
 */
export function logInstanceOverview(options: { detailed?: boolean } = {}): void {
	const overview = getInstanceOverview(options);

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
				mcpManager: editor.components.mcpManager.initialized
					? `✓ (${editor.components.mcpManager.serverCount} servers)`
					: '✗',
				resourceManager: editor.components.resourceManager.initialized ? '✓' : '✗',
				agentController: editor.components.orchestratorController.hasAgentController ? '✓' : '✗',
				toolManager: editor.components.orchestratorController.toolManager
					? `✓ (${editor.components.orchestratorController.toolManager.toolCount} tools)`
					: '✗',
				llmProvider: editor.components.orchestratorController.llmProvider?.name || '✗',
			});
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
	}

	// Always log the formatted overview to a separate log file for reference
	try {
		const formattedOutput = formatInstanceOverview(options);
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
export function formatInstanceOverview(options: { detailed?: boolean } = {}): string {
	const overview = getInstanceOverview(options);
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
		lines.push(`  - Project: ${editor.projectId} (${editor.projectRoot})`);
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

			// LLM Provider
			if (editor.components.orchestratorController.llmProvider) {
				const llm = editor.components.orchestratorController.llmProvider;
				lines.push(`      ▪ LLMProvider: ${llm.name}${llm.model ? ` (${llm.model})` : ''}`);
			}

			// Interaction Stats
			if (editor.components.orchestratorController.interactionStats) {
				const stats = editor.components.orchestratorController.interactionStats;
				lines.push(`      ▪ Interactions Tracked: ${stats.totalStats}, Token Usage: ${stats.totalTokenUsage}`);
			}
		}

		// MCP Manager
		lines.push(`    ◦ MCPManager: ${editor.components.mcpManager.initialized ? '✓' : '✗'}`);
		if (editor.components.mcpManager.serverCount > 0) {
			lines.push(
				`      ▪ Servers (${editor.components.mcpManager.serverCount}): ${
					editor.components.mcpManager.serverIds.join(', ')
				}`,
			);
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

	return lines.join('\n');
}
