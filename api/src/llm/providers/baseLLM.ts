import { LLMProvider as LLMProviderEnum } from "shared/types.ts";
import type { 
  LLMProviderMessageRequest, 
  LLMProviderMessageResponse, 
  LLMSpeakWithOptions,
  LLMTokenUsage,
  LLMValidateResponseCallback
} from "shared/types.ts";
import LLMConversation from "../conversation.ts";
import { logger } from "shared/logger.ts";

abstract class LLM {
  public providerName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC;
  public maxSpeakRetries: number = 3;
  public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds

  abstract prepareMessageParams(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): object;

  abstract speakWith(
    messageParams: LLMProviderMessageRequest
  ): Promise<LLMProviderMessageResponse>;

  createConversation(): LLMConversation {
    return new LLMConversation(this);
  }

  protected createRequestCacheKey(
    messageParams: LLMProviderMessageRequest
  ): string[] {
    const cacheKey = ['messageRequest', this.providerName, JSON.stringify(messageParams)];
    logger.console.info(`provider[${this.providerName}] using cache key: ${cacheKey}`);
    return cacheKey;
  }

  public async speakWithPlus(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): Promise<LLMProviderMessageResponse> {
    const start = Date.now();

    const llmProviderMessageRequest = this.prepareMessageParams(
      conversation,
      speakOptions
    ) as LLMProviderMessageRequest;

    let llmProviderMessageResponse: LLMProviderMessageResponse;
    let llmProviderMessageRequestId: string;

    const cacheKey = !config.ignoreLLMRequestCache ? this.createRequestCacheKey(llmProviderMessageRequest) : [];
    if (!config.ignoreLLMRequestCache) {
      const cachedResponse = await kv.get<LLMProviderMessageResponse>(cacheKey);

      if (cachedResponse.value) {
        logger.console.info(`provider[${this.providerName}] speakWithPlus: Using cached response`);
        llmProviderMessageResponse = cachedResponse.value;
        llmProviderMessageResponse.fromCache = true;
        await metricsService.recordCacheMetrics({ operation: 'hit' });
      } else {
        await metricsService.recordCacheMetrics({ operation: 'miss' });
      }
    }

    if (!llmProviderMessageResponse) {
      llmProviderMessageResponse = await this.speakWith(llmProviderMessageRequest);

      const latency = Date.now() - start;
      await metricsService.recordLLMMetrics({
        provider: this.providerName,
        latency,
        tokenUsage: llmProviderMessageResponse.usage.totalTokens,
        error: llmProviderMessageResponse.type === 'error' ? 'LLM request failed' : undefined,
      });

      await this.updateTokenUsage(llmProviderMessageResponse.usage);

      if (llmProviderMessageResponse.isTool) {
        llmProviderMessageResponse.toolsUsed = llmProviderMessageResponse.toolsUsed || [];
        this.extractToolUse(llmProviderMessageResponse);
      } else {
        const answerPart = llmProviderMessageResponse.answerContent[0] as LLMMessageContentPartTextBlock;
        llmProviderMessageResponse.answer = answerPart?.text;
      }

      llmProviderMessageResponse.fromCache = false;

      if (!config.ignoreLLMRequestCache) {
        await kv.set(cacheKey, llmProviderMessageResponse, { expireIn: this.requestCacheExpiry });
        await metricsService.recordCacheMetrics({ operation: 'set' });
      }
    }

    const { max_tokens: maxTokens, ...llmProviderMessageRequestDesnaked } = llmProviderMessageRequest;
    llmProviderMessageRequestId = await conversation.llmProviderMessageRequestRepository
      .createLLMProviderMessageRequest({
        ...llmProviderMessageRequestDesnaked,
        maxTokens,
        prompt: conversation.currentPrompt,
        conversationId: conversation.repoRecId,
        conversationTurnCount: conversation.turnCount,
      });

    const { id: _id, ...llmProviderMessageResponseWithoutId } = llmProviderMessageResponse;
    await conversation.llmProviderMessageResponseRepository.createLLMProviderMessageResponse({
      ...llmProviderMessageResponseWithoutId,
      conversationId: conversation.repoRecId,
      conversationTurnCount: conversation.turnCount,
      providerRequestId: llmProviderMessageRequestId,
      apiResponseId: llmProviderMessageResponse.id,
    });

    return llmProviderMessageResponse;
  }

  public async speakWithRetry(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): Promise<LLMProviderMessageResponse> {
    const maxRetries = this.maxSpeakRetries;
    const retrySpeakOptions = { ...speakOptions };
    let retries = 0;
    let failReason = '';
    let totalTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let totalProviderRequests = 0;

    while (retries < maxRetries) {
      retries++;
      totalProviderRequests++;
      try {
        const llmProviderMessageResponse = await this.speakWithPlus(conversation, retrySpeakOptions);

        totalTokenUsage.inputTokens += llmProviderMessageResponse.usage.inputTokens;
        totalTokenUsage.outputTokens += llmProviderMessageResponse.usage.outputTokens;
        totalTokenUsage.totalTokens += llmProviderMessageResponse.usage.totalTokens;

        const validationFailedReason = this.validateResponse(
          llmProviderMessageResponse,
          conversation,
          retrySpeakOptions.validateResponseCallback
        );

        if (validationFailedReason === null) {
          conversation.updateTotals(totalTokenUsage, totalProviderRequests);
          return llmProviderMessageResponse;
        }

        this.modifySpeakWithConversationOptions(conversation, retrySpeakOptions, validationFailedReason);

        failReason = `validation: ${validationFailedReason}`;
      } catch (error) {
        logger.console.error(
          `provider[${this.providerName}] speakWithRetry: Error calling speakWithPlus`,
          error
        );
        failReason = `caught error: ${error}`;
      }
      logger.console.warn(
        `provider[${this.providerName}] Request to ${this.providerName} failed. Retrying (${retries}/${maxRetries}) - ${failReason}`
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    conversation.updateTotals(totalTokenUsage, totalProviderRequests);
    logger.console.error(
      `provider[${this.providerName}] Max retries reached. Request to ${this.providerName} failed.`
    );
    throw createError(
      ErrorType.LLM,
      'Request failed after multiple retries.',
      {
        model: conversation.model,
        provider: this.providerName,
        args: { reason: failReason, retries: { max: maxRetries, current: retries } },
        conversationId: conversation.repoRecId,
      } as LLMErrorOptions
    );
  }

  protected validateResponse(
    llmProviderMessageResponse: LLMProviderMessageResponse,
    conversation: LLMConversation,
    validateCallback?: LLMValidateResponseCallback
  ): string | null {
    if (
      llmProviderMessageResponse.isTool && 
      llmProviderMessageResponse.toolsUsed &&
      llmProviderMessageResponse.toolsUsed.length > 0
    ) {
      const tool: LLMTool = conversation.getTools()[0];
      if (tool) {
        const inputSchema: LLMToolInputSchema = tool.input_schema;
        const validate = ajv.compile(inputSchema);
        const valid = validate(llmProviderMessageResponse.toolsUsed[0].toolInput);
        if (!valid) {
          logger.console.error(`Tool input validation failed: ${ajv.errorsText(validate.errors)}`);
          return `Tool input validation failed: ${ajv.errorsText(validate.errors)}`;
        }
      }
    }
    
    if (validateCallback) {
      const validationFailed = validateCallback(llmProviderMessageResponse, conversation);
      if (validationFailed) {
        logger.console.error(`Callback validation failed: ${validationFailed}`);
        return validationFailed;
      }
    }

    return null;
  }

  protected extractToolUse(llmProviderMessageResponse: LLMProviderMessageResponse): void {
    let currentToolThinking = '';

    llmProviderMessageResponse.answerContent.forEach((answerPart: LLMMessageContentPart, index: number) => {
      if (answerPart.type === 'text') {
        currentToolThinking += answerPart.text;
      } else if (answerPart.type === 'tool_use') {
        llmProviderMessageResponse.toolsUsed!.push({
          toolInput: answerPart.input,
          toolUseId: answerPart.id,
          toolName: answerPart.name,
          toolThinking: currentToolThinking,
        });
        currentToolThinking = '';
      }

      if (index === llmProviderMessageResponse.answerContent.length - 1 && answerPart.type === 'text') {
        llmProviderMessageResponse.toolsUsed![llmProviderMessageResponse.toolsUsed!.length - 1].toolThinking +=
          answerPart.text;
      }
    });
  }

  private async updateTokenUsage(usage: LLMTokenUsage): Promise<void> {
    const currentUsage = await tokenUsageManager.getTokenUsage(this.providerName);
    if (currentUsage) {
      const updatedUsage = {
        ...currentUsage,
        requestsRemaining: currentUsage.requestsRemaining - 1,
        tokensRemaining: currentUsage.tokensRemaining - usage.totalTokens,
      };
      await tokenUsageManager.updateTokenUsage(this.providerName, updatedUsage);
    }
  }
}

export default LLM;
