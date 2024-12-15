// Platform detection for browser environment
export interface PlatformInfo {
	os: 'windows' | 'macos' | 'linux';
	arch: 'x64' | 'arm64';
	variant?: 'universal' | 'intel' | 'apple-silicon'; // for macOS
}

export function getPlatformInfo(): PlatformInfo {
	const platform = navigator.platform.toLowerCase();
	const userAgent = navigator.userAgent.toLowerCase();

	//console.log('Platform detection:', {
	//  platform,
	//  userAgent,
	//  maxTouchPoints: navigator.maxTouchPoints
	//});

	// Detect macOS
	if (platform.includes('mac')) {
		// Check for Apple Silicon
		const isAppleSilicon = userAgent.includes('mac') && navigator.maxTouchPoints > 1;
		const info: PlatformInfo = {
			os: 'macos' as const,
			arch: isAppleSilicon ? 'arm64' : 'x64',
			variant: 'universal', //isAppleSilicon ? 'apple-silicon' : 'intel',
		};
		//console.log('Detected macOS:', info);
		return info;
	}

	// Detect Windows
	if (platform.includes('win')) {
		const info: PlatformInfo = {
			os: 'windows' as const,
			arch: 'x64', // Currently only supporting x64 for Windows
		};
		//console.log('Detected Windows:', info);
		return info;
	}

	// Default to Linux
	const info: PlatformInfo = {
		os: 'linux' as const,
		arch: 'x64', // Currently only supporting x64 for Linux
	};
	//console.log('Defaulting to Linux:', info);
	return info;
}

export function getBBAppAssetName(version: string): string {
	const platform = getPlatformInfo();
	switch (platform.os) {
		case 'macos':
			return `BB-app-${version}-macos-${platform.variant}.dmg`;
		case 'windows':
			return `BB-app-${version}-windows-x64-setup.exe`;
		case 'linux':
			return `BB-app-${version}-linux-x64.AppImage`;
	}
}

export function getSecurityInstructions(): string {
	const platform = getPlatformInfo();

	switch (platform.os) {
		case 'macos':
			return 'When first launching the app:\n' +
				'- Right-click the app and select "Open", or\n' +
				'- Go to System Settings > Privacy & Security and click "Open Anyway"\n' +
				'- This security approval is only needed once, as the app is currently unsigned';
		case 'windows':
			return 'When first launching the app, you may see a SmartScreen warning:\n' +
				'- Click "More info"\n' +
				'- Click "Run anyway"\n' +
				'- This security approval is only needed once, as the app is currently unsigned';
		case 'linux':
			return 'After downloading:\n' +
				'- Make the AppImage executable: chmod +x BB-app-*.AppImage\n' +
				'- Run the AppImage';
	}
}
