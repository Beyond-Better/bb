import type LLMInteraction from 'api/llms/baseInteraction.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import LLMChatInteraction from 'api/llms/chatInteraction.ts';
//import { generateConversationId } from 'shared/conversationManagement.ts';
import type { ConversationId } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

class InteractionManager {
	private interactionResults: Map<string, unknown>;
	private interactions: Map<string, LLMInteraction>;
	private interactionHierarchy: Map<string, string>; // child ID to parent ID

	constructor() {
		this.interactions = new Map();
		this.interactionHierarchy = new Map();
		this.interactionResults = new Map();
	}

	async createInteraction(
		type: 'conversation' | 'chat',
		interactionId: ConversationId,
		llmProvider: LLM,
		parentId?: string,
	): Promise<LLMInteraction> {
		//const interactionId = generateConversationId();
		let interaction: LLMInteraction;

		logger.info('InteractionManager: Creating interaction of type: ', type);

		if (type === 'conversation') {
			interaction = await new LLMConversationInteraction(llmProvider, interactionId).init(parentId);
		} else {
			interaction = await new LLMChatInteraction(llmProvider, interactionId).init(parentId);
		}

		this.interactions.set(interactionId, interaction);

		if (parentId) {
			this.interactionHierarchy.set(interactionId, parentId);
		}

		return interaction;
	}

	addInteraction(interaction: LLMInteraction, parentId?: string): void {
		const interactionId = interaction.id;
		this.interactions.set(interactionId, interaction);

		if (parentId) {
			this.interactionHierarchy.set(interactionId, parentId);
		}
	}

	getInteraction(id: string): LLMInteraction | undefined {
		const interaction = this.interactions.get(id);
		if (!interaction) {
			logger.warn(`Could not get Interaction with id ${id}`);
		}
		return interaction;
	}

	getInteractionStrict(id: string): LLMInteraction {
		return this.getInteractionOrThrow(id);
	}

	removeInteraction(id: string): boolean {
		if (!this.interactions.has(id)) {
			return false;
		}
		const removed = this.interactions.delete(id);
		this.interactionHierarchy.delete(id);

		// Remove all child interactions
		const childIds = Array.from(this.interactionHierarchy.entries())
			.filter(([_, parent]) => parent === id)
			.map(([child, _]) => child);

		childIds.forEach((childId) => this.removeInteraction(childId));

		return removed;
	}

	getChildInteractions(parentId: string): LLMInteraction[] {
		const childIds = Array.from(this.interactionHierarchy.entries())
			.filter(([_, parent]) => parent === parentId)
			.map(([child, _]) => child);

		return childIds.map((id) => this.interactions.get(id)!).filter(Boolean);
	}

	setParentChild(parentId: string, childId: string): void {
		if (!this.interactions.has(parentId) || !this.interactions.has(childId)) {
			throw new Error('Parent or child interaction does not exist');
		}
		this.interactionHierarchy.set(childId, parentId);
	}

	getParentInteraction(childId: string): LLMInteraction | undefined {
		const parentId = this.interactionHierarchy.get(childId);
		return parentId ? this.interactions.get(parentId) : undefined;
	}

	getAllDescendantInteractions(parentId: string): LLMInteraction[] {
		const descendants: LLMInteraction[] = [];
		const stack = [parentId];

		while (stack.length > 0) {
			const currentId = stack.pop()!;
			const children = this.getChildInteractions(currentId);

			descendants.push(...children);
			stack.push(...children.map((child) => child.id));
		}

		return descendants;
	}

	setInteractionResult(interactionId: string, result: unknown): void {
		this.interactionResults.set(interactionId, result);
	}

	getInteractionResult(interactionId: string): unknown {
		return this.interactionResults.get(interactionId);
	}

	hasInteraction(id: string): boolean {
		return this.interactions.has(id);
	}

	getAllInteractions(): LLMInteraction[] {
		return Array.from(this.interactions.values());
	}

	moveInteraction(interactionId: string, newParentId: string): void {
		if (!this.hasInteraction(interactionId) || !this.hasInteraction(newParentId)) {
			throw new Error('Interaction or new parent does not exist');
		}
		this.interactionHierarchy.set(interactionId, newParentId);
	}

	private getInteractionOrThrow(id: string): LLMInteraction {
		const interaction = this.getInteraction(id);
		if (!interaction) {
			throw new Error(`Interaction with id ${id} not found`);
		}
		return interaction;
	}
}

export default InteractionManager;

export const interactionManager: InteractionManager = new InteractionManager();
