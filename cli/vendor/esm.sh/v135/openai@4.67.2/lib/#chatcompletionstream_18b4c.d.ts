import { type ChatCompletionChunk, type ChatCompletionCreateParamsStreaming } from 'https://esm.sh/v135/openai@4.67.2/resources/chat/completions.d.ts';
import { RunnerOptions, type AbstractChatCompletionRunnerEvents } from "./AbstractChatCompletionRunner.d.ts";
import { type ReadableStream } from 'https://esm.sh/v135/openai@4.67.2/_shims/index.d.ts';
import { RunnableTools, type BaseFunctionsArgs, type RunnableFunctions } from "./RunnableFunction.d.ts";
import { ChatCompletionSnapshot, ChatCompletionStream } from "./ChatCompletionStream.d.ts";
import OpenAI from 'https://esm.sh/v135/openai@4.67.2/index.d.ts';
import { AutoParseableTool } from 'https://esm.sh/v135/openai@4.67.2/lib/parser.d.ts';
export interface ChatCompletionStreamEvents extends AbstractChatCompletionRunnerEvents {
    content: (contentDelta: string, contentSnapshot: string) => void;
    chunk: (chunk: ChatCompletionChunk, snapshot: ChatCompletionSnapshot) => void;
}
export type ChatCompletionStreamingFunctionRunnerParams<FunctionsArgs extends BaseFunctionsArgs> = Omit<ChatCompletionCreateParamsStreaming, 'functions'> & {
    functions: RunnableFunctions<FunctionsArgs>;
};
export type ChatCompletionStreamingToolRunnerParams<FunctionsArgs extends BaseFunctionsArgs> = Omit<ChatCompletionCreateParamsStreaming, 'tools'> & {
    tools: RunnableTools<FunctionsArgs> | AutoParseableTool<any, true>[];
};
export declare class ChatCompletionStreamingRunner<ParsedT = null> extends ChatCompletionStream<ParsedT> implements AsyncIterable<ChatCompletionChunk> {
    static fromReadableStream(stream: ReadableStream): ChatCompletionStreamingRunner<null>;
    /** @deprecated - please use `runTools` instead. */
    static runFunctions<T extends (string | object)[]>(client: OpenAI, params: ChatCompletionStreamingFunctionRunnerParams<T>, options?: RunnerOptions): ChatCompletionStreamingRunner<null>;
    static runTools<T extends (string | object)[], ParsedT = null>(client: OpenAI, params: ChatCompletionStreamingToolRunnerParams<T>, options?: RunnerOptions): ChatCompletionStreamingRunner<ParsedT>;
}
//# sourceMappingURL=ChatCompletionStreamingRunner.d.ts.map
