const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Plugin to copy resource files to dist directory
 * Copies EJS templates and HTML files
 * @type {import('esbuild').Plugin}
 */
const copyResourcesPlugin = {
	name: 'copy-resources',

	setup(build) {
		build.onEnd(() => {
			let filesCopied = 0;

			// Copy EJS templates from src/generator/template to dist/generator/template
			const srcTemplateDir = path.join(__dirname, 'src', 'generator', 'template');
			const distTemplateDir = path.join(__dirname, 'dist', 'generator', 'template');

			if (!fs.existsSync(distTemplateDir)) {
				fs.mkdirSync(distTemplateDir, { recursive: true });
			}

			const templateFiles = fs.readdirSync(srcTemplateDir).filter(file => file.endsWith('.ejs'));
			templateFiles.forEach(file => {
				const srcPath = path.join(srcTemplateDir, file);
				const distPath = path.join(distTemplateDir, file);
				fs.copyFileSync(srcPath, distPath);
				filesCopied++;
			});

			// Copy HTML files from src/webview to dist/webview
			const srcWebviewDir = path.join(__dirname, 'src', 'webview');
			const distWebviewDir = path.join(__dirname, 'dist', 'webview');

			if (!fs.existsSync(distWebviewDir)) {
				fs.mkdirSync(distWebviewDir, { recursive: true });
			}

			const htmlFiles = fs.readdirSync(srcWebviewDir).filter(file => file.endsWith('.html'));
			htmlFiles.forEach(file => {
				const srcPath = path.join(srcWebviewDir, file);
				const distPath = path.join(distWebviewDir, file);
				fs.copyFileSync(srcPath, distPath);
				filesCopied++;
			});

			if (filesCopied > 0) {
				console.log(`[resources] Copied ${filesCopied} resource files to dist (${templateFiles.length} EJS, ${htmlFiles.length} HTML)`);
			}
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: true,
		sourcesContent: true,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyResourcesPlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
