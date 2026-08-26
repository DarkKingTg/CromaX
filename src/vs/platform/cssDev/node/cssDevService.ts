/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { relative } from 'path';
import { FileAccess } from '../../../base/common/network.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export const ICSSDevelopmentService = createDecorator<ICSSDevelopmentService>('ICSSDevelopmentService');

export interface ICSSDevelopmentService {
	_serviceBrand: undefined;
	isEnabled: boolean;
	getCssModules(): Promise<string[]>;
}

export class CSSDevelopmentService implements ICSSDevelopmentService {

	declare _serviceBrand: undefined;

	private _cssModules?: Promise<string[]>;

	constructor(
		@IEnvironmentService private readonly envService: IEnvironmentService,
		@ILogService private readonly logService: ILogService
	) { }

	get isEnabled(): boolean {
		return !this.envService.isBuilt;
	}

	getCssModules(): Promise<string[]> {
		this._cssModules ??= this.computeCssModules();
		return this._cssModules;
	}

	private async computeCssModules(): Promise<string[]> {
		if (!this.isEnabled) {
			return [];
		}

		const basePath = FileAccess.asFileUri('').fsPath;
		try {
			const rg = await import('@vscode/ripgrep');
			return await new Promise<string[]>((resolve) => {
				const sw = StopWatch.create();
				const chunks: string[][] = [];
				const decoder = new TextDecoder();
				const process = spawn(rg.rgPath, ['-g', '**/*.css', '--files', '--no-ignore', basePath]);

				process.stdout.on('data', data => {
					const chunk = decoder.decode(data, { stream: true });
					chunks.push(chunk.split(/\r?\n/).filter(Boolean));
				});
				process.on('error', err => {
					this.logService.error('[CSS_DEV] FAILED to compute CSS data via ripgrep', err);
					resolve(this.fallbackCssModules(basePath));
				});
				process.on('close', () => {
					const result = chunks.flat().map(p => relative(basePath, p.trim()).replace(/\\/g, '/')).filter(Boolean).sort();
					if (result.length === 0) {
						resolve(this.fallbackCssModules(basePath));
					} else {
						resolve(result);
						this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
					}
				});
			});
		} catch (err) {
			this.logService.error('[CSS_DEV] Failed to load ripgrep', err);
			return this.fallbackCssModules(basePath);
		}
	}

	private fallbackCssModules(basePath: string): string[] {
		const sw = StopWatch.create();
		const results: string[] = [];
		const outDir = join(basePath, 'out');

		const scanDir = (dir: string) => {
			try {
				const entries = readdirSync(dir);
				for (const entry of entries) {
					const fullPath = join(dir, entry);
					try {
						const stat = statSync(fullPath);
						if (stat.isDirectory()) {
							scanDir(fullPath);
						} else if (entry.endsWith('.css')) {
							results.push(relative(basePath, fullPath).replace(/\\/g, '/'));
						}
					} catch { }
				}
			} catch { }
		};

		scanDir(outDir);
		results.sort();
		this.logService.info(`[CSS_DEV] FALLBACK DONE, ${results.length} css modules (${Math.round(sw.elapsed())}ms)`);
		return results;
	}
}
