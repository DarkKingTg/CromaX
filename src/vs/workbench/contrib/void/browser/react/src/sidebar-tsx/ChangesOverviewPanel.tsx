/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { useAccessor, useCommandBarState } from '../util/services.js';
import { Check, X, FileCode, GitPullRequest, ExternalLink } from 'lucide-react';
import { voidOpenFileFn, getBasename, getRelative } from './SidebarChat.js';
import { VoidDiffEditor } from '../util/inputs.js';

export const ChangesOverviewPanel: React.FC = () => {
	const accessor = useAccessor();
	const editCodeService = accessor.get('IEditCodeService');
	const commandBarState = useCommandBarState();
	const sortedURIs = commandBarState.sortedURIs;
	const [selectedFileUri, setSelectedFileUri] = useState<string | null>(sortedURIs[0]?.fsPath || null);

	const handleAcceptAll = () => {
		sortedURIs.forEach(uri => {
			editCodeService.acceptOrRejectAllDiffAreas({
				uri,
				removeCtrlKs: true,
				behavior: 'accept',
				_addToHistory: true,
			});
		});
	};

	const handleRejectAll = () => {
		sortedURIs.forEach(uri => {
			editCodeService.acceptOrRejectAllDiffAreas({
				uri,
				removeCtrlKs: true,
				behavior: 'reject',
				_addToHistory: true,
			});
		});
	};

	const currentSelectedUriObj = sortedURIs.find(u => u.fsPath === selectedFileUri);

	return (
		<div className="w-full h-full flex flex-col bg-void-bg-1 overflow-hidden select-none">
			{/* Top Header */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-void-bg-2 border-b border-void-border-3">
				<div className="flex items-center gap-2">
					<GitPullRequest className="w-4 h-4 text-blue-400" />
					<h3 className="font-semibold text-sm text-void-fg-1">Changes Overview</h3>
					<span className="text-xs text-void-fg-4 font-mono">
						({sortedURIs.length} modified file{sortedURIs.length === 1 ? '' : 's'})
					</span>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleRejectAll}
						disabled={sortedURIs.length === 0}
						className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors disabled:opacity-50"
					>
						<X className="w-3.5 h-3.5" />
						<span>Reject All</span>
					</button>

					<button
						type="button"
						onClick={handleAcceptAll}
						disabled={sortedURIs.length === 0}
						className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors disabled:opacity-50"
					>
						<Check className="w-3.5 h-3.5" />
						<span>Accept All</span>
					</button>
				</div>
			</div>

			{/* Main Content Body */}
			{sortedURIs.length === 0 ? (
				<div className="px-3 py-2 text-xs text-void-fg-3 flex items-center justify-between bg-void-bg-1 select-none">
					<div className="flex items-center gap-2">
						<FileCode className="w-3.5 h-3.5 opacity-50 text-void-fg-4" />
						<span>0 Files With Changes</span>
					</div>
					<span className="text-[11px] text-void-fg-4">No modified files in session</span>
				</div>
			) : (
				<div className="flex overflow-hidden max-h-[350px]">
					{/* Left File List */}
					<div className="w-1/3 min-w-[200px] border-r border-void-border-3 overflow-y-auto bg-void-bg-2/30 p-2 space-y-1">
						{sortedURIs.map(uri => {
							const basename = getBasename(uri.fsPath);
							const relativePath = getRelative(uri, accessor);
							const isSelected = selectedFileUri === uri.fsPath;
							const fileState = commandBarState.stateOfURI[uri.fsPath];
							const numDiffs = fileState?.sortedDiffIds?.length || 0;

							return (
								<div
									key={uri.fsPath}
									onClick={() => setSelectedFileUri(uri.fsPath)}
									className={`
										flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs
										${isSelected ? 'bg-void-bg-3 border border-void-border-2 text-void-fg-1' : 'hover:bg-void-bg-3/50 text-void-fg-3'}
									`}
								>
									<div className="flex flex-col truncate min-w-0 pr-1">
										<span className="font-medium truncate">{basename}</span>
										<span className="text-[10px] text-void-fg-4 truncate">{relativePath}</span>
									</div>

									<div className="flex items-center gap-1.5 shrink-0">
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
											{numDiffs} diff{numDiffs === 1 ? '' : 's'}
										</span>

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												editCodeService.acceptOrRejectAllDiffAreas({
													uri,
													removeCtrlKs: true,
													behavior: 'accept',
													_addToHistory: true,
												});
											}}
											className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
											title="Accept changes in file"
										>
											<Check className="w-3 h-3" />
										</button>

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												editCodeService.acceptOrRejectAllDiffAreas({
													uri,
													removeCtrlKs: true,
													behavior: 'reject',
													_addToHistory: true,
												});
											}}
											className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
											title="Reject changes in file"
										>
											<X className="w-3 h-3" />
										</button>
									</div>
								</div>
							);
						})}
					</div>

					{/* Right File Diff Inspector */}
					<div className="flex-1 flex flex-col overflow-hidden bg-void-bg-1">
						{currentSelectedUriObj ? (
							<>
								<div className="flex items-center justify-between px-3 py-1.5 border-b border-void-border-3 bg-void-bg-2/40 text-xs">
									<span className="font-mono text-void-fg-3">{currentSelectedUriObj.fsPath}</span>
									<button
										type="button"
										onClick={() => voidOpenFileFn(currentSelectedUriObj, accessor)}
										className="flex items-center gap-1 text-blue-400 hover:underline text-xs"
									>
										<span>Open File</span>
										<ExternalLink className="w-3 h-3" />
									</button>
								</div>

								<div className="flex-1 overflow-auto p-2">
									<VoidDiffEditor uri={currentSelectedUriObj} searchReplaceBlocks="" />
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-void-fg-4 text-xs">
								Select a file from the list to view diff inspector.
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
