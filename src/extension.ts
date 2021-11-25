// Main module for dm-langclient extension.
'use strict';

import * as os from 'os';
import * as fs from 'fs';
import { workspace, window, commands, ExtensionContext, StatusBarItem, StatusBarAlignment, Uri, TextEditor, ConfigurationTarget, Position } from 'vscode';
import * as vscode from 'vscode';
import * as languageclient from 'vscode-languageclient';
import fetch from 'node-fetch';
import * as mkdirp from 'mkdirp';
import * as path from 'path';

import { promisify, is_executable, md5_file, sleep } from './misc';
import * as extras from './extras';
import * as environment from './environment';
import * as reference from './reference';
import * as config from './config';
import * as tasks from './tasks';
import * as objtree from './objtree';

let lc: languageclient.LanguageClient;
let status: StatusBarItem;
let ticked_status: StatusBarItem;
let update_available: boolean = false;
let environment_file: string | null = null;
let docs_provider: reference.Provider;

// Entry point.
export async function activate(context: ExtensionContext) {
	// prepare the status bar
	status = window.createStatusBarItem(StatusBarAlignment.Left, 10);
	status.text = "DM: starting";
	status.command = 'dreammaker.restartLangserver';
	status.show();

	ticked_status = window.createStatusBarItem(StatusBarAlignment.Right, 100);
	ticked_status.command = 'dreammaker.toggleTicked';
	context.subscriptions.push(window.onDidChangeActiveTextEditor(update_ticked_status));
	update_ticked_status();

	// register commands
	context.subscriptions.push(commands.registerCommand('dreammaker.restartLangserver', async () => {
		status.text = "DM: restarting";
		update_available = false;
		try {
			await lc.stop();
		} catch(_) {}
		return start_language_client_catch(context);
	}));
	context.subscriptions.push(commands.registerCommand('dreammaker.toggleTicked', async () => {
		if (!window.activeTextEditor) {
			return;
		}
		if (await toggle_ticked(window.activeTextEditor.document.uri)) {
			await update_ticked_status();
		} else {
			await window.showErrorMessage("Editing .dme file failed");
		}
	}));
	context.subscriptions.push(commands.registerCommand('dreammaker.openReference', async (dm_path: string) => {
		return docs_provider.open_reference(dm_path);
	}));

	context.subscriptions.push(commands.registerCommand('dreammaker.findReferencesTree', async (element: extras.ObjectTreeEntry) => {
		if (!element || !element.location) {
			return;
		}

		// Transform from language server elements to vscode classes. Otherwise
		// the invoked command will simply look at cursor position.
		let uri = Uri.parse(element.location.uri);
		let start = element.location.range.start;
		let position = new Position(start.line, start.character);
		return await commands.executeCommand("references-view.find", uri, position);
	}));

	context.subscriptions.push(commands.registerCommand('dreammaker.getFilenameDme', () => {
		return environment_file;
	}));

	context.subscriptions.push(commands.registerCommand('dreammaker.getFilenameDmb', () => {
		return environment_file && environment_file.replace(/\.dme$/, ".dmb");
	}));

	context.subscriptions.push(commands.registerCommand('dreammaker.returnDreamDaemonPath', async () => {
		return config.find_byond_file(config.DREAM_DAEMON);
	}));

	context.subscriptions.push(commands.registerCommand('dreammaker.reparse', async () => {
		if (lc) {
			lc.sendNotification(extras.Reparse, {});
		}
	}));

	// register the docs provider
	docs_provider = new reference.Provider();
	context.subscriptions.push(workspace.registerTextDocumentContentProvider(docs_provider.scheme, docs_provider));
	context.subscriptions.push(window.onDidChangeActiveTextEditor((ed) => docs_provider.check_kill_ed(ed)));

	// listen to UI delete/create/rename events to do autoticking,
	// because that's when it matters
	context.subscriptions.push(workspace.onDidDeleteFiles(async (event) => {
		if (await config.tick_on_create()) {
			for (let file_uri of event.files) {
				await toggle_ticked(file_uri, false);
			}
		}
	}));
	context.subscriptions.push(workspace.onDidCreateFiles(async (event) => {
		if (await config.tick_on_create()) {
			for (let file_uri of event.files) {
				await toggle_ticked(file_uri, true);
			}
			await update_ticked_status();
		}
	}));
	context.subscriptions.push(workspace.onDidRenameFiles(async (event) => {
		if (await config.tick_on_create()) {
			for (let { oldUri, newUri } of event.files) {
				if (await toggle_ticked(oldUri, false)) {
					await toggle_ticked(newUri, true);
				}
			}
			await update_ticked_status();
		}
	}));

	// create the task provider for convenient Ctrl+Shift+B
	context.subscriptions.push(vscode.tasks.registerTaskProvider("dreammaker", new tasks.Provider()));
	context.subscriptions.push(vscode.tasks.onDidStartTask((event) => {
		// Checking .type will get us "process", because the task has already
		// been resolved. Just see if the name looks like a ".dme" file.
		if (lc && event.execution.task.name.endsWith(".dme")) {
			// When Ctrl+Shift+B is pressed, reparse without resetting.
			lc.sendNotification(extras.Reparse, {});
		}
	}));

	// I don't really know why this is necessary. The debug configuration this
	// provider returns is the same as the one in "initialConfigurations" in
	// package.json, but apparently VSC uses that only when creating a new
	// launch.json and not when handling an F5 press when a launch.json does
	// not exist.
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('byond', {
		async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
			// Called with debugConfiguration = {} if launch.json does not exist.
			return debugConfiguration.type ? debugConfiguration : {
				"type": "byond",
				"request": "launch",
				"name": "Launch DreamSeeker",
				"preLaunchTask": "dm: build - ${command:CurrentDME}",
				"dmb": "${workspaceFolder}/${command:CurrentDMB}",
				"noDebug": debugConfiguration.noDebug || false,
			};
		}
	}));
	// register debugger factory to point at langserver's debugger mode
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('byond', {
		async createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.DebugAdapterDescriptor | null> {
			if (!lc) {
				return null;
			}

			let dreamseeker_exe = await config.find_byond_file(session.configuration.dreamDaemon ? config.DREAM_DAEMON : config.DREAM_SEEKER);
			if (!dreamseeker_exe) {
				return null;
			}

			let result = await lc.sendRequest(extras.StartDebugger, { dreamseeker_exe });
			return new vscode.DebugAdapterServer(result.port);
		}
	}));

	// start the language client
	await start_language_client_catch(context);
}

async function update_ticked_status(editor?: TextEditor | undefined) {
	let ticked = undefined;
	if (!editor) {
		editor = window.activeTextEditor;
	}
	if (editor) {
		let discovered = environment_uri(editor.document.uri);
		if (discovered) {
			let [uri, relative] = discovered;
			ticked = await environment.is_ticked(uri, relative);
		}
	}

	if (typeof ticked === 'undefined') {
		ticked_status.hide();
	} else {
		ticked_status.text = ticked ? "Ticked" : "Unticked";
		ticked_status.show();
	}
}

function environment_uri(of: Uri): [Uri, string] | undefined {
	let root = workspace.getWorkspaceFolder(of);
	if (!root || root.uri.scheme !== 'file' || !environment_file) {
		return;
	}

	let relative = workspace.asRelativePath(of, false);
	if (!relative || relative == of.fsPath) {
		return;
	}

	return [Uri.file(path.join(root.uri.fsPath, environment_file)), relative];
}

async function toggle_ticked(file_uri: Uri, state?: boolean | undefined): Promise<boolean | undefined> {
	if (!file_uri) {
		return;
	}

	let discovered = environment_uri(file_uri);
	if (!discovered) {
		return;
	}

	let [uri, relative] = discovered;
	if (!environment.is_tickable(relative)) {
		return;
	}

	let edit = await environment.toggle_ticked(uri, relative, state);
	if (!edit) {
		return;
	}
	return workspace.applyEdit(edit);
}

async function start_language_client_catch(context: ExtensionContext) {
	try {
		await start_language_client(context);
	} catch (e) {
		status.text = "DM: crashed";
		console.log(e);
	}
}

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
	if (await config.object_tree_pane()) {
		lc.registerFeature(new objtree.ObjectTreeFeature());
	}
	context.subscriptions.push(lc.start());
	progress_counter();
}

async function progress_counter() {
	let environment = "DM";

	await lc.onReady();
	lc.onNotification(extras.WindowStatus, async message => {
		if (message.environment) {
			environment = message.environment;
			environment_file = `${environment}.dme`;
			update_ticked_status();
		}
		let tasks: string[] = message.tasks || [];

		if (tasks.length == 0) {
			status.text = `${environment}`;
			status.tooltip = "Reparse environment";
		} else if (tasks.length == 1) {
			let element = tasks[0];
			status.text = `${environment}: ${element}`;
			status.tooltip = undefined;

			// Special handling for the "no .dme file" error message.
			if (element == "no .dme file") {
				status.tooltip = "Open Folder the directory containing your .dme file";
				status.command = 'vscode.openFolder';
				await lc.stop();
				let result = await window.showInformationMessage("The DreamMaker language server requires access to your project's `.dme` file. Please use the \"Open Folder\" command to open the folder which contains it.", "Open Folder");
				if (result === "Open Folder") {
					await commands.executeCommand('vscode.openFolder');
				}
			}
		} else {
			status.text = `${environment}: ${tasks.length} tasks...`;
			status.tooltip = tasks.join("\n");
		}
		if (update_available) {
			status.text += ' - click to update';
		}
	});
	lc.onNotification(extras.ObjectTree, message => {
		commands.executeCommand('setContext', 'dreammakerObjtreeReady', true);
		objtree.get_provider().update(message);
	});
}

async function determine_server_command(context: ExtensionContext): Promise<string | undefined> {
	// If the config override is set, use that, and don't autoupdate.
	const server_command: string | undefined = workspace.getConfiguration('dreammaker').get('langserverPath');
	if (server_command) {
		// ".update" files are still supported here to allow easy updating of
		// local builds.
		await update_copy(server_command, `${server_command}.update`);
		if (await is_executable(server_command)) {
			return server_command;
		} else {
			return await prompt_for_server_command(context, "Configured executable is missing or invalid.");
		}
	}

	// Nothing is set in the config.
	const arch = os.arch(), platform = os.platform();
	const extension = (platform == 'win32') ? ".exe" : "";
	const auto_file = `${context.extensionPath}/bin/dm-langserver-${arch}-${platform}${extension}`;
	const update_file = `${auto_file}.update`;
	await update_copy(auto_file, update_file);

	if (await is_executable(auto_file)) {
		// If the executable is already valid, run it now, and update later.
		auto_update(context, platform, arch, update_file, await md5_file(auto_file));
	} else {
		// Otherwise, update now.
		await mkdirp(`${context.extensionPath}/bin/`);
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

async function update_copy(main_file: string, update_file: string) {
	for (let i = 0; i < 8; ++i) {
		if (!await is_executable(update_file)) {
			return;
		}
		try {
			await promisify(fs.rename)(update_file, main_file);
			return;
		} catch(e) {}
		// If this fails, it might be because the old process is still
		// running in this window. Wait a bit and try again.
		await sleep(250);
	}
	// Last chance, and if it really fails, propagate that up.
	await promisify(fs.rename)(update_file, main_file);
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
	workspace.getConfiguration('dreammaker').update('langserverPath', path, ConfigurationTarget.Global);
	return path;
}

async function cert_config_hack(): Promise<void> {
	// See https://github.com/SpaceManiac/SpacemanDMM/issues/298
	// and https://github.com/microsoft/vscode/issues/136787
	if (workspace.getConfiguration('http').get<boolean>('systemCertificates')) {
		// Set a sentinel so that we know that we set it rather than the user, and thus we can revert it later.
		await workspace.getConfiguration('dreammaker').update('httpSystemCertificatesHack', true, ConfigurationTarget.Global);
		await workspace.getConfiguration('http').update('systemCertificates', false, ConfigurationTarget.Global);
		// Setting docs say that a window reload is required for it to take effect.
		await vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
	// Already tried applying the hack and it didn't work, so give up.
}

async function auto_update(context: ExtensionContext, platform: string, arch: string, out_file: string, hash: string | null): Promise<string | undefined> {
	if (!await config.auto_update()) {
		return "Auto-update disabled.";
	}

	let version = vscode.extensions.getExtension('platymuus.dm-langclient')!.packageJSON.version;
	let url = `https://wombat.platymuus.com/ss13/dm-langserver/update.php?vscode=${version}&platform=${platform}&arch=${arch}`;
	if (hash) {
		url += `&hash=${hash}`;
	}
	let res;
	try {
		res = await fetch(url);
	} catch (e) {
		// network error
		if (`${e}`.includes('certificate has expired')) {
			// Reloads the window if it succeeds, returns if it doesn't.
			await cert_config_hack();
		}
		return `${e}.`;
	}
	switch (res.status) {
		case 200:  // New version
			let stream = fs.createWriteStream(out_file, { encoding: 'binary', mode: 0o755 });
			res.body.pipe(stream);
			await promisify(stream.once, stream)('finish');

			// Unsophisticated integrity check meant to catch network errors.
			let wanted_hash = res.headers.get('x-md5');
			if (wanted_hash && wanted_hash != await md5_file(out_file)) {
				await promisify(fs.unlink)(out_file);
				return "Download interrupted. Check your network connection and try again.";
			}

			if (hash && !update_available) {
				update_available = true;
				status.text += ' - click to update';
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
			workspace.getConfiguration('dreammaker').update('autoUpdate', false, ConfigurationTarget.Global);
			return "Update endpoint removed, try updating the extension.";
		default:  // Error
			return `Server returned ${res.status} ${res.statusText}.`;
	}
}
