/**
 * Validation Engine for Model Capabilities
 * Evaluates complex validation rules for UI parameter constraints
 */

import { logger } from 'shared/logger.ts';
import type {
	ConditionOperator,
	ValidationCondition,
	ValidationConditionGroup,
	ValidationContext,
	ValidationEngineConfig,
	ValidationResult,
	ValidationRule,
	ValidationRuleAction,
	ValidationRuleSet,
	//LogicalOperator,
} from 'api/types/validationRules.ts';

/**
 * Engine for evaluating validation rules
 */
export class ValidationEngine {
	private config: ValidationEngineConfig;
	private debug: boolean;

	constructor(config: ValidationEngineConfig = {}) {
		this.config = {
			debug: false,
			maxRecursionDepth: 10,
			continueOnError: true,
			...config,
		};
		this.debug = this.config.debug || false;
	}

	/**
	 * Evaluate a rule set against a validation context
	 */
	public evaluateRuleSet(
		ruleSet: ValidationRuleSet,
		context: ValidationContext,
		trigger: 'on_change' | 'on_submit' | 'on_load' = 'on_change',
	): ValidationResult {
		if (this.debug) {
			logger.info(`ValidationEngine: Evaluating rule set "${ruleSet.name}" with trigger "${trigger}"`);
		}

		const result: ValidationResult = {
			valid: true,
			triggeredRules: [],
			messages: {
				info: [],
				warnings: [],
				errors: [],
			},
			constraints: {},
			suggestions: {},
			blockSubmission: false,
		};

		// Filter rules by trigger and enabled status
		const applicableRules = ruleSet.rules
			.filter((rule: ValidationRule) => rule.enabled !== false)
			.filter((rule: ValidationRule) => rule.trigger === trigger)
			.sort((a: ValidationRule, b: ValidationRule) => (b.priority || 0) - (a.priority || 0)); // Sort by priority (highest first)

		if (this.debug) {
			logger.info(`ValidationEngine: Found ${applicableRules.length} applicable rules`);
		}

		// Evaluate each rule
		for (const rule of applicableRules) {
			try {
				const ruleMatches = this.evaluateRule(rule, context);

				if (ruleMatches) {
					if (this.debug) {
						logger.info(`ValidationEngine: Rule "${rule.name}" (${rule.id}) matched`);
					}

					// Apply rule actions
					this.applyRuleActions(rule, result);

					result.triggeredRules.push({
						ruleId: rule.id,
						ruleName: rule.name,
						actions: rule.actions,
					});
				}
			} catch (error) {
				logger.error(
					`ValidationEngine: Error evaluating rule "${rule.id}": ${
						error instanceof Error ? error.message : error
					}`,
				);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		// Update overall validity
		result.valid = result.messages.errors.length === 0 && !result.blockSubmission;

		if (this.debug) {
			logger.info(
				`ValidationEngine: Evaluation complete. Valid: ${result.valid}, Triggered rules: ${result.triggeredRules.length}`,
			);
		}

		return result;
	}

	/**
	 * Evaluate a single rule against the context
	 */
	private evaluateRule(rule: ValidationRule, context: ValidationContext): boolean {
		try {
			return this.evaluateCondition(rule.condition, context, 0);
		} catch (error) {
			logger.error(
				`ValidationEngine: Error evaluating condition for rule "${rule.id}": ${
					error instanceof Error ? error.message : error
				}`,
			);
			return false;
		}
	}

	/**
	 * Evaluate a condition or condition group
	 */
	private evaluateCondition(
		condition: ValidationCondition | ValidationConditionGroup,
		context: ValidationContext,
		depth: number,
	): boolean {
		if (depth > (this.config.maxRecursionDepth || 10)) {
			throw new Error('Maximum recursion depth exceeded in condition evaluation');
		}

		// Check if it's a condition group
		if ('logic' in condition) {
			return this.evaluateConditionGroup(condition, context, depth + 1);
		}

		// It's a simple condition
		return this.evaluateSimpleCondition(condition, context);
	}

	/**
	 * Evaluate a condition group with logical operators
	 */
	private evaluateConditionGroup(
		group: ValidationConditionGroup,
		context: ValidationContext,
		depth: number,
	): boolean {
		const results = group.conditions.map((condition) => this.evaluateCondition(condition, context, depth));

		switch (group.logic) {
			case 'AND':
				return results.every((result: boolean) => result === true);
			case 'OR':
				return results.some((result: boolean) => result === true);
			case 'NOT':
				// For NOT, we expect exactly one condition
				if (results.length !== 1) {
					throw new Error('NOT operator requires exactly one condition');
				}
				return !results[0];
			default:
				throw new Error(`Unknown logical operator: ${group.logic}`);
		}
	}

	/**
	 * Evaluate a simple condition
	 */
	private evaluateSimpleCondition(condition: ValidationCondition, context: ValidationContext): boolean {
		const fieldValue = this.getFieldValue(condition.field, context);

		if (this.debug) {
			logger.info(
				`ValidationEngine: Evaluating condition: ${condition.field} ${condition.operator} ${
					JSON.stringify(condition.value)
				} (actual: ${JSON.stringify(fieldValue)})`,
			);
		}

		// Check for custom evaluators
		if (this.config.customEvaluators && this.config.customEvaluators[condition.operator]) {
			return this.config.customEvaluators[condition.operator](condition, context);
		}

		return this.evaluateOperator(fieldValue, condition.operator, condition.value);
	}

	/**
	 * Get field value from context using dot notation
	 */
	private getFieldValue(fieldPath: string, context: ValidationContext): unknown {
		const parts = fieldPath.split('.');
		let value: unknown = context;

		for (const part of parts) {
			if (value && typeof value === 'object' && part in value) {
				value = (value as Record<string, unknown>)[part];
			} else {
				return undefined;
			}
		}

		return value;
	}

	/**
	 * Evaluate an operator against field value and condition value
	 */
	private evaluateOperator(
		fieldValue: unknown,
		operator: ConditionOperator,
		conditionValue: string | number | boolean | Array<string | number | boolean>,
	): boolean {
		switch (operator) {
			case 'equals':
				return fieldValue === conditionValue;

			case 'not_equals':
				return fieldValue !== conditionValue;

			case 'contains':
				if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
					return fieldValue.includes(conditionValue);
				}
				if (Array.isArray(fieldValue)) {
					return fieldValue.includes(conditionValue);
				}
				return false;

			case 'not_contains':
				if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
					return !fieldValue.includes(conditionValue);
				}
				if (Array.isArray(fieldValue)) {
					return !fieldValue.includes(conditionValue);
				}
				return true;

			case 'matches_pattern':
				if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
					const regex = new RegExp(conditionValue);
					return regex.test(fieldValue);
				}
				return false;

			case 'in':
				if (Array.isArray(conditionValue)) {
					return conditionValue.includes(fieldValue as string | number | boolean);
				}
				return false;

			case 'not_in':
				if (Array.isArray(conditionValue)) {
					return !conditionValue.includes(fieldValue as string | number | boolean);
				}
				return true;

			case 'greater_than':
				if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
					return fieldValue > conditionValue;
				}
				return false;

			case 'less_than':
				if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
					return fieldValue < conditionValue;
				}
				return false;

			case 'greater_equal':
				if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
					return fieldValue >= conditionValue;
				}
				return false;

			case 'less_equal':
				if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
					return fieldValue <= conditionValue;
				}
				return false;

			default:
				throw new Error(`Unknown operator: ${operator}`);
		}
	}

	/**
	 * Apply actions from a matched rule to the result
	 */
	private applyRuleActions(rule: ValidationRule, result: ValidationResult): void {
		for (const action of rule.actions) {
			try {
				this.applyRuleAction(action, result);
			} catch (error) {
				logger.error(
					`ValidationEngine: Error applying action for rule "${rule.id}": ${
						error instanceof Error ? error.message : error
					}`,
				);
			}
		}
	}

	/**
	 * Apply a single rule action
	 */
	private applyRuleAction(action: ValidationRuleAction, result: ValidationResult): void {
		switch (action.action) {
			case 'set_value':
				if (action.value !== undefined) {
					result.suggestions[action.target] = action.value as string | number | boolean;
				}
				break;

			case 'set_constraint':
				if (typeof action.value === 'object' && action.value !== null) {
					const constraint = action.value as { min?: number; max?: number };
					result.constraints[action.target] = {
						...result.constraints[action.target],
						...constraint,
					};
				}
				break;

			case 'disable_feature':
				result.constraints[action.target] = {
					...result.constraints[action.target],
					disabled: true,
				};
				break;

			case 'enable_feature':
				result.constraints[action.target] = {
					...result.constraints[action.target],
					disabled: false,
					required: true,
				};
				break;

			case 'require_feature':
				result.constraints[action.target] = {
					...result.constraints[action.target],
					required: true,
				};
				break;

			case 'show_warning':
			case 'show_error':
				if (action.message) {
					const severity = action.severity ||
						(action.action === 'show_error'
							? 'error'
							: action.action === 'show_warning'
							? 'warning'
							: 'info');
					result.messages[severity === 'error' ? 'errors' : severity === 'warning' ? 'warnings' : 'info']
						.push(action.message);

					if (action.blocking || severity === 'error') {
						result.blockSubmission = true;
					}
				}
				break;

			case 'suggest_value':
				if (action.value !== undefined) {
					result.suggestions[action.target] = action.value as string | number | boolean;
				}
				if (action.message) {
					result.messages.info.push(action.message);
				}
				break;

			default:
				logger.warn(`ValidationEngine: Unknown action type: ${action.action}`);
		}
	}

	/**
	 * Create a validation context from model and parameters
	 */
	public static createContext(
		model: string,
		modelCapabilities: import('api/types/modelCapabilities.ts').ModelCapabilities,
		parameters: Record<string, unknown>,
		additionalContext: Record<string, unknown> = {},
	): ValidationContext {
		return {
			model,
			modelCapabilities,
			parameters,
			...additionalContext,
		};
	}
}
