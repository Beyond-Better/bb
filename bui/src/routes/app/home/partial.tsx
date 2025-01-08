import { signal } from '@preact/signals';
import { RouteConfig } from '$fresh/server.ts';
import { Partial } from '$fresh/runtime.ts';
import Home from '../../../islands/Home.tsx';

// Skip the app wrapper since we're rendering inside a Partial
export const config: RouteConfig = {
	skipAppWrapper: true,
	skipInheritedLayouts: true,
};

export default function HomePartial() {
	return (
		<Partial name='page-content'>
			<div class='flex flex-col flex-1'>
				{/* Main content */}
				<div class='flex-1 flex flex-col overflow-hidden'>
					<Home />
				</div>
			</div>
		</Partial>
	);
}
