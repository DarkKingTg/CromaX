/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { useAccessor, useChatThreadsState } from '../util/services.js';
import { Terminal as TerminalIcon, Play, RefreshCw, Square, CheckCircle, AlertTriangle } from 'lucide-react';
import { BlockCode } from '../util/inputs.js';

export const TerminalsPanel: React.FC = () => {
	const accessor = useAccessor();
	const terminalToolService = accessor.get('ITerminalToolService');
	const chatThreadsState = useChatThreadsState();
	const currentThreadId = chatThreadsState.currentThreadId;
	const messages = chatThreadsState.allThreads[currentThreadId]?.messages || [];

	// Extract command executions from chat thread tool messages
	const commandToolMessages = messages.filter(m =>
		m.role === 'tool' && (m.name === 'run_command' || m.name === 'run_persistent_command')
	);

	const [selectedLogIdx, setSelectedLogIdx] = useState<number>(
		commandToolMessages.length > 0 ? commandToolMessages.length - 1 : 0
	);

	const activeCommandMsg = commandToolMessages[selectedLogIdx];

	return (
		<div className="w-full h-full flex flex-col bg-void-bg-1 overflow-hidden select-none">
			{/* Top Header */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-void-bg-2 border-b border-void-border-3">
				<div className="flex items-center gap-2">
					<TerminalIcon className="w-4 h-4 text-emerald-400" />
					<h3 className="font-semibold text-sm text-void-fg-1">Terminal Executions</h3>
					<span className="text-xs text-void-fg-4 font-mono">
						({commandToolMessages.length} command{commandToolMessages.length === 1 ? '' : 's'})
					</span>
				</div>
			</div>

			{/* Main Content Body */}
			{commandToolMessages.length === 0 ? (
				<div className="px-3 py-2 text-xs text-void-fg-3 flex items-center justify-between bg-void-bg-1 select-none">
					<div className="flex items-center gap-2">
						<TerminalIcon className="w-3.5 h-3.5 opacity-50 text-emerald-400" />
						<span>0 Command Executions</span>
					</div>
					<span className="text-[11px] text-void-fg-4">No terminal commands run in session</span>
				</div>
			) : (
				<div className="flex overflow-hidden max-h-[350px]">
					{/* Command List Sidebar */}
					<div className="w-1/3 min-w-[200px] border-r border-void-border-3 overflow-y-auto bg-void-bg-2/30 p-2 space-y-1">
						{commandToolMessages.map((msg, idx) => {
							if (msg.role !== 'tool') return null;
							const isSelected = selectedLogIdx === idx;
							const isSuccess = msg.type === 'success';
							const isError = msg.type === 'tool_error';
							const isRunning = msg.type === 'running_now';

							const commandStr = (msg as any).params?.command || msg.name;

							return (
								<div
									key={msg.id || idx}
									onClick={() => setSelectedLogIdx(idx)}
									className={`
										flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs font-mono
										${isSelected ? 'bg-void-bg-3 border border-void-border-2 text-void-fg-1' : 'hover:bg-void-bg-3/50 text-void-fg-3'}
									`}
								>
									<div className="flex items-center gap-2 truncate pr-1">
										{isSuccess && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
										{isError && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
										{isRunning && <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />}
										<span className="truncate">{commandStr}</span>
									</div>
								</div>
							);
						})}
					</div>

					{/* Command Terminal Output Stream */}
					<div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 font-mono">
						{activeCommandMsg && activeCommandMsg.role === 'tool' ? (
							<>
								<div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
									<div className="flex items-center gap-2">
										<Play className="w-3 h-3 text-emerald-400" />
										<span className="text-zinc-200">{((activeCommandMsg as any).params)?.command || activeCommandMsg.name}</span>
									</div>
									<span className="text-[10px] text-zinc-500">{activeCommandMsg.type}</span>
								</div>

								<div className="flex-1 overflow-auto p-3 text-xs leading-relaxed">
									{activeCommandMsg.type === 'success' ? (
										<BlockCode initValue={activeCommandMsg.result ? String((activeCommandMsg.result as any).stdout || activeCommandMsg.result) : 'Command completed.'} language="shellscript" />
									) : activeCommandMsg.type === 'tool_error' ? (
										<div className="text-rose-400 whitespace-pre-wrap">{activeCommandMsg.result}</div>
									) : (
										<div className="text-amber-400 animate-pulse">Running command in background terminal...</div>
									)}
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
								Select a command output from the left list.
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
