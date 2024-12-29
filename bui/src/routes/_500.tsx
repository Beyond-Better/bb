import { Head } from '$fresh/runtime.ts';
import { PageProps } from '$fresh/server.ts';

export default function Error500Page({ error }: PageProps) {
	return (
		<>
			<Head>
				<title>Server Error - Objective Incomplete</title>
			</Head>
			<div class='px-4 py-8 mx-auto bg-[#86efac] dark:bg-gray-800'>
				<div class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
					<img
						class='my-6'
						src='/logo.png'
						width='128'
						height='128'
						alt='BB: Beyond Better - with code and docs'
					/>
					<h1 class='text-4xl font-bold dark:text-white'>Server Error - Objective Incomplete</h1>
					<p class='my-4 text-center text-lg dark:text-gray-300'>
						Looks like we've ventured beyond the known abilities! <br />
						Even BB needs a helping hand sometimes.
					</p>
					<p class='my-4 text-center text-lg dark:text-gray-300'>
						{(error as Error).message}
					</p>

					<a
						href='/'
						class='underline text-gray-900 dark:text-blue-400 hover:text-gray-700 dark:hover:text-blue-300 transition-colors'
					>
						Back to Base
					</a>
				</div>
			</div>
		</>
	);
}