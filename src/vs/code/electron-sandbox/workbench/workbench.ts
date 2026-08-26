/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable no-restricted-globals */

(async function () {

	// Add a perf entry right from the top
	performance.mark('code/didStartRenderer');

	type INativeWindowConfiguration = import('../../../platform/window/common/window.ts').INativeWindowConfiguration;
	type IBootstrapWindow = import('../../../platform/window/electron-sandbox/window.js').IBootstrapWindow;
	type IMainWindowSandboxGlobals = import('../../../base/parts/sandbox/electron-sandbox/globals.js').IMainWindowSandboxGlobals;
	type IDesktopMain = import('../../../workbench/electron-sandbox/desktop.main.js').IDesktopMain;

	const bootstrapWindow: IBootstrapWindow = (window as any).MonacoBootstrapWindow; 	// defined by bootstrap-window.ts
	const preloadGlobals: IMainWindowSandboxGlobals = (window as any).vscode; 			// defined by preload.ts

	//#region Splash Screen Helpers

	function showSplash(configuration: INativeWindowConfiguration) {
		performance.mark('code/willShowPartsSplash');

		let data = configuration.partsSplash;
		if (data) {
			if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
				if ((configuration.colorScheme.dark && data.baseTheme !== 'hc-black') || (!configuration.colorScheme.dark && data.baseTheme !== 'hc-light')) {
					data = undefined; // high contrast mode has been turned by the OS -> ignore stored colors and layouts
				}
			} else if (configuration.autoDetectColorScheme) {
				if ((configuration.colorScheme.dark && data.baseTheme !== 'vs-dark') || (!configuration.colorScheme.dark && data.baseTheme !== 'vs')) {
					data = undefined; // OS color scheme is tracked and has changed
				}
			}
		}

		// developing an extension -> ignore stored layouts
		if (data && configuration.extensionDevelopmentPath) {
			data.layoutInfo = undefined;
		}

		const style = document.createElement('style');
		style.className = 'cromaxSplashStyles';
		style.textContent = `
			body { background-color: #0a0b0d; color: #FFFFFF; margin: 0; padding: 0; overflow: hidden; }
			@keyframes cromax-spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			@keyframes cromax-pulse-glow {
				0% { opacity: 0.6; filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.4)); }
				50% { opacity: 1; filter: drop-shadow(0 0 25px rgba(168, 85, 247, 0.8)); }
				100% { opacity: 0.6; filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.4)); }
			}
			@keyframes cromax-progress-bar {
				0% { left: -40%; width: 40%; }
				50% { left: 25%; width: 50%; }
				100% { left: 100%; width: 30%; }
			}
			.cromax-logo-wrapper {
				position: relative;
				width: 88px;
				height: 88px;
				display: flex;
				align-items: center;
				justify-content: center;
				margin-bottom: 24px;
			}
			.cromax-spinner-ring {
				position: absolute;
				inset: 0;
				border-radius: 50%;
				border: 2px solid transparent;
				border-top-color: #6366f1;
				border-right-color: #a855f7;
				animation: cromax-spin 1.4s linear infinite;
			}
			.cromax-logo-img {
				width: 52px;
				height: 52px;
				animation: cromax-pulse-glow 2.5s infinite ease-in-out;
			}
			.cromax-brand-name {
				font-size: 24px;
				font-weight: 600;
				letter-spacing: 1.5px;
				background: linear-gradient(135deg, #ffffff 30%, #a855f7 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				margin-bottom: 24px;
			}
			.cromax-track {
				width: 160px;
				height: 3px;
				background: rgba(255, 255, 255, 0.08);
				border-radius: 99px;
				overflow: hidden;
				position: relative;
			}
			.cromax-fill {
				position: absolute;
				height: 100%;
				background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
				border-radius: 99px;
				animation: cromax-progress-bar 1.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
			}
		`;
		window.document.head.appendChild(style);

		// set zoom level as soon as possible
		if (typeof data?.zoomLevel === 'number' && typeof preloadGlobals?.webFrame?.setZoomLevel === 'function') {
			preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
		}

		// Render CromaX Glassmorphic Loading Screen as early as possible (Frame 0 splash)
		const splash = document.createElement('div');
		splash.id = 'monaco-parts-splash';
		splash.style.position = 'fixed';
		splash.style.top = '0';
		splash.style.left = '0';
		splash.style.width = '100vw';
		splash.style.height = '100vh';
		splash.style.backgroundColor = '#0a0b0d';
		splash.style.backdropFilter = 'blur(20px)';
		(splash.style as any).webkitBackdropFilter = 'blur(20px)';
		splash.style.zIndex = '999999';
		splash.style.display = 'flex';
		splash.style.flexDirection = 'column';
		splash.style.alignItems = 'center';
		splash.style.justifyContent = 'center';
		splash.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";
		splash.style.userSelect = 'none';
		splash.style.color = '#ffffff';

		const logoWrapper = document.createElement('div');
		logoWrapper.className = 'cromax-logo-wrapper';

		const spinnerRing = document.createElement('div');
		spinnerRing.className = 'cromax-spinner-ring';
		logoWrapper.appendChild(spinnerRing);

		const logoImg = document.createElement('img');
		logoImg.className = 'cromax-logo-img';
		logoImg.src = '../../../../../resources/cromax-logo.svg';
		logoImg.alt = 'CromaX Logo';
		logoWrapper.appendChild(logoImg);

		const brandName = document.createElement('div');
		brandName.className = 'cromax-brand-name';
		brandName.textContent = 'CromaX';

		const track = document.createElement('div');
		track.className = 'cromax-track';
		const fill = document.createElement('div');
		fill.className = 'cromax-fill';
		track.appendChild(fill);

		splash.appendChild(logoWrapper);
		splash.appendChild(brandName);
		splash.appendChild(track);

		window.document.body.appendChild(splash);

		performance.mark('code/didShowPartsSplash');
	}

	//#endregion

	const { result, configuration } = await bootstrapWindow.load<IDesktopMain, INativeWindowConfiguration>('vs/workbench/workbench.desktop.main',
		{
			configureDeveloperSettings: function (windowConfig) {
				return {
					// disable automated devtools opening on error when running extension tests
					// as this can lead to nondeterministic test execution (devtools steals focus)
					forceDisableShowDevtoolsOnError: typeof windowConfig.extensionTestsPath === 'string' || windowConfig['enable-smoke-test-driver'] === true,
					// enable devtools keybindings in extension development window
					forceEnableDeveloperKeybindings: Array.isArray(windowConfig.extensionDevelopmentPath) && windowConfig.extensionDevelopmentPath.length > 0,
					removeDeveloperKeybindingsAfterLoad: true
				};
			},
			beforeImport: function (windowConfig) {

				// Show our splash as early as possible
				showSplash(windowConfig);

				// Code windows have a `vscodeWindowId` property to identify them
				Object.defineProperty(window, 'vscodeWindowId', {
					get: () => windowConfig.windowId
				});

				// It looks like browsers only lazily enable
				// the <canvas> element when needed. Since we
				// leverage canvas elements in our code in many
				// locations, we try to help the browser to
				// initialize canvas when it is idle, right
				// before we wait for the scripts to be loaded.
				window.requestIdleCallback(() => {
					const canvas = document.createElement('canvas');
					const context = canvas.getContext('2d');
					context?.clearRect(0, 0, canvas.width, canvas.height);
					canvas.remove();
				}, { timeout: 50 });

				// Track import() perf
				performance.mark('code/willLoadWorkbenchMain');
			}
		}
	);

	// Mark start of workbench
	performance.mark('code/didLoadWorkbenchMain');

	// Load workbench
	result.main(configuration);
}());
