import { PageProps } from '$fresh/server.ts';
import ForgotPasswordContent from '../../../islands/auth/ForgotPasswordContent.tsx';

export default function ForgotPasswordPage(_props: PageProps) {
	return (
		<div class='flex flex-col flex-1 overflow-y-auto'>
			<div class='flex-1 flex flex-col'>
				<ForgotPasswordContent />
			</div>
		</div>
	);
}
