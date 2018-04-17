'use strict';

import * as os from 'os';
import * as fs from 'fs';
import { workspace, window, ExtensionContext, StatusBarItem, StatusBarAlignment } from 'vscode';
import * as languageclient from 'vscode-languageclient';
import fetch from 'node-fetch';
import * as mkdirp from 'mkdirp';

import { promisify, is_executable, md5_file, sleep } from './misc';

export async function activate(context: ExtensionContext) {
	status = window.createStatusBarItem(StatusBarAlignment.Left, 10);
	status.text = "DM: starting";
	status.show();
	await start_language_client(context);
}

let lc: languageclient.LanguageClient;
let status: StatusBarItem;

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
	progress_counter();
}

async function progress_counter() {
	let environment = "DM";

	await lc.onReady();
	lc.onNotification(new languageclient.NotificationType("$window/status"), function (message: any) {
		if (message.environment) {
			environment = message.environment;
		}
		let tasks: string[] = message.tasks || [];

		if (tasks.length == 0) {
			status.text = `${environment}`;
			status.tooltip = undefined;
		} else if (tasks.length == 1) {
			tasks.forEach(element => {
				status.text = `${environment}: ${element}`;
				status.tooltip = undefined;
			});
		} else {
			status.text = `${environment}: ${tasks.length} tasks...`;
			status.tooltip = tasks.join("\n");
		}
	});
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
	} else {
		// Otherwise, update now.
		await promisify(mkdirp)(`${context.extensionPath}/bin/`);
		const failure = await auto_update(context, platform, arch, auto_file, null);
		if (failure) {
			return await prompt_for_server_command(context, failure);
		}
		// Debounce to handle the file being busy if accessed by antivirus or
		// similar immediately after download.
		await sleep(500);
	}
	return auto_file;
}

async function prompt_for_server_command(context: ExtensionContext, message: string): Promise<string | undefined> {
	// Show an info/confirmation before browsing...
	const choice = await window.showInformationMessage(`The dm-langserver executable must be selected. ${message}`, "Browse", "Cancel");
	if (choice !== "Browse") {
		return;
	}
	// Browse for the executable...
	const list = await window.showOpenDialog({});
	if (!list) {
		return;
	}
	/// And update the config.
	const path = list[0].fsPath;
	workspace.getConfiguration('dreammaker').update('langserverPath', path, true);
	return path;
}

async function auto_update(context: ExtensionContext, platform: string, arch: string, out_file: string, hash: string | null): Promise<string | undefined> {
	let enabled: boolean | undefined = workspace.getConfiguration('dreammaker').get('autoUpdate');
	if (typeof enabled !== 'boolean') {
		let choice = await window.showInformationMessage("Auto-updates are available for dm-langserver. Would you like to enable them?", "Yes", "Just Once", "No");
		if (choice === "Yes") {
			enabled = true;
			workspace.getConfiguration('dreammaker').update('autoUpdate', true, true);
		} else if (choice === "Just Once") {
			enabled = true;
			workspace.getConfiguration('dreammaker').update('autoUpdate', false, true);
		} else if (choice === "No") {
			enabled = false;
			workspace.getConfiguration('dreammaker').update('autoUpdate', false, true);
		}
	}
	if (!enabled) {
		return "Auto-update disabled.";
	}

	let url = `https://wombat.platymuus.com/ss13/dm-langserver/update.php?platform=${platform}&arch=${arch}`;
	if (hash) {
		url += `&hash=${hash}`;
	}
	let res;
	try {
		res = await fetch(url);
	} catch (e) {
		// network error
		return `${e}.`;
	}
	switch (res.status) {
		case 200:  // New version
			let stream = fs.createWriteStream(out_file, { encoding: 'binary', mode: 0o755 });
			res.body.pipe(stream);
			await promisify(stream.once, stream)('finish');
			if (hash) {
				window.showInformationMessage("Updated dm-langserver, reload to activate.");
			}
			return;
		case 204:  // Unmodified
		case 304:
			if (hash) {
				return;
			}
			// if hash is not set, fallthrough
		case 404:  // Not found
			return `Binaries are not available for ${arch}-${platform}.`;
		case 410:  // Endpoint removed
			workspace.getConfiguration('dreammaker').update('autoUpdate', false, true);
			return "Update endpoint removed, try updating the extension.";
		default:  // Error
			return `Server returned ${res.status} ${res.statusText}.`;
	}
}
