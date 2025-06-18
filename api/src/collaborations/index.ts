// Main collaboration classes
export { default as Collaboration } from './collaboration.ts';
export { default as CollaborationManager } from './collaborationManager.ts';

// Manager utilities
export {
	createCollaborationManager,
	getCollaborationManager,
	collaborationManager,
} from './collaborationManager.ts';

// Re-export types for convenience
export type {
	CollaborationInterface,
	Collaboration as CollaborationLegacy,
	CollaborationParams,
	StatementParams,
	CollaborationCreateOptions,
	CollaborationSummary,
} from 'shared/types/collaboration.types.ts';