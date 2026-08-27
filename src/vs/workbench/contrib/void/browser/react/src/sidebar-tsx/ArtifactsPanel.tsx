/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { useChatThreadsState } from '../util/services.js';
import { FileText, Copy, Download, Sparkles, Code2, BookOpen } from 'lucide-react';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';

interface ArtifactItem {
	id: string;
	title: string;
	type: 'markdown' | 'code' | 'plan';
	content: string;
	timestamp: string;
}

export const ArtifactsPanel: React.FC = () => {
	const chatThreadsState = useChatThreadsState();
	const currentThreadId = chatThreadsState.currentThreadId;
	const messages = chatThreadsState.allThreads[currentThreadId]?.messages || [];

	// Extract artifacts from code blocks and structured markdown in assistant messages
	const artifacts: ArtifactItem[] = [];
	messages.forEach((msg, idx) => {
		if (msg.role === 'assistant' && msg.displayContent) {
			// Extract markdown headers or large blocks
			const codeBlockMatches = msg.displayContent.match(/```[a-z]*\n[\s\S]*?\n```/g);
			if (codeBlockMatches) {
				codeBlockMatches.forEach((block, bIdx) => {
					const lang = block.slice(3, block.indexOf('\n')).trim() || 'text';
					artifacts.push({
						id: `art-${idx}-${bIdx}`,
						title: `Artifact ${artifacts.length + 1} (${lang})`,
						type: lang === 'markdown' || lang === 'md' ? 'markdown' : 'code',
						content: block,
						timestamp: new Date().toLocaleTimeString(),
					});
				});
			} else if (msg.displayContent.length > 200) {
				artifacts.push({
					id: `art-doc-${idx}`,
					title: `Response Summary ${artifacts.length + 1}`,
					type: 'markdown',
					content: msg.displayContent,
					timestamp: new Date().toLocaleTimeString(),
				});
			}
		}
	});

	const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
		artifacts.length > 0 ? artifacts[0].id : null
	);

	const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

	return (
		<div className="w-full h-full flex flex-col bg-void-bg-1 overflow-hidden select-none">
			{/* Top Header */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-void-bg-2 border-b border-void-border-3">
				<div className="flex items-center gap-2">
					<FileText className="w-4 h-4 text-purple-400" />
					<h3 className="font-semibold text-sm text-void-fg-1">Generated Artifacts</h3>
					<span className="text-xs text-void-fg-4 font-mono">
						({artifacts.length} artifact{artifacts.length === 1 ? '' : 's'})
					</span>
				</div>
			</div>

			{/* Main Content Body */}
			{artifacts.length === 0 ? (
				<div className="px-3 py-2 text-xs text-void-fg-3 flex items-center justify-between bg-void-bg-1 select-none">
					<div className="flex items-center gap-2">
						<BookOpen className="w-3.5 h-3.5 opacity-50 text-purple-400" />
						<span>0 Artifacts</span>
					</div>
					<span className="text-[11px] text-void-fg-4">No artifacts generated in session</span>
				</div>
			) : (
				<div className="flex overflow-hidden max-h-[350px]">
					{/* Artifact List Sidebar */}
					<div className="w-1/3 min-w-[200px] border-r border-void-border-3 overflow-y-auto bg-void-bg-2/30 p-2 space-y-1">
						{artifacts.map(art => {
							const isSelected = selectedArtifactId === art.id;
							return (
								<div
									key={art.id}
									onClick={() => setSelectedArtifactId(art.id)}
									className={`
										flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs
										${isSelected ? 'bg-void-bg-3 border border-void-border-2 text-void-fg-1' : 'hover:bg-void-bg-3/50 text-void-fg-3'}
									`}
								>
									<div className="flex items-center gap-2 truncate pr-1">
										{art.type === 'code' ? (
											<Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
										) : (
											<Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
										)}
										<span className="font-medium truncate">{art.title}</span>
									</div>
									<span className="text-[10px] text-void-fg-4 font-mono">{art.timestamp}</span>
								</div>
							);
						})}
					</div>

					{/* Artifact Viewer Panel */}
					<div className="flex-1 flex flex-col overflow-hidden bg-void-bg-1">
						{selectedArtifact ? (
							<>
								<div className="flex items-center justify-between px-3 py-1.5 bg-void-bg-2 border-b border-void-border-3 text-xs text-void-fg-3">
									<div className="flex items-center gap-2 font-medium">
										<FileText className="w-3.5 h-3.5 text-purple-400" />
										<span>{selectedArtifact.title}</span>
									</div>

									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => navigator.clipboard.writeText(selectedArtifact.content)}
											className="flex items-center gap-1 px-2 py-0.5 rounded bg-void-bg-3 hover:bg-void-border-3 text-void-fg-2 transition-colors"
											title="Copy Artifact Content"
										>
											<Copy className="w-3 h-3" />
											<span>Copy</span>
										</button>
									</div>
								</div>

								<div className="flex-1 overflow-auto p-4 text-xs">
									<ChatMarkdownRender string={selectedArtifact.content} chatMessageLocation={undefined} />
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-void-fg-4 text-xs">
								Select an artifact from the list to preview.
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
