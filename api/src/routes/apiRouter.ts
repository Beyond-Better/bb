import { Router } from '@oak/oak';
import type { Context } from '@oak/oak';
import {
	chatConversation,
	clearConversation,
	deleteConversation,
	getConversation,
	listConversations,
} from './api/conversation.handlers.ts';
import { websocketConversation } from './api/websocket.handlers.ts';
import { getStatus } from './api/status.handlers.ts';
import { logEntryFormatter } from './api/logEntryFormatter.handlers.ts';
import { setupProject } from './api/project.handlers.ts';

const apiRouter = new Router();

apiRouter
	.get('/v1/status', getStatus)
	// Conversation endpoints
	.get('/v1/ws/conversation/:id', websocketConversation)
	.get('/v1/conversation', listConversations)
	.get('/v1/conversation/:id', getConversation)
	.post('/v1/conversation/:id', chatConversation)
	.delete('/v1/conversation/:id', deleteConversation)
	.post('/v1/conversation/:id/clear', clearConversation)
	// Log Entries endpoints
	.post('/v1/format_log_entry/:logEntryDestination/:logEntryFormatterType', logEntryFormatter)
	// File handling endpoints
	.post('/v1/setup_project', setupProject);

/*
	// NOT IMPLEMENTED
	// Logs endpoint
	.get('/v1/logs', getLogs)
	// Persistence endpoints
	.post('/v1/persist', persistConversation)
	.post('/v1/resume', resumeConversation)
 */

export default apiRouter;
