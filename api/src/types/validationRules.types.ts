/**
 * Complex validation rules framework for model capabilities
 * Supports conditional logic, parameter constraints, and feature dependencies
 */

/**
 * Condition operators for rule evaluation
 */
export type ConditionOperator =
	| 'equals'
	| 'not_equals'
	| 'contains'
	| 'not_contains'
	| 'matches_pattern'
	| 'in'
	| 'not_in'
	| 'greater_than'
	| 'less_than'
	| 'greater_equal'
	| 'less_equal';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

/**
 * Basic condition for rule evaluation
 */
export interface ValidationCondition {
	/** Field to evaluate (e.g., 'model', 'extendedThinking.enabled', 'temperature') */
	field: string;
	/** Operator to use for comparison */
	operator: ConditionOperator;
	/** Value to compare against */
	value: string | number | boolean | Array<string | number | boolean>;
	/** Optional description for debugging/UI display */
	description?: string;
}

/**
 * Complex condition that can combine multiple conditions with logical operators
 */
export interface ValidationConditionGroup {
	/** Logical operator to combine conditions */
	logic: LogicalOperator;
	/** List of conditions or nested condition groups */
	conditions: Array<ValidationCondition | ValidationConditionGroup>;
	/** Optional description for debugging/UI display */
	description?: string;
}

/**
 * Action types that can be applied when a rule matches
 */
export type ValidationAction =
	| 'set_value' // Force a parameter to a specific value
	| 'set_constraint' // Apply min/max constraints to a parameter
	| 'disable_feature' // Disable a feature/parameter
	| 'enable_feature' // Enable a feature/parameter
	| 'show_warning' // Display a warning message
	| 'show_error' // Display an error message and prevent submission
	| 'suggest_value' // Suggest a value without forcing it
	| 'require_feature'; // Require another feature to be enabled

/**
 * Action to take when a validation rule matches
 */
export interface ValidationRuleAction {
	/** Type of action to take */
	action: ValidationAction;
	/** Target field/parameter for the action */
	target: string;
	/** Value or constraint to apply */
	value?: string | number | boolean | { min?: number; max?: number };
	/** Message to display to user */
	message?: string;
	/** Severity level for UI display */
	severity?: 'info' | 'warning' | 'error';
	/** Whether this action blocks form submission */
	blocking?: boolean;
}

/**
 * Complete validation rule with conditions and actions
 */
export interface ValidationRule {
	/** Unique identifier for the rule */
	id: string;
	/** Human-readable name for the rule */
	name: string;
	/** Description of what this rule does */
	description?: string;
	/** When this rule should be evaluated (e.g., 'on_change', 'on_submit') */
	trigger: 'on_change' | 'on_submit' | 'on_load';
	/** Priority for rule execution (higher numbers execute first) */
	priority?: number;
	/** Condition(s) that must be met for this rule to apply */
	condition: ValidationCondition | ValidationConditionGroup;
	/** Action(s) to take when the rule matches */
	actions: ValidationRuleAction[];
	/** Whether this rule is currently active */
	enabled?: boolean;
	/** Tags for categorizing rules */
	tags?: string[];
}

/**
 * Collection of validation rules for a specific context
 */
export interface ValidationRuleSet {
	/** Unique identifier for this rule set */
	id: string;
	/** Name of the rule set */
	name: string;
	/** Description of the rule set */
	description?: string;
	/** Version of the rule set for compatibility */
	version: string;
	/** Context where these rules apply (e.g., 'chat_input', 'model_config') */
	context: string;
	/** List of validation rules */
	rules: ValidationRule[];
	/** Metadata for the rule set */
	metadata?: {
		createdAt: string;
		updatedAt: string;
		author?: string;
		[key: string]: unknown;
	};
}

/**
 * Result of rule evaluation
 */
export interface ValidationResult {
	/** Whether validation passed */
	valid: boolean;
	/** List of triggered rules */
	triggeredRules: Array<{
		ruleId: string;
		ruleName: string;
		actions: ValidationRuleAction[];
	}>;
	/** Aggregated messages by severity */
	messages: {
		info: string[];
		warnings: string[];
		errors: string[];
	};
	/** Computed constraints for parameters */
	constraints: Record<string, {
		min?: number;
		max?: number;
		allowedValues?: Array<string | number | boolean>;
		disallowedValues?: Array<string | number | boolean>;
		required?: boolean;
		disabled?: boolean;
	}>;
	/** Suggested values for parameters */
	suggestions: Record<string, string | number | boolean>;
	/** Whether form submission should be blocked */
	blockSubmission: boolean;
}

/**
 * Context data for rule evaluation
 */
export interface ValidationContext {
	/** Current model ID */
	model: string;
	/** Current model capabilities */
	modelCapabilities: import('./modelCapabilities.types.ts').ModelCapabilities;
	/** Current parameter values */
	parameters: Record<string, unknown>;
	/** Additional context data */
	[key: string]: unknown;
}

/**
 * Configuration for the validation engine
 */
export interface ValidationEngineConfig {
	/** Whether to enable debug logging */
	debug?: boolean;
	/** Maximum recursion depth for nested conditions */
	maxRecursionDepth?: number;
	/** Whether to continue evaluation after first error */
	continueOnError?: boolean;
	/** Custom condition evaluators */
	customEvaluators?: Record<string, (condition: ValidationCondition, context: ValidationContext) => boolean>;
}
