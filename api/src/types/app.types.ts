import type { SessionManager } from 'api/auth/session.ts';
import type { Session } from './auth.ts';
import type { ApiConfig } from 'shared/config/types.ts';

export interface BbState {
	//llmWorker: LLMWorkerService;
	//services: {llmWorker: LLMWorkerService};
	apiConfig: ApiConfig;
	auth: {
		sessionManager: SessionManager;
	};
	session?: Session;
}
