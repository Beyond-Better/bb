/**
 * SVG Images Utility
 * 
 * Centralized utility for all SVG icons used in the BB project.
 * This module consolidates provider logos, model characteristics, and model roles,
 * returning JSX components.
 * 
 * Features:
 * - Provider logos with original colors or currentColor theming
 * - Model characteristic icons (speed, cost, intelligence)
 * - Model role icons (orchestrator, agent, admin)
 * - JSX components for clean integration with Preact/React
 * - Legacy string functions for backwards compatibility
 * - Unified API for consistent usage across the project
 */

import { JSX } from 'preact';

// Import JSX components and types
import { 
	getProviderIcon as getProviderIconComponent,
	AnthropicIcon,
	OpenAIIcon,
	GoogleIcon,
	DeepSeekIcon,
	OllamaIcon,
	GroqIcon,
	GenericAIIcon,
	type ProviderIconProps,
} from './svg/providers.tsx';

import {
	getCharacteristicIcon as getCharacteristicIconComponent,
	FastSpeedIcon,
	MediumSpeedIcon,
	SlowSpeedIcon,
	LowCostIcon,
	MediumCostIcon,
	HighCostIcon,
	VeryHighCostIcon,
	MediumIntelligenceIcon,
	HighIntelligenceIcon,
	VeryHighIntelligenceIcon,
	type CharacteristicIconProps
} from './svg/characteristics.tsx';

import { 
	getControllerRoleIcon as getControllerRoleIconComponent,
	OrchestratorIcon,
	AgentIcon,
	ChatIcon,
	type ControllerRoleIconProps
} from './svg/controllerRoles.tsx';

// Re-export types for convenience
export type { ProviderIconProps, CharacteristicIconProps, ControllerRoleIconProps };

export interface SvgRenderOptions {
	useCurrentColor?: boolean;
	//optimized?: boolean;
}

/**
 * Get provider icon as JSX component
 * 
 * @param provider - Provider name (e.g., 'anthropic', 'openai', 'google')
 * @param props - Icon props including className, aria-label, style, and useCurrentColor
 * @returns JSX Element
 * 
 * @example
 * ```tsx
 * // Original brand colors
 * const anthropicIcon = getProviderIcon('anthropic');
 * 
 * // With theme colors (inherits text color)
 * const anthropicIconThemed = getProviderIcon('anthropic', { useCurrentColor: true });
 * 
 * // With custom styling
 * const anthropicStyled = getProviderIcon('anthropic', { 
 *   className: 'w-5 h-5 text-purple-600',
 *   'aria-label': 'Anthropic provider'
 * });
 * ```
 */
export function getProviderIcon(provider: string, props: ProviderIconProps = {}): JSX.Element {
	// Default to currentColor for consistent theming
	const defaultProps: ProviderIconProps = {
		useCurrentColor: true,
		...props
	};
	
	return getProviderIconComponent(provider, defaultProps);
}

/**
 * Get model characteristic icon as JSX component
 * 
 * @param type - Characteristic type ('speed', 'cost', 'intelligence')
 * @param value - Characteristic value (e.g., 'fast', 'medium', 'low')
 * @param props - Icon props including className, aria-label, style, and useCurrentColor
 * @returns JSX Element
 * 
 * @example
 * ```tsx
 * // Speed indicators
 * const fastIcon = getCharacteristicIcon('speed', 'fast');
 * const mediumSpeedIcon = getCharacteristicIcon('speed', 'medium');
 * const slowIcon = getCharacteristicIcon('speed', 'slow');
 * 
 * // Cost indicators
 * const lowCostIcon = getCharacteristicIcon('cost', 'low');
 * const highCostIcon = getCharacteristicIcon('cost', 'high');
 * 
 * // Intelligence indicators
 * const highIntelIcon = getCharacteristicIcon('intelligence', 'high');
 * const veryHighIntelIcon = getCharacteristicIcon('intelligence', 'very-high');
 * 
 * // With theme colors
 * const themedIcon = getCharacteristicIcon('speed', 'fast', { useCurrentColor: true });
 * ```
 */
export function getCharacteristicIcon(
	type: 'speed' | 'cost' | 'intelligence',
	value: string,
	props: CharacteristicIconProps = {}
): JSX.Element {
	// Default to original colors for characteristics unless specified
	const defaultProps: CharacteristicIconProps = {
		useCurrentColor: false,
		...props
	};
	
	return getCharacteristicIconComponent(type, value, defaultProps);
}

/**
 * Get model role icon as JSX component
 * 
 * @param role - Model role ('orchestrator', 'agent', 'chat')
 * @param props - Icon props including className, aria-label, style, and useCurrentColor
 * @returns JSX Element
 * 
 * @example
 * ```tsx
 * // Role icons with default styling (currentColor)
 * const orchestratorIcon = getControllerRoleIcon('orchestrator');
 * const agentIcon = getControllerRoleIcon('agent');
 * const chatIcon = getControllerRoleIcon('chat');
 * 
 * // With custom styling
 * const orchestratorStyled = getControllerRoleIcon('orchestrator', { 
 *   className: 'w-5 h-5 text-purple-600',
 *   'aria-label': 'Orchestrator model'
 * });
 * 
 * // With brand colors
 * const orchestratorBranded = getControllerRoleIcon('orchestrator', { useCurrentColor: false });
 * ```
 */
export function getControllerRoleIcon(
	role: 'orchestrator' | 'agent' | 'chat',
	props: ControllerRoleIconProps = {}
): JSX.Element {
	return getControllerRoleIconComponent(role, props);
}



/**
 * Utility to get all available providers
 * 
 * @returns Array of provider names
 */
export function getAvailableProviders(): string[] {
	return ['anthropic', 'openai', 'google', 'deepseek', 'ollama', 'groq'];
}

/**
 * Utility to get all available characteristic types and values
 * 
 * @returns Object mapping characteristic types to their possible values
 */
export function getAvailableCharacteristics(): Record<string, string[]> {
	return {
		speed: ['fast', 'medium', 'slow'],
		cost: ['low', 'medium', 'high', 'very-high'],
		intelligence: ['medium', 'high', 'very-high']
	};
}

/**
 * Utility to get all available model roles
 * 
 * @returns Array of model role names
 */
export function getAvailableModelRoles(): string[] {
	return ['orchestrator', 'agent', 'chat'];
}

// Re-export individual components for direct access if needed
export { 
	// Provider icons
	AnthropicIcon,
	OpenAIIcon,
	GoogleIcon,
	DeepSeekIcon,
	OllamaIcon,
	GroqIcon,
	GenericAIIcon,
	
	// Characteristic icons
	FastSpeedIcon,
	MediumSpeedIcon,
	SlowSpeedIcon,
	LowCostIcon,
	MediumCostIcon,
	HighCostIcon,
	VeryHighCostIcon,
	MediumIntelligenceIcon,
	HighIntelligenceIcon,
	VeryHighIntelligenceIcon,
	
	// Model role icons
	OrchestratorIcon,
	AgentIcon,
	ChatIcon,
};