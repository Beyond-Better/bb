export class AgentCapabilityManager {
	private availableCapabilities: Set<string>;

	constructor() {
		this.availableCapabilities = new Set([
			'code_analysis',
			'natural_language_processing',
			'data_visualization',
			'math_computation',
			// Add other capabilities as needed
		]);
	}

	hasCapability(capability: string): boolean {
		return this.availableCapabilities.has(capability);
	}

	addCapability(capability: string): void {
		this.availableCapabilities.add(capability);
	}

	removeCapability(capability: string): void {
		this.availableCapabilities.delete(capability);
	}

	listCapabilities(): string[] {
		return Array.from(this.availableCapabilities);
	}
}
