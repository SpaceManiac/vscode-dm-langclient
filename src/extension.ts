'use strict';

import * as os from 'os';
import * as fs from 'fs';
import { workspace, window, ExtensionContext } from 'vscode';
import * as languageclient from 'vscode-languageclient';

import { promisify, is_executable, md5_file } from './misc';

export async function activate(context: ExtensionContext) {
	await start_language_client(context);
}

let lc: languageclient.LanguageClient;

async function start_language_client(context: ExtensionContext) {
	let command = await determine_server_command(context);
	if (!command) {
		return;
	}

	const serverOptions: languageclient.Executable = {
		command: command,
		args: []
	};

	const clientOptions: languageclient.LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'dm' }],
		// Synchronize the settings to the server
		synchronize: { configurationSection: 'dreammaker' }
	};

	lc = new languageclient.LanguageClient('dm-langserver', "DreamMaker Language Server", serverOptions, clientOptions);
	context.subscriptions.push(lc.start());
}

async function determine_server_command(context: ExtensionContext): Promise<string | undefined> {
	// If the config override is set, use that, and don't autoupdate
	const serverCommand: string | undefined = workspace.getConfiguration('dreammaker').get('langserverPath');
	if (serverCommand) {
		if (await is_executable(serverCommand)) {
			return serverCommand;
		} else {
			return await prompt_for_server_command(context, "Configured executable is missing or invalid.");
		}
	}

	// Nothing is set in the config.
	const arch = os.arch(), platform = os.platform();
	const extension = (platform == 'win32') ? ".exe" : "";
	const auto_file = `${context.extensionPath}/bin/dm-langserver-${arch}-${platform}${extension}`;
	const update_file = `${auto_file}.update`;
	if (await is_executable(`${auto_file}.update`)) {
		await promisify(fs.rename)(update_file, auto_file);
	}

	if (await is_executable(auto_file)) {
		// If the executable is already valid, run it now, and update later.
		auto_update(context, platform, arch, update_file, await md5_file(auto_file));
		return auto_file;
	} else {
		// Otherwise, update now.
		await auto_update(context, platform, arch, auto_file, null);
	}
}

async function prompt_for_server_command(context: ExtensionContext, message: string): Promise<string | undefined> {
	// Show an info/confirmation before browsing...
	const choice = await window.showInformationMessage(`The dm-langserver executable must be selected. ${message}`, "Browse", "Cancel");
	if (choice === "Cancel") {
		return undefined;
	}
	// Browse for the executable...
	const list = await window.showOpenDialog({});
	if (!list) {
		return undefined;
	}
	/// And update the config.
	const path = list[0].fsPath;
	workspace.getConfiguration('dreammaker').update('langserverPath', path, true);
	return path;
}

async function auto_update(context: ExtensionContext, platform: string, arch: string, out_file: string, hash: string | null): Promise<string | undefined> {
	let url = `https://wombat.platymuus.com/ss13/dm-langserver/update.php?platform=${platform}&arch=${arch}`;
	if (hash) {
		url += `&hash=${hash}`;
	}
	console.log(url);

	// If hash provided, notify on success. Otherwise, notify on failure.
	if (!hash) {
		return await prompt_for_server_command(context, `Binaries are not available for ${arch}-${platform}.`);
	} else {
		return undefined;
	}
}
