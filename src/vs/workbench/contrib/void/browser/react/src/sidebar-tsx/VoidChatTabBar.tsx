/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { FileText, Terminal, Package, Globe, FileCode } from 'lucide-react';

export type VoidChatTabId = 'chat' | 'changes' | 'terminals' | 'artifacts' | 'browser';

interface VoidChatTabBarProps {
	activeTab: VoidChatTabId;
	setActiveTab: (tab: VoidChatTabId) => void;
	numChanges?: number;
	numArtifacts?: number;
	numTerminals?: number;
}

export const VoidChatTabBar: React.FC<VoidChatTabBarProps> = ({
	activeTab,
	setActiveTab,
	numChanges = 0,
	numArtifacts = 0,
	numTerminals = 0,
}) => {
	const handleToggleTab = (tab: VoidChatTabId) => {
		if (activeTab === tab) {
			setActiveTab('chat');
		} else {
			setActiveTab(tab);
		}
	};

	const iconTabs: { id: VoidChatTabId; title: string; icon: React.FC<{ className?: string }>; badge?: boolean; count?: number }[] = [
		{ id: 'changes', title: 'Changes Overview', icon: FileText, count: numChanges },
		{ id: 'terminals', title: 'Terminals', icon: Terminal, count: numTerminals },
		{ id: 'artifacts', title: 'Artifacts', icon: Package, badge: true, count: numArtifacts },
		{ id: 'browser', title: 'Browser Preview', icon: Globe },
	];

	return (
		<div className="flex items-center justify-between px-2 py-1 bg-transparent select-none shrink-0 w-full mb-1">
			{/* Left Side: 4 Antigravity Icon Buttons */}
			<div className="flex items-center gap-1.5">
				{iconTabs.map(tab => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<div key={tab.id} className="relative">
							<button
								type="button"
								onClick={() => handleToggleTab(tab.id)}
								className={`
									p-1.5 rounded-md transition-all duration-150 relative flex items-center justify-center
									${isActive
										? 'bg-void-bg-1 text-blue-400 shadow-sm border border-void-border-2'
										: 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-3/60 border border-transparent'
									}
								`}
								title={tab.title}
							>
								<Icon className={`w-4 h-4 ${isActive ? 'text-blue-400 stroke-[2.2]' : 'opacity-75'}`} />

								{/* Blue Notification Dot (Matching Antigravity Artifacts Icon) */}
								{tab.badge && (
									<span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-void-bg-2" />
								)}
							</button>
						</div>
					);
				})}
			</div>

			{/* Right Side: Antigravity "Review Changes" Button */}
			<div className="flex items-center">
				<button
					type="button"
					onClick={() => handleToggleTab('changes')}
					className={`
						flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150
						${activeTab === 'changes'
							? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
							: 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60'
						}
					`}
					title="Review Changes Overview"
				>
					<FileCode className="w-3.5 h-3.5 text-blue-400" />
					<span>Review Changes</span>
					{numChanges > 0 && (
						<span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono bg-blue-500/30 text-blue-300">
							{numChanges}
						</span>
					)}
				</button>
			</div>
		</div>
	);
};
