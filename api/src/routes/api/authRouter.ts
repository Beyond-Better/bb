import { Router } from '@oak/oak';
import {
	handleCallback,
	handleCheckEmailVerification,
	handleLogin,
	handleLogout,
	handleResendVerification,
	handleSignup,
	handleStatus,
} from './auth.handlers.ts';

const router = new Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Authenticate user
 *     description: Authenticate user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Invalid request
 */
router.post('/login', handleLogin);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: End user session
 *     description: Log out the current user and clear their session
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/logout', handleLogout);

/**
 * @openapi
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register new user
 *     description: Register a new user and send verification email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signup successful, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       401:
 *         description: Signup failed
 *       400:
 *         description: Invalid request
 */
router.post('/signup', handleSignup);

/**
 * @openapi
 * /api/v1/auth/session:
 *   get:
 *     summary: Get session status
 *     description: Check if user is authenticated and get session details
 *     responses:
 *       200:
 *         description: Session status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 session:
 *                   type: object
 *                   nullable: true
 */
router.get('/session', handleStatus);

/**
 * @openapi
 * /api/v1/auth/callback:
 *   post:
 *     summary: Handle OAuth callback
 *     description: Complete OAuth authentication flow
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   type: object
 *       400:
 *         description: Missing authorization code
 *       401:
 *         description: Invalid authorization code
 */
router.post('/callback', handleCallback);

/**
 * @openapi
 * /api/v1/auth/check-email-verification:
 *   post:
 *     summary: Check email verification status
 *     description: Check if an email address is verified using Supabase edge function
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/check-email-verification', handleCheckEmailVerification);

/**
 * @openapi
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     description: Resend a verification email to the specified address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [signup, recovery, invite]
 *               options:
 *                 type: object
 *                 properties:
 *                   emailRedirectTo:
 *                     type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/resend-verification', handleResendVerification);

export default router;
