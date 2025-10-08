/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This file contains all type definitions related to MCP servers, OAuth flows,
 * sampling requests, and server management. These types were extracted from
 * the monolithic MCPManager to improve modularity and reusability.
 */

import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';
import type { Client } from 'mcp/client/index.js';

// ============================================================================
// MCP SAMPLING TYPES
// Based on MCP specification: https://modelcontextprotocol.io/specification/2025-03-26/client/sampling.md
// ============================================================================

/**
 * MCP Sampling Message Content Types
 */
export interface SamplingTextContent {
	type: 'text';
	text: string;
}

export interface SamplingImageContent {
	type: 'image';
	data: string; // base64-encoded
	mimeType: string;
}

export interface SamplingAudioContent {
	type: 'audio';
	data: string; // base64-encoded
	mimeType: string;
}

export type SamplingContent = SamplingTextContent | SamplingImageContent | SamplingAudioContent;

/**
 * MCP Sampling Message
 */
export interface SamplingMessage {
	role: 'user' | 'assistant' | 'system';
	content: SamplingContent;
}

/**
 * MCP Model Preferences
 */
export interface SamplingModelPreferences {
	hints?: Array<{ name: string }>;
	costPriority?: number; // 0-1
	speedPriority?: number; // 0-1
	intelligencePriority?: number; // 0-1
}

/**
 * MCP Sampling Request Parameters
 */
export interface SamplingCreateMessageParams {
	messages: SamplingMessage[];
	modelPreferences?: SamplingModelPreferences;
	systemPrompt?: string;
	maxTokens?: number;
	// Add index signature to satisfy JSONRPCRequest params constraint
	[key: string]: unknown;
}

// From MCP types - we should probably use this type directly instead
//
// export const CreateMessageRequestSchema = RequestSchema.extend({
//   method: z.literal("sampling/createMessage"),
//   params: BaseRequestParamsSchema.extend({
//     messages: z.array(SamplingMessageSchema),
//     /**
//      * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
//      */
//     systemPrompt: z.optional(z.string()),
//     /**
//      * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
//      */
//     includeContext: z.optional(z.enum(["none", "thisServer", "allServers"])),
//     temperature: z.optional(z.number()),
//     /**
//      * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
//      */
//     maxTokens: z.number().int(),
//     stopSequences: z.optional(z.array(z.string())),
//     /**
//      * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
//      */
//     metadata: z.optional(z.object({}).passthrough()),
//     /**
//      * The server's preferences for which model to select.
//      */
//     modelPreferences: z.optional(ModelPreferencesSchema),
//   }),
// });
//
// /* Sampling */
// /**
//  * Hints to use for model selection.
//  */
// export const ModelHintSchema = z
//   .object({
//     /**
//      * A hint for a model name.
//      */
//     name: z.string().optional(),
//   })
//   .passthrough();
//
// /**
//  * The server's preferences for model selection, requested of the client during sampling.
//  */
// export const ModelPreferencesSchema = z
//   .object({
//     /**
//      * Optional hints to use for model selection.
//      */
//     hints: z.optional(z.array(ModelHintSchema)),
//     /**
//      * How much to prioritize cost when selecting a model.
//      */
//     costPriority: z.optional(z.number().min(0).max(1)),
//     /**
//      * How much to prioritize sampling speed (latency) when selecting a model.
//      */
//     speedPriority: z.optional(z.number().min(0).max(1)),
//     /**
//      * How much to prioritize intelligence and capabilities when selecting a model.
//      */
//     intelligencePriority: z.optional(z.number().min(0).max(1)),
//   })
//   .passthrough();

/**
 * MCP Sampling Response Result
 */
export interface SamplingCreateMessageResult {
	role: 'assistant';
	content: SamplingContent;
	model: string;
	stopReason: 'endTurn' | 'stopSequence' | 'maxTokens' | 'error';
	// Add index signature to satisfy JSONRPCResponse result constraint
	[key: string]: unknown;
}

// ============================================================================
// OAUTH TYPES
// ============================================================================

/**
 * OAuth server discovery interface
 */
export interface OAuthServerMetadata {
	authorization_endpoint: string;
	token_endpoint: string;
	registration_endpoint?: string;
	scopes_supported?: string[];
	code_challenge_methods_supported?: string[];
	grant_types_supported?: string[];
	response_types_supported?: string[];
}

/**
 * Dynamic Client Registration interfaces
 */
export interface ClientRegistrationRequest {
	client_name: string;
	redirect_uris: string[];
	grant_types: string[];
	response_types: string[];
	token_endpoint_auth_method: string;
	scope?: string;
}

export interface ClientRegistrationResponse {
	client_id: string;
	client_secret?: string;
	client_secret_expires_at?: number;
	registration_access_token?: string;
	registration_client_uri?: string;
}

// ============================================================================
// SERVER MANAGEMENT TYPES
// ============================================================================

/**
 * Information about an MCP server instance
 */
export interface McpServerInfo {
	server: Client;
	sessionId?: string;
	config: MCPServerConfig;
	tools?: Array<{ name: string; description?: string; inputSchema: unknown }>;
	resources?: Array<import('shared/types/dataSourceResource.ts').ResourceMetadata>;
	capabilities?: DataSourceCapability[];
	tokens?: {
		accessToken: string;
		refreshToken?: string;
		expiresAt?: number;
		codeVerifier?: string; // For PKCE
	};
	// Connection state tracking for reconnection
	connectionState: 'connected' | 'disconnected' | 'reconnecting';
	lastError?: Error;
	reconnectAttempts: number;
	maxReconnectAttempts: number;
	reconnectDelay: number; // milliseconds

	// Health check tracking (for HTTP transport)
	lastActivityTime?: number; // timestamp of last operation
	healthCheckTimer?: number; // timer ID for scheduled health check

	pendingAuthUrl?: string;
}
