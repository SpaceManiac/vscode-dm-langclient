'use strict';

import * as os from 'os';
import * as fs from 'fs';
import { workspace, window, ExtensionContext } from 'vscode';
import * as languageclient from 'vscode-languageclient';

import { promisify } from './misc';

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
	let serverCommand: string | undefined = workspace.getConfiguration('dreammaker').get('langserverPath');
	if (serverCommand) {
		try {
			console.log(await promisify(fs.access)(serverCommand, fs.constants.R_OK | fs.constants.X_OK));
			return serverCommand;
		} catch (e) {
			// Error indicates that the serverCommand isn't valid, fall through.
		}
		return await prompt_for_server_command(context, "Configured executable is missing or invalid.");
	}

	// Nothing is set in the config. What are you gonna do?
	return await prompt_for_server_command(context, "No executable configured.");
}

async function prompt_for_server_command(context: ExtensionContext, message: string): Promise<string | undefined> {
	// Show an info/confirmation before browsing...
	let choice = await window.showInformationMessage(`The dm-langserver executable must be selected. ${message}`, "Browse", "Cancel");
	if (choice === "Cancel") {
		return undefined;
	}
	// Browse for the executable...
	let list = await window.showOpenDialog({});
	if (!list) {
		return undefined;
	}
	/// And update the config.
	let path = list[0].fsPath;
	workspace.getConfiguration('dreammaker').update('langserverPath', path, true);
	return path;
}
