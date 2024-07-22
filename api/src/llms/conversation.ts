import type {
	ConversationId,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMTokenUsage,
} from '../types.ts';
import type { LLMMessageContentPartToolResultBlock } from './message.ts';
import LLMMessage, { LLMMessageContentParts } from './message.ts';
import type { LLMMessageProviderResponse } from './message.ts';
import LLMTool from './tool.ts';
import LLM from './providers/baseLLM.ts';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';
import { logger } from 'shared/logger.ts';

import { crypto } from '@std/crypto';

interface FileMetadata {
	path: string;
	size: number;
	lastModified: Date;
	inSystemPrompt: boolean;
	messageId?: string;
}

class LLMConversation {
	public id: string;
	private llm: LLM;
	private _conversationId: ConversationId = '';
	private _turnCount: number = 0;
	private messages: LLMMessage[] = [];
	private tools: Map<string, LLMTool> = new Map();
	private _files: Map<string, FileMetadata> = new Map();
	private systemPromptFiles: string[] = [];

	private _system: string = '';

	private persistence: ConversationPersistence;

	protected _baseSystem: string = '';
	protected _ctagsContent: string = '';
	protected _model: string = '';
	protected _maxTokens: number = 4000;
	protected _temperature: number = 0.2;
	private _totalTokenUsage: LLMTokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	private _totalProviderRequests: number = 0;
	private _currentPrompt: string = '';

	constructor(llm: LLM) {
		this.id = this.generateShortId();
		this.llm = llm;
		this.persistence = new ConversationPersistence(this.id);
	}

	private generateShortId(): string {
		const uuid = crypto.randomUUID();
		return uuid.replace(/-/g, '').substring(0, 8);
	}

	async addFileToMessageArray(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
	): Promise<void> {
		const fileMetadata: FileMetadata = {
			...metadata,
			path: filePath,
			inSystemPrompt: false,
		};
		this._files.set(filePath, fileMetadata);
		const messageId = this.addMessageWithCorrectRole(`File added: ${filePath}`);
		fileMetadata.messageId = messageId;
		await this.persistence.saveConversation(this);
	}

	async addFileForSystemPrompt(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
	): Promise<void> {
		const fileMetadata: FileMetadata = {
			...metadata,
			path: filePath,
			inSystemPrompt: true,
		};
		this._files.set(filePath, fileMetadata);
		this.systemPromptFiles.push(filePath);
		await this.persistence.saveConversation(this);
	}

	removeFile(filePath: string): boolean {
		const fileMetadata = this._files.get(filePath);
		if (fileMetadata) {
			if (!fileMetadata.inSystemPrompt && fileMetadata.messageId) {
				this.messages = this.messages.filter((message) => message.id !== fileMetadata.messageId);
			}
			if (fileMetadata.inSystemPrompt) {
				this.systemPromptFiles = this.systemPromptFiles.filter((path) => path !== filePath);
			}
			return this._files.delete(filePath);
		}
		return false;
	}

	getFile(filePath: string): FileMetadata | undefined {
		return this._files.get(filePath);
	}

	listFiles(): string[] {
		return Array.from(this._files.keys());
	}

	private addMessageWithCorrectRole(content: string): string {
		const lastMessage = this.messages[this.messages.length - 1];
		if (lastMessage && lastMessage.role === 'user') {
			// Append to the last user message
			lastMessage.content.push({ type: 'text', text: '\n\n' + content });
			return lastMessage.id;
		} else {
			// Add a new user message
			const newMessage = new LLMMessage('user', [{ type: 'text', text: content }]);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	getFiles(): Map<string, FileMetadata> {
		return this._files;
	}

	async save(): Promise<void> {
		try {
			await this.persistence.saveConversation(this);
		} catch (error) {
			logger.error(`Failed to save conversation: ${error.message}`);
			throw new Error('Failed to save conversation. The application will now exit.');
		}
	}

	static async resume(id: string, llm: LLM): Promise<LLMConversation> {
		const persistence = new ConversationPersistence(id);
		await persistence.init();
		const conversation = await persistence.loadConversation(llm);
		return conversation;
	}

	private async logConversation(): Promise<void> {
		// TODO: Implement this method when LLMConversationRepository is available
		console.log('Logging conversation:', {
			id: this.id,
			providerName: this.llm.providerName,
			turnCount: this._turnCount,
			messages: this.messages,
			tools: this.tools,
			tokenUsage: this.totalTokenUsage,
			system: this._baseSystem,
			model: this._model,
			maxTokens: this._maxTokens,
			temperature: this._temperature,
			timestamp: new Date(),
		});
	}

	// Getters and setters
	get conversationId(): ConversationId {
		return this._conversationId;
	}

	set conversationId(value: ConversationId) {
		this._conversationId = value;
	}

	get providerName(): string {
		return this.llm.providerName;
	}

	get currentPrompt(): string {
		return this._currentPrompt;
	}

	set currentPrompt(value: string) {
		this._currentPrompt = value;
	}

	get baseSystem(): string {
		return this._baseSystem;
	}

	set baseSystem(value: string) {
		this._baseSystem = value;
	}

	get ctagsContent(): string {
		return this._ctagsContent;
	}

	set ctagsContent(value: string) {
		this._ctagsContent = value;
	}

	get model(): string {
		return this._model;
	}

	set model(value: string) {
		this._model = value;
	}

	get maxTokens(): number {
		return this._maxTokens;
	}

	set maxTokens(value: number) {
		this._maxTokens = value;
	}

	get temperature(): number {
		return this._temperature;
	}

	set temperature(value: number) {
		this._temperature = value;
	}

	get turnCount(): number {
		return this._turnCount;
	}

	get totalTokenUsage(): LLMTokenUsage {
		return this._totalTokenUsage;
	}

	get totalProviderRequests(): number {
		return this._totalProviderRequests;
	}

	async updateTotals(tokenUsage: LLMTokenUsage, providerRequests: number): Promise<void> {
		this._totalTokenUsage.totalTokens += tokenUsage.totalTokens;
		this._totalTokenUsage.inputTokens += tokenUsage.inputTokens;
		this._totalTokenUsage.outputTokens += tokenUsage.outputTokens;
		this._totalProviderRequests += providerRequests;
		if (this.persistence) {
			await this.persistence.saveConversation(this);
		}
	}

	async addMessage(message: LLMMessage): Promise<void> {
		this.messages.push(message);
		if (this.persistence) {
			await this.persistence.saveConversationMessage(message, message.providerResponse);
		}
	}

	getMessages(): LLMMessage[] {
		return this.messages;
	}

	getLastMessage(): LLMMessage {
		return this.messages.slice(-1)[0];
	}

	getLastMessageProviderResponse(): LLMMessageProviderResponse | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.providerResponse;
	}

	getLastMessageContent(): LLMMessageContentParts | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.content; // as LLMMessageContentParts | undefined;
	}

	clearMessages(): void {
		this.messages = [];
	}

	addTool(tool: LLMTool): void {
		this.tools.set(tool.name, tool);
	}

	addTools(tools: LLMTool[]): void {
		tools.forEach((tool: LLMTool) => {
			this.tools.set(tool.name, tool);
		});
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
	}

	getTools(): LLMTool[] {
		return Array.from(this.tools.values());
	}

	clearTools(): void {
		this.tools.clear();
	}

	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		this._turnCount++;
		this.addMessageWithCorrectRole(prompt);

		const llmProviderMessageResponse = await this.llm.speakWithRetry(this, speakOptions);

		// Create and save the assistant's message
		const assistantMessage = new LLMMessage('assistant', llmProviderMessageResponse.answerContent, undefined, llmProviderMessageResponse);
		await this.addMessage(assistantMessage);

		await this.save();

		return llmProviderMessageResponse;
	}
}

export default LLMConversation;
