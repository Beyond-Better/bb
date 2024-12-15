import { ComponentChildren } from 'preact';

interface PageContainerProps {
	children: ComponentChildren;
	className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
	return (
		<div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${className}`}>
			{children}
		</div>
	);
}
