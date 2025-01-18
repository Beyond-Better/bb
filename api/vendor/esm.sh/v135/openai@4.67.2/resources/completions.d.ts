import { APIResource } from "../resource.d.ts";
import { APIPromise } from "../core.d.ts";
import * as Core from "../core.d.ts";
import * as CompletionsAPI from "./completions.d.ts";
import * as ChatCompletionsAPI from "./chat/completions.d.ts";
import { Stream } from "../streaming.d.ts";
export declare class Completions extends APIResource {
    /**
     * Creates a completion for the provided prompt and parameters.
     */
    create(body: CompletionCreateParamsNonStreaming, options?: Core.RequestOptions): APIPromise<Completion>;
    create(body: CompletionCreateParamsStreaming, options?: Core.RequestOptions): APIPromise<Stream<Completion>>;
    create(body: CompletionCreateParamsBase, options?: Core.RequestOptions): APIPromise<Stream<Completion> | Completion>;
}
/**
 * Represents a completion response from the API. Note: both the streamed and
 * non-streamed response objects share the same shape (unlike the chat endpoint).
 */
export interface Completion {
    /**
     * A unique identifier for the completion.
     */
    id: string;
    /**
     * The list of completion choices the model generated for the input prompt.
     */
    choices: Array<CompletionChoice>;
    /**
     * The Unix timestamp (in seconds) of when the completion was created.
     */
    created: number;
    /**
     * The model used for completion.
     */
    model: string;
    /**
     * The object type, which is always "text_completion"
     */
    object: 'text_completion';
    /**
     * This fingerprint represents the backend configuration that the model runs with.
     *
     * Can be used in conjunction with the `seed` request parameter to understand when
     * backend changes have been made that might impact determinism.
     */
    system_fingerprint?: string;
    /**
     * Usage statistics for the completion request.
     */
    usage?: CompletionUsage;
}
export interface CompletionChoice {
    /**
     * The reason the model stopped generating tokens. This will be `stop` if the model
     * hit a natural stop point or a provided stop sequence, `length` if the maximum
     * number of tokens specified in the request was reached, or `content_filter` if
     * content was omitted due to a flag from our content filters.
     */
    finish_reason: 'stop' | 'length' | 'content_filter';
    index: number;
    logprobs: CompletionChoice.Logprobs | null;
    text: string;
}
export declare namespace CompletionChoice {
    interface Logprobs {
        text_offset?: Array<number>;
        token_logprobs?: Array<number>;
        tokens?: Array<string>;
        top_logprobs?: Array<Record<string, number>>;
    }
}
/**
 * Usage statistics for the completion request.
 */
export interface CompletionUsage {
    /**
     * Number of tokens in the generated completion.
     */
    completion_tokens: number;
    /**
     * Number of tokens in the prompt.
     */
    prompt_tokens: number;
    /**
     * Total number of tokens used in the request (prompt + completion).
     */
    total_tokens: number;
    /**
     * Breakdown of tokens used in a completion.
     */
    completion_tokens_details?: CompletionUsage.CompletionTokensDetails;
    /**
     * Breakdown of tokens used in the prompt.
     */
    prompt_tokens_details?: CompletionUsage.PromptTokensDetails;
}
export declare namespace CompletionUsage {
    /**
     * Breakdown of tokens used in a completion.
     */
    interface CompletionTokensDetails {
        /**
         * Audio input tokens generated by the model.
         */
        audio_tokens?: number;
        /**
         * Tokens generated by the model for reasoning.
         */
        reasoning_tokens?: number;
    }
    /**
     * Breakdown of tokens used in the prompt.
     */
    interface PromptTokensDetails {
        /**
         * Audio input tokens present in the prompt.
         */
        audio_tokens?: number;
        /**
         * Cached tokens present in the prompt.
         */
        cached_tokens?: number;
    }
}
export type CompletionCreateParams = CompletionCreateParamsNonStreaming | CompletionCreateParamsStreaming;
export interface CompletionCreateParamsBase {
    /**
     * ID of the model to use. You can use the
     * [List models](https://platform.openai.com/docs/api-reference/models/list) API to
     * see all of your available models, or see our
     * [Model overview](https://platform.openai.com/docs/models/overview) for
     * descriptions of them.
     */
    model: (string & {}) | 'gpt-3.5-turbo-instruct' | 'davinci-002' | 'babbage-002';
    /**
     * The prompt(s) to generate completions for, encoded as a string, array of
     * strings, array of tokens, or array of token arrays.
     *
     * Note that <|endoftext|> is the document separator that the model sees during
     * training, so if a prompt is not specified the model will generate as if from the
     * beginning of a new document.
     */
    prompt: string | Array<string> | Array<number> | Array<Array<number>> | null;
    /**
     * Generates `best_of` completions server-side and returns the "best" (the one with
     * the highest log probability per token). Results cannot be streamed.
     *
     * When used with `n`, `best_of` controls the number of candidate completions and
     * `n` specifies how many to return – `best_of` must be greater than `n`.
     *
     * **Note:** Because this parameter generates many completions, it can quickly
     * consume your token quota. Use carefully and ensure that you have reasonable
     * settings for `max_tokens` and `stop`.
     */
    best_of?: number | null;
    /**
     * Echo back the prompt in addition to the completion
     */
    echo?: boolean | null;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on their
     * existing frequency in the text so far, decreasing the model's likelihood to
     * repeat the same line verbatim.
     *
     * [See more information about frequency and presence penalties.](https://platform.openai.com/docs/guides/text-generation/parameter-details)
     */
    frequency_penalty?: number | null;
    /**
     * Modify the likelihood of specified tokens appearing in the completion.
     *
     * Accepts a JSON object that maps tokens (specified by their token ID in the GPT
     * tokenizer) to an associated bias value from -100 to 100. You can use this
     * [tokenizer tool](/tokenizer?view=bpe) to convert text to token IDs.
     * Mathematically, the bias is added to the logits generated by the model prior to
     * sampling. The exact effect will vary per model, but values between -1 and 1
     * should decrease or increase likelihood of selection; values like -100 or 100
     * should result in a ban or exclusive selection of the relevant token.
     *
     * As an example, you can pass `{"50256": -100}` to prevent the <|endoftext|> token
     * from being generated.
     */
    logit_bias?: Record<string, number> | null;
    /**
     * Include the log probabilities on the `logprobs` most likely output tokens, as
     * well the chosen tokens. For example, if `logprobs` is 5, the API will return a
     * list of the 5 most likely tokens. The API will always return the `logprob` of
     * the sampled token, so there may be up to `logprobs+1` elements in the response.
     *
     * The maximum value for `logprobs` is 5.
     */
    logprobs?: number | null;
    /**
     * The maximum number of [tokens](/tokenizer) that can be generated in the
     * completion.
     *
     * The token count of your prompt plus `max_tokens` cannot exceed the model's
     * context length.
     * [Example Python code](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken)
     * for counting tokens.
     */
    max_tokens?: number | null;
    /**
     * How many completions to generate for each prompt.
     *
     * **Note:** Because this parameter generates many completions, it can quickly
     * consume your token quota. Use carefully and ensure that you have reasonable
     * settings for `max_tokens` and `stop`.
     */
    n?: number | null;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on
     * whether they appear in the text so far, increasing the model's likelihood to
     * talk about new topics.
     *
     * [See more information about frequency and presence penalties.](https://platform.openai.com/docs/guides/text-generation/parameter-details)
     */
    presence_penalty?: number | null;
    /**
     * If specified, our system will make a best effort to sample deterministically,
     * such that repeated requests with the same `seed` and parameters should return
     * the same result.
     *
     * Determinism is not guaranteed, and you should refer to the `system_fingerprint`
     * response parameter to monitor changes in the backend.
     */
    seed?: number | null;
    /**
     * Up to 4 sequences where the API will stop generating further tokens. The
     * returned text will not contain the stop sequence.
     */
    stop?: string | null | Array<string>;
    /**
     * Whether to stream back partial progress. If set, tokens will be sent as
     * data-only
     * [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)
     * as they become available, with the stream terminated by a `data: [DONE]`
     * message.
     * [Example Python code](https://cookbook.openai.com/examples/how_to_stream_completions).
     */
    stream?: boolean | null;
    /**
     * Options for streaming response. Only set this when you set `stream: true`.
     */
    stream_options?: ChatCompletionsAPI.ChatCompletionStreamOptions | null;
    /**
     * The suffix that comes after a completion of inserted text.
     *
     * This parameter is only supported for `gpt-3.5-turbo-instruct`.
     */
    suffix?: string | null;
    /**
     * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will
     * make the output more random, while lower values like 0.2 will make it more
     * focused and deterministic.
     *
     * We generally recommend altering this or `top_p` but not both.
     */
    temperature?: number | null;
    /**
     * An alternative to sampling with temperature, called nucleus sampling, where the
     * model considers the results of the tokens with top_p probability mass. So 0.1
     * means only the tokens comprising the top 10% probability mass are considered.
     *
     * We generally recommend altering this or `temperature` but not both.
     */
    top_p?: number | null;
    /**
     * A unique identifier representing your end-user, which can help OpenAI to monitor
     * and detect abuse.
     * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
     */
    user?: string;
}
export declare namespace CompletionCreateParams {
    type CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
    type CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}
export interface CompletionCreateParamsNonStreaming extends CompletionCreateParamsBase {
    /**
     * Whether to stream back partial progress. If set, tokens will be sent as
     * data-only
     * [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)
     * as they become available, with the stream terminated by a `data: [DONE]`
     * message.
     * [Example Python code](https://cookbook.openai.com/examples/how_to_stream_completions).
     */
    stream?: false | null;
}
export interface CompletionCreateParamsStreaming extends CompletionCreateParamsBase {
    /**
     * Whether to stream back partial progress. If set, tokens will be sent as
     * data-only
     * [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)
     * as they become available, with the stream terminated by a `data: [DONE]`
     * message.
     * [Example Python code](https://cookbook.openai.com/examples/how_to_stream_completions).
     */
    stream: true;
}
export declare namespace Completions {
    export import Completion = CompletionsAPI.Completion;
    export import CompletionChoice = CompletionsAPI.CompletionChoice;
    export import CompletionUsage = CompletionsAPI.CompletionUsage;
    export import CompletionCreateParams = CompletionsAPI.CompletionCreateParams;
    export import CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
    export import CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}
//# sourceMappingURL=completions.d.ts.map
