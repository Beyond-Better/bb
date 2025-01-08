import LandingHero from '../islands/LandingHero.tsx';

export default function Landing() {
	return (
		<div class='min-h-screen bg-gray-50 dark:bg-gray-900'>
			{/* Hero section */}
			<LandingHero />

			{/* Feature section */}
			<div class='mx-auto max-w-7xl px-6 lg:px-8 pb-24'>
				<div class='mx-auto max-w-2xl lg:text-center'>
					<h2 class='text-base font-semibold leading-7 text-purple-600'>The Beyond Better Difference</h2>
					<p class='mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl'>
						Not just another AI assistant
					</p>
					<p class='mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400'>
						Beyond Better (BB) is designed to be a true pair programmer, understanding your code at a deep
						level and helping you write better code.
					</p>
				</div>

				<div class='mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none'>
					<dl class='grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3'>
						{/* Feature 1 */}
						<div class='flex flex-col'>
							<dt class='flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									viewBox='0 0 24 24'
									fill='currentColor'
									class='w-5 h-5 text-purple-600'
								>
									<path d='M11.25 5.337c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.036 1.007-1.875 2.25-1.875S15 2.34 15 3.375c0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959 0 .332.278.598.61.578 1.91-.114 3.79-.342 5.632-.676a.75.75 0 01.878.645 49.17 49.17 0 01.376 5.452.657.657 0 01-.66.664c-.354 0-.675-.186-.958-.401a1.647 1.647 0 00-1.003-.349c-1.035 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401.31 0 .557.262.534.571a48.774 48.774 0 01-.595 4.845.75.75 0 01-.61.61c-1.82.317-3.673.533-5.555.642a.58.58 0 01-.611-.581c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.035-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959a.641.641 0 01-.658.643 49.118 49.118 0 01-4.708-.36.75.75 0 01-.645-.878c.293-1.614.504-3.257.629-4.924A.53.53 0 005.337 15c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401a.656.656 0 00.659-.663 47.703 47.703 0 00-.31-4.82.75.75 0 01.83-.832c1.343.155 2.703.254 4.077.294a.64.64 0 00.657-.642z' />
								</svg>
								Deep Code Understanding
							</dt>
							<dd class='mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400'>
								<p class='flex-auto'>
									BB reads and understands your entire codebase, not just snippets. This means more
									contextual and accurate assistance.
								</p>
							</dd>
						</div>

						{/* Feature 2 */}
						<div class='flex flex-col'>
							<dt class='flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									viewBox='0 0 24 24'
									fill='currentColor'
									class='w-5 h-5 text-purple-600'
								>
									<path
										fill-rule='evenodd'
										d='M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z'
										clip-rule='evenodd'
									/>
								</svg>
								Privacy First
							</dt>
							<dd class='mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400'>
								<p class='flex-auto'>
									Your code stays on your machine. BB runs locally, ensuring your intellectual
									property remains secure.
								</p>
							</dd>
						</div>

						{/* Feature 3 */}
						<div class='flex flex-col'>
							<dt class='flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									viewBox='0 0 24 24'
									fill='currentColor'
									class='w-5 h-5 text-purple-600'
								>
									<path
										fill-rule='evenodd'
										d='M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z'
										clip-rule='evenodd'
									/>
								</svg>
								Real Development Tools
							</dt>
							<dd class='mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400'>
								<p class='flex-auto'>
									BB can execute commands, modify files, and perform real development tasks, not just
									generate code.
								</p>
							</dd>
						</div>
					</dl>
				</div>
			</div>
		</div>
	);
}
