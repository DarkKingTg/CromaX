/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { ChevronRight, Cpu, Sparkles, Clock, Flame } from 'lucide-react';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';

// Dynamic thinking loading phrases inspired by Claude Code CLI
const THINKING_PHRASES = [
	'Cooking...',
	'Working...',
	'Analyzing codebase...',
	'Thinking through logic...',
	'Evaluating context...',
	'Synthesizing response...',
	'Refining patch...',
	'Structuring solution...',
	'Reviewing dependencies...',
	'Optimizing approach...',
];

export const ClaudeThinkingPhrase = ({ className = '' }: { className?: string }) => {
	const [phraseIndex, setPhraseIndex] = useState(0);
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		let timeoutId: any;

		const triggerNext = () => {
			// Dynamic randomized delay between 2800ms and 4500ms for natural organic rhythm
			const dynamicDelay = Math.floor(Math.random() * 1700) + 2800;

			timeoutId = setTimeout(() => {
				setIsVisible(false);
				setTimeout(() => {
					setPhraseIndex(prev => (prev + 1) % THINKING_PHRASES.length);
					setIsVisible(true);
					triggerNext();
				}, 220);
			}, dynamicDelay);
		};

		triggerNext();

		return () => clearTimeout(timeoutId);
	}, []);

	return (
		<div className={`inline-flex items-center gap-1.5 font-medium text-xs text-void-fg-3 ${className}`}>
			<Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
			<span className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
				{THINKING_PHRASES[phraseIndex]}
			</span>
		</div>
	);
};

// Timer hook for tracking runtime elapsed
export const useTimer = (isRunning: boolean) => {
	const [elapsedMs, setElapsedMs] = useState(0);

	useEffect(() => {
		if (!isRunning) return;
		const startTime = Date.now() - elapsedMs;
		const interval = setInterval(() => {
			setElapsedMs(Date.now() - startTime);
		}, 100);
		return () => clearInterval(interval);
	}, [isRunning]);

	const seconds = (elapsedMs / 1000).toFixed(1);
	return { elapsedMs, seconds };
};

interface CollapsibleThinkingBlockProps {
	reasoning: string;
	isRunning?: boolean;
	durationSec?: string;
	className?: string;
}

export const CollapsibleThinkingBlock: React.FC<CollapsibleThinkingBlockProps> = ({
	reasoning,
	isRunning = false,
	durationSec,
	className = '',
}) => {
	const [isOpen, setIsOpen] = useState(isRunning);
	const { seconds } = useTimer(isRunning);

	if (!reasoning && !isRunning) return null;

	const displayDuration = durationSec || seconds;

	return (
		<div className={`my-1.5 rounded-md border border-void-border-3 bg-void-bg-2/50 overflow-hidden ${className}`}>
			{/* Collapsible Header */}
			<div
				className="flex items-center justify-between px-2.5 py-1.5 select-none cursor-pointer hover:bg-void-bg-3/60 transition-colors"
				onClick={() => setIsOpen(prev => !prev)}
			>
				<div className="flex items-center gap-2 text-xs font-medium text-void-fg-3">
					<ChevronRight
						className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90 text-amber-400' : 'text-void-fg-4'}`}
					/>
					<div className="flex items-center gap-1.5">
						<Cpu className="w-3.5 h-3.5 text-purple-400" />
						<span>Thinking Process</span>
					</div>
					{isRunning && <ClaudeThinkingPhrase className="ml-2" />}
				</div>

				<div className="flex items-center gap-2 text-[11px] text-void-fg-4">
					<span className="flex items-center gap-1 bg-void-bg-1 px-1.5 py-0.5 rounded border border-void-border-3 font-mono">
						<Clock className="w-3 h-3 text-void-fg-4" />
						{displayDuration}s
					</span>
				</div>
			</div>

			{/* Collapsible Content */}
			{isOpen && (
				<div className="px-3 py-2 border-t border-void-border-3/50 text-xs font-mono text-void-fg-2 bg-void-bg-1/80 overflow-x-auto max-h-80 overflow-y-auto leading-relaxed">
					{reasoning ? (
						<ChatMarkdownRender string={reasoning} chatMessageLocation={undefined} />
					) : (
						<div className="italic text-void-fg-4 flex items-center gap-2 py-1">
							<Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
							Generative reasoning in progress...
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// Token count metrics footer component
export const MessageTokenFooter: React.FC<{
	displayContent: string;
	reasoning?: string;
	tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}> = ({ displayContent, reasoning, tokenUsage }) => {
	// Approximate tokens if exact metadata is not supplied (1 token ~ 4 chars)
	const promptEst = tokenUsage?.promptTokens ?? Math.round((displayContent.length + (reasoning?.length || 0)) / 4);
	const completionEst = tokenUsage?.completionTokens ?? Math.round(displayContent.length / 4);
	const totalEst = tokenUsage?.totalTokens ?? (promptEst + completionEst);

	return (
		<div className="mt-2 pt-1 border-t border-void-border-3/30 flex items-center justify-between text-[10px] text-void-fg-4 font-mono select-none px-1">
			<div className="flex items-center gap-2">
				<span>Tokens: <strong className="text-void-fg-3">{totalEst}</strong> total</span>
				<span>(<span className="opacity-75">{promptEst} in</span> / <span className="opacity-75">{completionEst} out</span>)</span>
			</div>
			<div className="flex items-center gap-1 text-[9px] text-void-fg-4 opacity-75">
				<span>Claude Thinking Engine</span>
			</div>
		</div>
	);
};
