import type { AuthUser } from 'shared/types/auth.ts';
import type { CollaborationId, InteractionId, ProjectId } from 'shared/types.ts';

/**
 * User context information for request processing
 * Note: This interface uses `any` for userAuthSession to avoid circular dependencies.
 * The actual type is UserAuthSession from 'api/auth/userAuthSession.ts'
 */
export interface UserContext {
	userId: string;
	user: AuthUser;
	// Using any here to break circular dependency - actual type is UserAuthSession
	// deno-lint-ignore no-explicit-any
	userAuthSession: any;
	projectId?: ProjectId;
	collaborationId?: CollaborationId;
	interactionId?: InteractionId;
}
