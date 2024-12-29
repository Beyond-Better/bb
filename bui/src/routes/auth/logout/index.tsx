import { PageProps } from '$fresh/server.ts';
import { Handlers } from '$fresh/server.ts';
import { useAuthState } from '../../../hooks/useAuthState.ts';

export const handler: Handlers = {
	async GET(req) {
		const { signOut } = useAuthState();

		const resp = new Response(null, {
			headers: {
				location: `/`,
			},
			status: 302,
		});

		try {
			await signOut(req, resp);
		} catch (error) {
			return new Response(null, {
				headers: {
					location: '/',
				},
				status: 302,
			});
		}

		return resp;
	},
};
