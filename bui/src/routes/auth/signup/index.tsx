import { PageProps } from '$fresh/server.ts';
//import { Handlers } from '$fresh/server.ts';
import SignupContent from '../../../islands/auth/SignupContent.tsx';
//import { useAuthState } from '../../../hooks/useAuthState.ts';

/*************
 * Use the POST handler if SignupForm is sending a traditional POST request
 * But we want error handling, password validation and other island behaviour
 * so SignupForm is calling signUp directly
 * leaving the POST handler for legacy reference - in case we need traditional behaviour for "dumb" clients
 *************/

// export const handler: Handlers = {
// 	async POST(req) {
// 		const { signUp } = useAuthState();
//
// 		const form = await req.formData();
// 		const email = form.get('email')?.toString();
// 		const password = form.get('password')?.toString();
//
// 		const resp = new Response(null, {
// 			headers: {
// 				location: `/auth/check-email?email=${encodeURIComponent(email)}`,
// 			},
// 			status: 302,
// 		});
//
// 		try {
// 			await signUp(req, resp, email, password);
// 		} catch (error) {
// 			return new Response(null, {
// 				headers: {
// 					location: '/auth/signup?message=Error signing up',
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

export default function SignupPage(_props: PageProps) {
	return (
		<div class='h-screen flex flex-col flex-1 overflow-hidden'>
			<div class='flex-1 flex flex-col overflow-hidden'>
				<SignupContent />
			</div>
		</div>
	);
}
