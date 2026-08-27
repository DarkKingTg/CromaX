/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { Globe, RefreshCw, ArrowLeft, ArrowRight, ExternalLink, Monitor, Smartphone } from 'lucide-react';

export const BrowserPanel: React.FC = () => {
	const [url, setUrl] = useState('http://localhost:3000');
	const [inputUrl, setInputUrl] = useState('http://localhost:3000');
	const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
	const [isLoading, setIsLoading] = useState(false);

	const handleNavigate = (e: React.FormEvent) => {
		e.preventDefault();
		let target = inputUrl.trim();
		if (!target.startsWith('http://') && !target.startsWith('https://')) {
			target = `http://${target}`;
		}
		setUrl(target);
		setIsLoading(true);
	};

	const handleRefresh = () => {
		setIsLoading(true);
		const currentUrl = url;
		setUrl('');
		setTimeout(() => setUrl(currentUrl), 50);
	};

	return (
		<div className="w-full h-full flex flex-col bg-void-bg-1 overflow-hidden select-none">
			{/* Top Browser Navigation Bar */}
			<div className="flex items-center gap-2 px-3 py-2 bg-void-bg-2 border-b border-void-border-3 shrink-0">
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="p-1 rounded text-void-fg-4 hover:bg-void-bg-3 hover:text-void-fg-2 transition-colors"
						title="Back"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						className="p-1 rounded text-void-fg-4 hover:bg-void-bg-3 hover:text-void-fg-2 transition-colors"
						title="Forward"
					>
						<ArrowRight className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						onClick={handleRefresh}
						className="p-1 rounded text-void-fg-4 hover:bg-void-bg-3 hover:text-void-fg-2 transition-colors"
						title="Reload"
					>
						<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
					</button>
				</div>

				{/* URL Address Input Bar */}
				<form onSubmit={handleNavigate} className="flex-1 flex items-center">
					<div className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded bg-void-bg-1 border border-void-border-3 focus-within:border-blue-500/50 text-xs">
						<Globe className="w-3.5 h-3.5 text-void-fg-4 shrink-0" />
						<input
							type="text"
							value={inputUrl}
							onChange={(e) => setInputUrl(e.target.value)}
							placeholder="Enter URL (e.g. http://localhost:3000)..."
							className="w-full bg-transparent outline-none text-void-fg-1 placeholder:text-void-fg-4 font-mono text-xs"
						/>
					</div>
				</form>

				{/* Controls */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setDeviceMode(deviceMode === 'desktop' ? 'mobile' : 'desktop')}
						className={`p-1 rounded transition-colors ${deviceMode === 'mobile' ? 'bg-blue-500/20 text-blue-400' : 'text-void-fg-4 hover:bg-void-bg-3'}`}
						title="Toggle Device Mode"
					>
						{deviceMode === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
					</button>

					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="p-1 rounded text-void-fg-4 hover:bg-void-bg-3 hover:text-void-fg-2 transition-colors"
						title="Open in External Browser"
					>
						<ExternalLink className="w-3.5 h-3.5" />
					</a>
				</div>
			</div>

			{/* Main Iframe Webview Body */}
			<div className="flex-1 flex items-center justify-center bg-void-bg-1/50 overflow-hidden relative p-2">
				{url ? (
					<div
						className={`
							h-full bg-white rounded shadow-lg overflow-hidden transition-all duration-300 relative border border-void-border-3
							${deviceMode === 'mobile' ? 'w-[375px] max-h-[667px]' : 'w-full'}
						`}
					>
						<iframe
							src={url}
							onLoad={() => setIsLoading(false)}
							className="w-full h-full border-none"
							title="Browser Preview"
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
						/>
					</div>
				) : (
					<div className="text-center text-void-fg-4 text-xs">
						Enter a web application URL above to preview live inside CroX Chat.
					</div>
				)}
			</div>
		</div>
	);
};
