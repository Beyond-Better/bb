import type { SessionManager } from '../auth/session.ts';
import type { Session } from './auth.ts';

export interface BbState {
	//llmWorker: LLMWorkerService;
	//services: {llmWorker: LLMWorkerService};
	auth: {
		sessionManager: SessionManager;
	};
	session?: Session;
}
