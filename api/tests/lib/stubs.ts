import { stub } from 'api/tests/deps.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type OrchestratorController from 'api/controllers/orchestratorController.ts';
import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import type { LLMSpeakWithResponse } from 'api/types.ts';
//import LLMConversationInteraction from '../../src/llms/interactions/conversationInteraction.ts';
//import type { LLMSpeakWithResponse } from '../../src/types.ts';
//import { ConversationId, ConversationResponse } from 'shared/types.ts';

/*
 *  To use these new stub factories in your tests, you would do something like this:
 *
 *  ```typescript
 *  const stubMaker = makeOrchestratorControllerStub(orchestratorController);
 *
 *  // Stub only the methods you need for a particular test
 *  stubMaker.generateConversationTitleStub(() => Promise.resolve('Test Title'));
 *  stubMaker.stageAndCommitAfterChangingStub(() => Promise.resolve());
 *
 *  // You can provide different implementations in different tests
 *  stubMaker.revertLastChangeStub(() => {
 *    // Custom implementation for this specific test
 *    return Promise.resolve();
 *  });
 *  ```
 */

export function makeProjectEditorStub(projectEditor: ProjectEditor) {
	const initStub = stub(projectEditor, 'init', async () => projectEditor);
	/*
	const initConversationStub = stub(
		projectEditor,
		'initConversation',
		() => ({} as LLMConversationInteraction),
	);
	const handleStatementStub = stub(projectEditor, 'handleStatement', async (
		statement: string,
		conversationId: ConversationId,
	): Promise<ConversationResponse> => ({
		conversationId: 'test-id',
		response: { answerContent: [{ type: 'text', text: 'Test response' }] },
		messageMeta: {},
		conversationTitle: 'Test Conversation',
		conversationStats: { statementCount: 1, statementTurnCount: 1, conversationTurnCount: 1 },
		tokenUsageStatement: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		tokenUsageConversation: { inputTokensTotal: 10, outputTokensTotal: 20, totalTokensTotal: 30 },
	}));
	 */

	return {
		projectEditor,
		initStub,
		//initConversationStub,
		//handleStatementStub,
	};
}

export function makeOrchestratorControllerStub(orchestratorController: OrchestratorController) {
	const createStub = <T extends keyof OrchestratorController>(methodName: T) => {
		return (implementation?: OrchestratorController[T]) => {
			return stub(orchestratorController, methodName, implementation as never);
		};
	};

	const generateConversationTitleStub = createStub('generateConversationTitle');
	//const stageAndCommitAfterChangingStub = createStub('stageAndCommitAfterChanging');
	const revertLastChangeStub = createStub('revertLastChange');
	const logChangeAndCommitStub = createStub('logChangeAndCommit');
	const saveInitialConversationWithResponseStub = createStub('saveInitialConversationWithResponse');
	const saveConversationAfterStatementStub = createStub('saveConversationAfterStatement');
	const createChatInteractionStub = createStub('createChatInteraction');
	/*
	const initStub = stub(orchestratorController, 'init', async () => {});
	const handleStatementStub = stub(orchestratorController, 'handleStatement', async (
		statement: string,
		conversationId: ConversationId,
	): Promise<ConversationResponse> => ({
		conversationId: 'test-id',
		response: { answerContent: [{ type: 'text', text: 'Test response' }] },
		messageMeta: {},
		conversationTitle: 'Test Conversation',
		conversationStats: { statementCount: 1, statementTurnCount: 1, conversationTurnCount: 1 },
		tokenUsageStatement: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		tokenUsageConversation: { inputTokensTotal: 10, outputTokensTotal: 20, totalTokensTotal: 30 },
	}));
	const initializePrimaryInteractionStub = stub(orchestratorController, 'initializePrimaryInteraction', async () => ({
		id: 'test-id',
		title: 'Test Conversation',
		statementCount: 1,
		statementTurnCount: 1,
		conversationTurnCount: 1,
	}));
	const getInteractionStub = stub(orchestratorController, 'getInteraction', () => ({
		id: 'test-id',
		title: 'Test Conversation',
		llmProviderName: 'test-provider',
		baseSystem: 'test-system',
		model: 'test-model',
		maxTokens: 1000,
		temperature: 0.7,
		statementTurnCount: 1,
		getTotalTokensTotal: () => 100,
		getMessages: () => [],
		addFile: async () => {},
		removeFile: async () => {},
		listFiles: () => [],
		clearHistory: async () => {},
		undoLastChange: async () => {},
	}));
	const deleteInteractionStub = stub(orchestratorController, 'deleteInteraction', async () => {});
	const createChildInteractionStub = stub(
		orchestratorController,
		'createChildInteraction',
		async () => 'child-test-id',
	);
	const getInteractionResultStub = stub(
		orchestratorController,
		'getInteractionResult',
		async () => ({ result: 'test result' }),
	);
	const cleanupChildInteractionsStub = stub(orchestratorController, 'cleanupChildInteractions', async () => {});
	const manageAgentTasksStub = stub(orchestratorController, 'manageAgentTasks', async () => {});
	 */

	return {
		orchestratorController,
		generateConversationTitleStub,
		//stageAndCommitAfterChangingStub,
		revertLastChangeStub,
		logChangeAndCommitStub,
		saveInitialConversationWithResponseStub,
		saveConversationAfterStatementStub,
		createChatInteractionStub,
		//initStub,
		//handleStatementStub,
		//initializePrimaryInteractionStub,
		//getInteractionStub,
		//deleteInteractionStub,
		//createChildInteractionStub,
		//getInteractionResultStub,
		//cleanupChildInteractionsStub,
		//manageAgentTasksStub,
	};
}

export function makeChatInteractionStub(chatInteraction: LLMChatInteraction) {
	const createStub = <T extends keyof LLMChatInteraction>(methodName: T) => {
		return (implementation?: LLMChatInteraction[T]) => {
			return stub(chatInteraction, methodName, implementation as never);
		};
	};

	const conversationStatsStub = createStub('conversationStats');

	// Implement chat stub that returns formatted summary response
	const chatStub = (summaryText: string, usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 }) => {
		return stub(
			chatInteraction,
			'chat',
			async () =>
				({
					messageResponse: {
						id: 'test-msg-id',
						type: 'message',
						role: 'assistant',
						model: 'test-model',
						fromCache: false,
						timestamp: new Date().toISOString(),
						answerContent: [{ type: 'text', text: summaryText }],
						usage,
						providerMessageResponseMeta: { statusCode: 200, statusText: 'OK' },
						messageStop: { stopReason: 'tool_use', stopSequence: '' },
						rateLimit: {
							requestsRemaining: 0,
							requestsLimit: 0,
							requestsResetDate: new Date(),
							tokensRemaining: 0,
							tokensLimit: 0,
							tokensResetDate: new Date(),
						},
						answer: summaryText,
						isTool: true,
					},
					messageMeta: { system: 'test system' },
				}) as LLMSpeakWithResponse,
		);
	};

	const chatErrorStub = (errorText: string) => {
		return stub(
			chatInteraction,
			'chat',
			async () => {
				throw new Error(errorText);
			},
		);
	};

	return {
		chatInteraction,
		conversationStatsStub,
		chatStub,
		chatErrorStub,
	};
}
