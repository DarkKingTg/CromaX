/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { errorDetails } from '../../../../common/sendLLMMessageTypes.js';

export const ErrorDisplay = ({
	message: message_,
	fullError,
	onDismiss,
	showDismiss,
}: {
	message: string;
	fullError: Error | null;
	onDismiss: (() => void) | null;
	showDismiss?: boolean;
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const details = errorDetails(fullError);
	const isExpandable = !!details;

	const message = message_ + '';

	return (
		<div className="rounded-lg border border-red-500/40 bg-void-bg-1 p-3.5 overflow-auto shadow-sm my-2">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex gap-2.5">
					<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
					<div className="flex-1">
						<h3 className="font-bold text-xs text-red-500 tracking-wide uppercase">
							Error
						</h3>
						<p className="text-red-500 font-semibold text-xs mt-0.5 leading-relaxed">
							{message}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1">
					{isExpandable && (
						<button
							type="button"
							className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
							onClick={() => setIsExpanded(!isExpanded)}
							title={isExpanded ? 'Collapse error details' : 'Expand error details'}
						>
							{isExpanded ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</button>
					)}
					{showDismiss && onDismiss && (
						<button
							type="button"
							className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
							onClick={onDismiss}
							title="Dismiss error"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Expandable Details */}
			{isExpanded && details && (
				<div className="mt-3 space-y-2 border-t border-red-500/30 pt-2.5 overflow-auto font-mono text-[11px]">
					<div>
						<span className="font-bold text-red-500">Full Error Trace: </span>
						<pre className="text-red-500/90 whitespace-pre-wrap mt-1 p-2 bg-void-bg-2 rounded border border-red-500/20">{details}</pre>
					</div>
				</div>
			)}
		</div>
	);
};
