export function isCompiledBinary(): boolean {
	// Check if we're running as a compiled binary
	return Deno.execPath().endsWith('bb') || Deno.execPath().endsWith('bb.exe');
}
