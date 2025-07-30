import { Router } from '@oak/oak';
import {
	handleGoogleConfig,
	handleGoogleToken,
} from './oauth.handlers.ts';

const router = new Router();

/**
 * @openapi
 * /api/v1/oauth/google/config:
 *   get:
 *     summary: Get Google OAuth configuration
 *     description: Returns OAuth configuration including client ID, scopes, and redirect URI for Google OAuth flow
 *     responses:
 *       200:
 *         description: OAuth configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   description: Google OAuth2 client ID
 *                 scopes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Required OAuth2 scopes
 *                 redirectUri:
 *                   type: string
 *                   description: OAuth2 redirect URI
 *       500:
 *         description: Server error
 */
router.get('/google/config', handleGoogleConfig);

/**
 * @openapi
 * /api/v1/oauth/google/token:
 *   post:
 *     summary: Exchange authorization code for tokens
 *     description: Exchanges the authorization code received from Google OAuth callback for access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from Google OAuth callback
 *               state:
 *                 type: string
 *                 description: Optional state parameter for CSRF protection
 *     responses:
 *       200:
 *         description: Token exchange successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Google OAuth2 access token
 *                 refreshToken:
 *                   type: string
 *                   description: Google OAuth2 refresh token
 *                 expiresAt:
 *                   type: number
 *                   description: Token expiration timestamp
 *                 tokenType:
 *                   type: string
 *                   description: Token type (typically 'Bearer')
 *                 scope:
 *                   type: string
 *                   description: Granted scopes
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                     message:
 *                       type: string
 *                     reason:
 *                       type: string
 *       500:
 *         description: Server error
 */
router.post('/google/token', handleGoogleToken);

export default router;