/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import vfs from 'vinyl-fs';
import filter from 'gulp-filter';
import * as util from './util';
import { getVersion } from './getVersion';

type DarwinDocumentSuffix = 'document' | 'script' | 'file' | 'source code';
type DarwinDocumentType = {
	name: string;
	role: string;
	ostypes: string[];
	extensions: string[];
	iconFile: string;
	utis?: string[];
};

function isDocumentSuffix(str?: string): str is DarwinDocumentSuffix {
	return str === 'document' || str === 'script' || str === 'file' || str === 'source code';
}

const root = path.dirname(path.dirname(__dirname));
const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));
const commit = getVersion(root);

function createTemplate(input: string): (params: Record<string, string>) => string {
	return (params: Record<string, string>) => {
		return input.replace(/<%=\s*([^\s]+)\s*%>/g, (match, key) => {
			return params[key] || match;
		});
	};
}

const darwinCreditsTemplate = product.darwinCredits && createTemplate(fs.readFileSync(path.join(root, product.darwinCredits), 'utf8'));

function darwinBundleDocumentType(extensions: string[], icon: string, nameOrSuffix?: string | DarwinDocumentSuffix, utis?: string[]): DarwinDocumentType {
	if (isDocumentSuffix(nameOrSuffix) || !nameOrSuffix) {
		nameOrSuffix = icon.charAt(0).toUpperCase() + icon.slice(1) + ' ' + (nameOrSuffix ?? 'document');
	}

	return {
		name: nameOrSuffix,
		role: 'Editor',
		ostypes: ['TEXT', 'utxt', 'TUTX', '****'],
		extensions,
		iconFile: 'resources/darwin/' + icon.toLowerCase() + '.icns',
		utis
	};
}

function darwinBundleDocumentTypes(types: { [name: string]: string | string[] }, icon: string): DarwinDocumentType[] {
	return Object.keys(types).map((name: string): DarwinDocumentType => {
		const extensions = types[name];
		return {
			name,
			role: 'Editor',
			ostypes: ['TEXT', 'utxt', 'TUTX', '****'],
			extensions: Array.isArray(extensions) ? extensions : [extensions],
			iconFile: 'resources/darwin/' + icon + '.icns'
		};
	});
}

const { electronVersion, msBuildId } = util.getElectronVersion();

export const config = {
	version: electronVersion,
	tag: product.electronRepository ? `v${electronVersion}-${msBuildId}` : undefined,
	productAppName: product.nameLong,
	companyName: 'Microsoft Corporation',
	copyright: 'Copyright (C) 2024 Microsoft. All rights reserved',
	darwinIcon: 'resources/darwin/code.icns',
	darwinBundleIdentifier: product.darwinBundleIdentifier,
	darwinApplicationCategoryType: 'public.app-category.developer-tools',
	darwinHelpBookFolder: 'VS Code HelpBook',
	darwinHelpBookName: 'VS Code HelpBook',
	darwinBundleDocumentTypes: [
		...darwinBundleDocumentTypes({ 'C header file': 'h', 'C source code': 'c' }, 'c'),
		...darwinBundleDocumentTypes({ 'Git configuration file': ['gitattributes', 'gitconfig', 'gitignore'] }, 'config'),
		...darwinBundleDocumentTypes({ 'HTML template document': ['asp', 'aspx', 'cshtml', 'jshtm', 'jsp', 'phtml', 'shtml'] }, 'html'),
		darwinBundleDocumentType(['bat', 'cmd'], 'bat', 'Windows command script'),
		darwinBundleDocumentType(['bowerrc'], 'Bower'),
		darwinBundleDocumentType(['config', 'editorconfig', 'ini', 'cfg'], 'config', 'Configuration file'),
		darwinBundleDocumentType(['hh', 'hpp', 'hxx', 'h++'], 'cpp', 'C++ header file'),
		darwinBundleDocumentType(['cc', 'cpp', 'cxx', 'c++'], 'cpp', 'C++ source code'),
		darwinBundleDocumentType(['m'], 'default', 'Objective-C source code'),
		darwinBundleDocumentType(['mm'], 'cpp', 'Objective-C++ source code'),
		darwinBundleDocumentType(['cs', 'csx'], 'csharp', 'C# source code'),
		darwinBundleDocumentType(['css'], 'css', 'CSS'),
		darwinBundleDocumentType(['go'], 'go', 'Go source code'),
		darwinBundleDocumentType(['htm', 'html', 'xhtml'], 'HTML'),
		darwinBundleDocumentType(['jade'], 'Jade'),
		darwinBundleDocumentType(['jav', 'java'], 'Java'),
		darwinBundleDocumentType(['js', 'jscsrc', 'jshintrc', 'mjs', 'cjs'], 'Javascript', 'file'),
		darwinBundleDocumentType(['json'], 'JSON'),
		darwinBundleDocumentType(['less'], 'Less'),
		darwinBundleDocumentType(['markdown', 'md', 'mdoc', 'mdown', 'mdtext', 'mdtxt', 'mdwn', 'mkd', 'mkdn'], 'Markdown'),
		darwinBundleDocumentType(['php'], 'PHP', 'source code'),
		darwinBundleDocumentType(['ps1', 'psd1', 'psm1'], 'Powershell', 'script'),
		darwinBundleDocumentType(['py', 'pyi'], 'Python', 'script'),
		darwinBundleDocumentType(['gemspec', 'rb', 'erb'], 'Ruby', 'source code'),
		darwinBundleDocumentType(['scss', 'sass'], 'SASS', 'file'),
		darwinBundleDocumentType(['sql'], 'SQL', 'script'),
		darwinBundleDocumentType(['ts'], 'TypeScript', 'file'),
		darwinBundleDocumentType(['tsx', 'jsx'], 'React', 'source code'),
		darwinBundleDocumentType(['vue'], 'Vue', 'source code'),
		darwinBundleDocumentType(['ascx', 'csproj', 'dtd', 'plist', 'wxi', 'wxl', 'wxs', 'xml', 'xaml'], 'XML'),
		darwinBundleDocumentType(['eyaml', 'eyml', 'yaml', 'yml'], 'YAML'),
		darwinBundleDocumentType([
			'bash', 'bash_login', 'bash_logout', 'bash_profile', 'bashrc',
			'profile', 'rhistory', 'rprofile', 'sh', 'zlogin', 'zlogout',
			'zprofile', 'zsh', 'zshenv', 'zshrc'
		], 'Shell', 'script'),
		...darwinBundleDocumentTypes({
			'Clojure source code': ['clj', 'cljs', 'cljx', 'clojure'],
			'VS Code workspace file': 'code-workspace',
			'CoffeeScript source code': 'coffee',
			'Comma Separated Values': 'csv',
			'CMake script': 'cmake',
			'Dart script': 'dart',
			'Diff file': 'diff',
			'Dockerfile': 'dockerfile',
			'Gradle file': 'gradle',
			'Groovy script': 'groovy',
			'Makefile': ['makefile', 'mk'],
			'Lua script': 'lua',
			'Pug document': 'pug',
			'Jupyter': 'ipynb',
			'Lockfile': 'lock',
			'Log file': 'log',
			'Plain Text File': 'txt',
			'Xcode project file': 'xcodeproj',
			'Xcode workspace file': 'xcworkspace',
			'Visual Basic script': 'vb',
			'R source code': 'r',
			'Rust source code': 'rs',
			'Restructured Text document': 'rst',
			'LaTeX document': ['tex', 'cls'],
			'F# source code': 'fs',
			'F# signature file': 'fsi',
			'F# script': ['fsx', 'fsscript'],
			'SVG document': ['svg'],
			'TOML document': 'toml',
			'Swift source code': 'swift',
		}, 'default'),
		darwinBundleDocumentType([
			'containerfile', 'ctp', 'dot', 'edn', 'handlebars', 'hbs', 'ml', 'mli',
			'pl', 'pl6', 'pm', 'pm6', 'pod', 'pp', 'properties', 'psgi', 'rt', 't'
		], 'default', product.nameLong + ' document'),
		darwinBundleDocumentType([], 'default', 'Folder', ['public.folder'])
	],
	darwinBundleURLTypes: [{
		role: 'Viewer',
		name: product.nameLong,
		urlSchemes: [product.urlProtocol]
	}],
	darwinForceDarkModeSupport: true,
	darwinCredits: darwinCreditsTemplate ? Buffer.from(darwinCreditsTemplate({ commit: commit, date: new Date().toISOString() })) : undefined,
	linuxExecutableName: product.applicationName,
	winIcon: 'resources/win32/code.ico',
	token: process.env['GITHUB_TOKEN'],
	repo: product.electronRepository || undefined,
	validateChecksum: false,
	checksumFile: path.join(root, 'build', 'checksums', 'electron.txt'),
};

function getElectron(arch: string): () => NodeJS.ReadWriteStream {
	return () => {
		const electron = require('@vscode/gulp-electron');
		const json = require('gulp-json-editor') as typeof import('gulp-json-editor');

		const electronOpts = {
			...config,
			platform: process.platform,
			arch: arch === 'armhf' ? 'arm' : arch,
			ffmpegChromium: false,
			keepDefaultApp: true
		};

		return vfs.src('package.json')
			.pipe(json({ name: product.nameShort }))
			.pipe(electron(electronOpts))
			.pipe(filter(['**', '!**/app/package.json']))
			.pipe(vfs.dest('.build/electron'));
	};
}

async function main(arch: string = process.arch): Promise<void> {
	const electronPath = path.join(root, '.build', 'electron');
	const exeName = process.platform === 'win32' ? (product.nameShort + '.exe') : product.nameShort;
	const targetExe = path.join(electronPath, exeName);

	if (fs.existsSync(targetExe)) {
		return;
	}

	if (!fs.existsSync(electronPath)) {
		fs.mkdirSync(electronPath, { recursive: true });
	}

	try {
		await util.streamToPromise(getElectron(arch)());
	} catch (e) {
		console.warn('gulp-electron stream warning:', e);
	}

	if (process.platform === 'win32') {
		const electronExe = path.join(electronPath, 'electron.exe');
		if (fs.existsSync(electronExe) && !fs.existsSync(targetExe)) {
			fs.copyFileSync(electronExe, targetExe);
		}
	}

	const versionFile = path.join(electronPath, 'version');
	if (!fs.existsSync(versionFile)) {
		fs.writeFileSync(versionFile, electronVersion);
	}
}

if (require.main === module) {
	main(process.argv[2]).catch(err => {
		console.error(err);
		process.exit(1);
	});
}
