import { useState } from 'preact/hooks';

interface ResendVerificationEmailProps {
	email: string;
}

export default function ResendVerificationEmail(
	{ email }: ResendVerificationEmailProps,
) {
	const [isResending, setIsResending] = useState(false);
	const [message, setMessage] = useState<
		{ text: string; type: 'success' | 'error' } | null
	>(null);

	async function handleResendEmail() {
		if (isResending) return;

		setIsResending(true);
		setMessage(null);

		try {
			const { getSupabaseClient } = await import('../utils/supabase.ts');
			const supabase = await getSupabaseClient();
			await supabase.auth.resend({
				type: 'signup',
				email,
				options: {
					emailRedirectTo: `${globalThis.location.origin}/auth/verify`,
				},
			});
			setMessage({
				text: 'Verification email resent. Please check your inbox.',
				type: 'success',
			});
		} catch (error) {
			console.error('Error resending verification email:', error);
			setMessage({
				text: 'Failed to resend verification email. Please try again.',
				type: 'error',
			});
		} finally {
			setIsResending(false);
		}
	}

	return (
		<div className='p-4 bg-brand-lightBlue rounded-md text-sm text-gray-700'>
			<p>
				<strong>Can't find the email?</strong>{' '}
				Check your spam folder or click the button below to request a new verification email.
			</p>

			{message && (
				<div
					className={`mt-2 p-2 rounded-md ${
						message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
					}`}
				>
					{message.text}
				</div>
			)}

			<button
				type='button'
				className={`mt-4 px-4 py-2 ${
					isResending ? 'bg-gray-400' : 'bg-brand-blue hover:bg-brand-green'
				} text-white rounded-md transition-colors`}
				onClick={handleResendEmail}
				disabled={isResending}
			>
				{isResending ? 'Sending...' : 'Resend verification email'}
			</button>
		</div>
	);
}
