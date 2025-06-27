// Main collaboration classes
export { default as Collaboration } from './collaboration.ts';
export { default as CollaborationManager } from './collaborationManager.ts';

// Manager utilities
export { collaborationManager, createCollaborationManager, getCollaborationManager } from './collaborationManager.ts';

// Re-export types for convenience
export type {
	Collaboration as CollaborationLegacy,
	CollaborationCreateOptions,
	CollaborationInterface,
	CollaborationParams,
	CollaborationSummary,
	StatementParams,
} from 'shared/types/collaboration.types.ts';
