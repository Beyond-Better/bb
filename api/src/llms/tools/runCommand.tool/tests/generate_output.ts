// Generate stdout lines without extra newlines
const stdoutLines = [];
for (let i = 1; i <= 10; i++) {
	stdoutLines.push(`stdout line ${i}`);
}
console.log(stdoutLines.join('\n'));

// Generate stderr lines without extra newlines
const stderrLines = [];
for (let i = 1; i <= 5; i++) {
	stderrLines.push(`stderr line ${i}`);
}
console.error(stderrLines.join('\n'));
