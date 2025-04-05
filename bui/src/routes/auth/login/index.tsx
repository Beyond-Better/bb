import { PageProps } from '$fresh/server.ts';
//import { Handlers } from '$fresh/server.ts';
import LoginContent from '../../../islands/auth/LoginContent.tsx';
//import { useAuthState } from '../../../hooks/useAuthState.ts';

/*************
 * Use the POST handler if LoginForm is sending a traditional POST request
 * But we want error handling and other island behaviour
 * so LoginForm is calling signIn directly
 * leaving the POST handler for legacy reference - in case we need traditional behaviour for "dumb" clients
 *************/

// export const handler: Handlers = {
// 	async POST(req) {
// 		const { signIn } = useAuthState();
//
// 		// Get redirectTo from URL parameters
// 		const redirectTo = new URL(req.url).searchParams.get('redirect') || '/app/home';
// 		const resp = new Response(null, {
// 			headers: {
// 				location: redirectTo,
// 			},
// 			status: 302,
// 		});
//
// 		const form = await req.formData();
// 		const email = form.get('email')?.toString();
// 		const password = form.get('password')?.toString();
//
// 		try {
// 			await signIn(req, resp, email, password);
// 		} catch (error) {
// 			return new Response(null, {
// 				headers: {
// 					location: '/auth/login?message=Error signing up',
// 				},
// 				status: 302,
// 			});
// 		}
//
// 		return resp;
// 	},
// };

/*************
 * Passing authState as a component property so we can cross the server/island barrier
 *************/

export default function LoginPage(_props: PageProps) {
	return (
		<div class='flex flex-col flex-1 overflow-y-auto'>
			<div class='flex-1 flex flex-col'>
				<LoginContent />
			</div>
		</div>
	);
}
