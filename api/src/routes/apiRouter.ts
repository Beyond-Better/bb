import { Router } from '@oak/oak';
//import type { Context } from '@oak/oak';
import {
	chatConversation,
	clearConversation,
	deleteConversation,
	getConversation,
	listConversations,
} from './api/conversation.handlers.ts';
import { websocketConversation } from './api/websocket.handlers.ts';
import { suggestFiles } from './api/file.handlers.ts';
import { getStatus } from './api/status.handlers.ts';
import { logEntryFormatter } from './api/logEntryFormatter.handlers.ts';
import { setupProject } from './api/project.handlers.ts';
import { upgradeApi } from './api/upgrade.handlers.ts';

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
	.post('/v1/setup_project', setupProject)
	// File suggestion endpoint
	.post('/v1/files/suggest', suggestFiles)
	/**
	 * @openapi
	 * /api/v1/upgrade:
	 *   post:
	 *     summary: Upgrade BB to the latest version
	 *     description: |
	 *       Upgrades BB to the latest version. Only works with user-local installations.
	 *       System-wide installations require manual upgrade with sudo.
	 *     responses:
	 *       200:
	 *         description: Upgrade successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 currentVersion:
	 *                   type: string
	 *                   example: '1.0.0'
	 *                 latestVersion:
	 *                   type: string
	 *                   example: '1.1.0'
	 *                 needsRestart:
	 *                   type: boolean
	 *                   example: true
	 *       403:
	 *         description: System-wide installation requires sudo
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: false
	 *                 error:
	 *                   type: string
	 *                   example: 'System-wide installation requires manual upgrade with sudo'
	 *                 needsSudo:
	 *                   type: boolean
	 *                   example: true
	 *       500:
	 *         description: Upgrade failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: false
	 *                 error:
	 *                   type: string
	 *                   example: 'Failed to download latest version'
	 */
	.post('/v1/upgrade', upgradeApi);

/*
	// NOT IMPLEMENTED
	// Logs endpoint
	.get('/v1/logs', getLogs)
	// Persistence endpoints
	.post('/v1/persist', persistConversation)
	.post('/v1/resume', resumeConversation)
 */

export default apiRouter;
