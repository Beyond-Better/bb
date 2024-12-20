import { Head } from '$fresh/runtime.ts';

export default function Error404() {
	return (
		<>
			<Head>
				<title>404 - Page not found</title>
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
					<h1 class='text-4xl font-bold dark:text-white'>404 - Page not found</h1>
					<p class='my-4 dark:text-gray-300'>
						The page you were looking for doesn't exist.
					</p>
					<a
						href='/'
						class='underline text-gray-900 dark:text-blue-400 hover:text-gray-700 dark:hover:text-blue-300'
					>
						Go back home
					</a>
				</div>
			</div>
		</>
	);
}
