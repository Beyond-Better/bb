import { PageProps } from '$fresh/server.ts';
import Home from '../../../islands/Home.tsx';

export default function HomePage(props: PageProps) {
	return (
		<div class='flex flex-col flex-1'>
			{/* Main content */}
			<div class='flex-1 flex flex-col overflow-hidden'>
				<Home />
			</div>
		</div>
	);
}
