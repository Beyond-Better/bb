import type { UserAuthSession } from 'api/auth/userAuthSession.ts';
import type { Session } from 'api/types/auth.ts';
import type { UserContext } from 'shared/types/app.ts';
import type { ApiConfig } from 'shared/config/types.ts';

export interface BbState {
	//llmWorker: LLMWorkerService;
	//services: {llmWorker: LLMWorkerService};
	apiConfig: ApiConfig;
	auth: {
		userAuthSession: UserAuthSession;
		userId: string | null; // Real userId for middleware to use (null if no user logged in)
	};
	session?: Session; // TODO: Rename to 'userSession' or 'authSession' in future refactor
	userContext?: UserContext; // TODO: Use for migration away from direct userAuthSession usage
	localMode?: boolean;
}
