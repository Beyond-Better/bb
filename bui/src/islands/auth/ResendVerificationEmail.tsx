import { useState } from 'preact/hooks';
import { useAuthState } from '../../hooks/useAuthState.ts';

interface ResendVerificationEmailProps {
	email: string;
}

export default function ResendVerificationEmail(
	{ email }: ResendVerificationEmailProps,
) {
	const { resendVerificationEmail } = useAuthState();
	const [isResending, setIsResending] = useState(false);
	const [message, setMessage] = useState<
		{ text: string; type: 'success' | 'error' } | null
	>(null);

	async function handleResendEmail() {
		if (isResending) return;

		setIsResending(true);
		setMessage(null);

		try {
			const { error } = await resendVerificationEmail(null, null, email);
			
			if (error) {
				setMessage({
					text: `Failed to resend verification email: ${error}`,
					type: 'error',
				});
			} else {
				setMessage({
					text: 'Verification email resent. Please check your inbox.',
					type: 'success',
				});
			}
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
		<div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-300'>
			<p>
				<strong>Can't find the email?</strong>{' '}
				Check your spam folder or click the button below to request a new verification email.
			</p>

			{message && (
				<div
					className={`mt-2 p-2 rounded-md ${message.type === 'success' 
						? 'bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-200' 
						: 'bg-red-100 dark:bg-red-800/50 text-red-800 dark:text-red-200'}`}
				>
					{message.text}
				</div>
			)}

			<button
				type='button'
				className={`mt-4 px-4 py-2 ${isResending 
					? 'bg-gray-400 dark:bg-gray-600' 
					: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600'} 
					text-white rounded-md transition-colors`}
				onClick={handleResendEmail}
				disabled={isResending}
			>
				{isResending ? 'Sending...' : 'Resend verification email'}
			</button>
		</div>
	);
}