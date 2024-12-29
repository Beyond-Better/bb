import { PageProps } from '$fresh/server.ts';
import VerifyContent from '../../../islands/auth/VerifyContent.tsx';
import { useAuthState } from '../../../hooks/useAuthState.ts';

// export const handler: Handlers = {
// 	async GET(req) {
// 		const { verifyOtp } = useAuthState();
// 		console.log('VerifyEmail');
// 
// 		const { searchParams } = new URL(req.url);
// 		//const code = searchParams.get('code');
// 		const tokenHash = searchParams.get('token_hash');
// 		const type = searchParams.get('type') as EmailOtpType | null;
// 		const next = searchParams.get('next') ?? '/app/home';
// 
// 		const resp = new Response(null, {
// 			headers: {
// 				location: next,
// 			},
// 			status: 302,
// 		});
// 
// 		try {
// 			//console.log('VerifyEmail: ', tokenHash, type);
// 			//const data = await verifyOtp(req, resp, code, 'email');
// 			const data = await verifyOtp(req, resp, tokenHash, type);
// 			//console.log('VerifyEmail: data[after getUser]', data);
// 
// 			if (data.user) {
// 				return resp;
// 			} else {
// 				return new Response(null, {
// 					headers: {
// 						location: '/auth/login',
// 					},
// 					status: 302,
// 				});
// 			}
// 		} catch (error) {
// 			return new Response(null, {
// 				headers: {
// 					location: '/auth/login',
// 				},
// 				status: 302,
// 			});
// 		}
// 
// 		return resp;
// 	},
// };

export default function VerifyPage(props: PageProps) {
	const { authState } = useAuthState();
	return (
		<div class='h-screen flex flex-col flex-1 overflow-hidden'>
			<div class='flex-1 flex flex-col overflow-hidden'>
				<VerifyContent authState={authState} />
			</div>
		</div>
	);
}
