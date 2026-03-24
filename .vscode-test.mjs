import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// Only run integration tests with VS Code test runner
	// Unit tests use Mocha directly and are excluded
	files: 'out/test/integration/**/*.test.js',
	// Open extension root as workspace so findFiles can locate fixture files
	workspaceFolder: '.',
});
