import { Router } from '@oak/oak';
import {
	addMCPServer,
	connectMCPServer,
	generateAuthorizationUrl,
	getOAuthConfig,
	getServerStatus,
	handleOAuthCallback,
	listMCPServers,
	performClientCredentialsFlow,
	refreshAccessToken,
	removeMCPServer,
	testServerConnection,
	updateMCPServer,
} from './mcp.handlers.ts';

const mcpRouter = new Router();

mcpRouter
	// Server management endpoints
	.get('/servers', listMCPServers)
	.post('/servers', addMCPServer)
	.put('/servers/:serverId', updateMCPServer)
	.delete('/servers/:serverId', removeMCPServer)
	.post('/servers/:serverId/connect', connectMCPServer)
	// OAuth Authorization Code Flow endpoints
	.post('/servers/:serverId/authorize', generateAuthorizationUrl)
	.post('/servers/:serverId/callback', handleOAuthCallback)
	// OAuth Client Credentials Flow endpoint
	.post('/servers/:serverId/client-credentials', performClientCredentialsFlow)
	// Token management
	.post('/servers/:serverId/refresh', refreshAccessToken)
	// Server status and testing
	.get('/servers/:serverId/status', getServerStatus)
	.post('/servers/:serverId/test', testServerConnection)
	// OAuth configuration status
	.get('/servers/:serverId/oauth-config', getOAuthConfig);

export default mcpRouter;
