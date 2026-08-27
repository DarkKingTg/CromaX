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

		const themeBg = data?.colorInfo?.background || '#090a0f';
		const themeFg = data?.colorInfo?.foreground || '#ffffff';
		const isLightTheme = data?.baseTheme === 'vs' || data?.baseTheme === 'hc-light';

		const style = document.createElement('style');
		style.className = 'cromaxSplashStyles';
		style.textContent = `
			body { background-color: ${themeBg} !important; color: ${themeFg}; margin: 0; padding: 0; overflow: hidden; }
			@keyframes cromax-float {
				0% { transform: translateY(0px) scale(1); }
				50% { transform: translateY(-7px) scale(1.02); }
				100% { transform: translateY(0px) scale(1); }
			}
			@keyframes cromax-spin-ring {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			@keyframes cromax-aura-pulse {
				0% { opacity: 0.55; transform: scale(0.95); filter: blur(20px); }
				50% { opacity: 0.95; transform: scale(1.1); filter: blur(30px); }
				100% { opacity: 0.55; transform: scale(0.95); filter: blur(20px); }
			}
			@keyframes cromax-apple-progress {
				0% { left: -35%; width: 35%; }
				50% { left: 30%; width: 45%; }
				100% { left: 100%; width: 25%; }
			}
			.cromax-apple-card {
				position: relative;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 44px 56px;
				border-radius: 38px;
				background: ${isLightTheme ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.035)'};
				backdrop-filter: blur(45px) saturate(200%);
				-webkit-backdrop-filter: blur(45px) saturate(200%);
				border: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'};
				box-shadow: ${isLightTheme ? '0 20px 60px rgba(0,0,0,0.12)' : '0 30px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.18)'};
				animation: cromax-float 3.6s ease-in-out infinite;
			}
			.cromax-ambient-aura {
				position: absolute;
				width: 140px;
				height: 140px;
				border-radius: 50%;
				background: radial-gradient(circle, rgba(168, 85, 247, 0.45) 0%, rgba(99, 102, 241, 0.25) 60%, transparent 100%);
				animation: cromax-aura-pulse 3.6s ease-in-out infinite;
				z-index: 0;
				pointer-events: none;
			}
			.cromax-icon-container {
				position: relative;
				width: 76px;
				height: 76px;
				border-radius: 22px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: ${isLightTheme ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.01))' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))'};
				border: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.16)'};
				box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
				margin-bottom: 20px;
				z-index: 1;
			}
			.cromax-spinner-ring {
				position: absolute;
				inset: -5px;
				border-radius: 26px;
				border: 2px solid transparent;
				border-top-color: #a855f7;
				border-right-color: #6366f1;
				border-bottom-color: #ec4899;
				animation: cromax-spin-ring 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
			}
			.cromax-logo-img {
				width: 46px;
				height: 46px;
				position: relative;
				z-index: 2;
			}
			.cromax-brand-name {
				font-size: 26px;
				font-weight: 700;
				letter-spacing: -0.5px;
				background: ${isLightTheme ? 'linear-gradient(135deg, #1e1e2e 30%, #7c3aed 100%)' : 'linear-gradient(135deg, #ffffff 30%, #d8b4fe 100%)'};
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				margin-bottom: 6px;
				z-index: 1;
			}
			.cromax-status-pill {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 11px;
				font-weight: 600;
				letter-spacing: 0.6px;
				text-transform: uppercase;
				color: ${isLightTheme ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)'};
				margin-bottom: 22px;
				z-index: 1;
			}
			.cromax-status-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background-color: #a855f7;
				box-shadow: 0 0 8px #a855f7;
			}
			.cromax-track {
				width: 140px;
				height: 4px;
				background: ${isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'};
				border-radius: 99px;
				overflow: hidden;
				position: relative;
				z-index: 1;
			}
			.cromax-fill {
				position: absolute;
				height: 100%;
				background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
				border-radius: 99px;
				animation: cromax-apple-progress 1.6s infinite cubic-bezier(0.16, 1, 0.3, 1);
			}
		`;
		window.document.head.appendChild(style);

		// set zoom level as soon as possible
		if (typeof data?.zoomLevel === 'number' && typeof preloadGlobals?.webFrame?.setZoomLevel === 'function') {
			preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
		}

		// Dynamically update existing HTML loading screen or create theme-matched loading screen
		let splash = window.document.getElementById('cromax-loading-splash');
		if (splash) {
			splash.style.backgroundColor = themeBg;
			splash.style.color = themeFg;
		} else {
			splash = document.createElement('div');
			splash.id = 'cromax-loading-splash';
			splash.style.position = 'fixed';
			splash.style.top = '0';
			splash.style.left = '0';
			splash.style.width = '100vw';
			splash.style.height = '100vh';
			splash.style.backgroundColor = themeBg;
			splash.style.backgroundImage = 'radial-gradient(circle at 50% 42%, rgba(99, 102, 241, 0.14) 0%, rgba(168, 85, 247, 0.07) 35%, transparent 70%)';
			splash.style.zIndex = '999999';
			splash.style.display = 'flex';
			splash.style.flexDirection = 'column';
			splash.style.alignItems = 'center';
			splash.style.justifyContent = 'center';
			splash.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
			splash.style.userSelect = 'none';
			splash.style.color = themeFg;
			(splash.style as any).willChange = 'transform, opacity, filter';

			const card = document.createElement('div');
			card.className = 'cromax-apple-card';

			const aura = document.createElement('div');
			aura.className = 'cromax-ambient-aura';
			card.appendChild(aura);

			const iconContainer = document.createElement('div');
			iconContainer.className = 'cromax-icon-container';

			const spinnerRing = document.createElement('div');
			spinnerRing.className = 'cromax-spinner-ring';
			iconContainer.appendChild(spinnerRing);

			const logoImg = document.createElement('img');
			logoImg.className = 'cromax-logo-img';
			logoImg.src = '../../../../../resources/cromax-logo.svg';
			logoImg.alt = 'CromaX Logo';
			iconContainer.appendChild(logoImg);
			card.appendChild(iconContainer);

			const brandName = document.createElement('div');
			brandName.className = 'cromax-brand-name';
			brandName.textContent = 'CromaX';
			card.appendChild(brandName);

			const statusPill = document.createElement('div');
			statusPill.className = 'cromax-status-pill';
			const statusDot = document.createElement('div');
			statusDot.className = 'cromax-status-dot';
			const statusText = document.createElement('span');
			statusText.textContent = 'Studio Engine';
			statusPill.appendChild(statusDot);
			statusPill.appendChild(statusText);
			card.appendChild(statusPill);

			const track = document.createElement('div');
			track.className = 'cromax-track';
			const fill = document.createElement('div');
			fill.className = 'cromax-fill';
			track.appendChild(fill);
			card.appendChild(track);

			splash.appendChild(card);
			window.document.body.appendChild(splash);
		}

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
