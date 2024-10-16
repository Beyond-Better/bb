import { PageProps } from '$fresh/server.ts';
import { Head } from '$fresh/runtime.ts';

export default function App({ Component, url }: PageProps) {
	return (
		<html>
			<Head>
				<meta charset='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>BB - Beyond Better - with code and docs</title>
				<link rel='stylesheet' href='/styles.css' />
			</Head>
			<body>
				<Component />
			</body>
		</html>
	);
}
