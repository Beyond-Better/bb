import { PageProps } from '$fresh/server.ts';
import UpdatePasswordContent from '../../../islands/auth/UpdatePasswordContent.tsx';

export default function UpdatePasswordPage(_props: PageProps) {
	return (
		<div class='flex flex-col flex-1 overflow-y-auto'>
			<div class='flex-1 flex flex-col'>
				<UpdatePasswordContent />
			</div>
		</div>
	);
}