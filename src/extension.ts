'use strict';

import { workspace, ExtensionContext } from 'vscode';
import * as languageclient from 'vscode-languageclient';

export async function activate(context: ExtensionContext) {
	// The server is implemented in Rust
	let serverCommand: string | undefined = workspace.getConfiguration('dreammaker').get('langserverPath');
	if (!serverCommand) {
		/// TODO: something reasonable
		return;
	}
	let serverOptions: languageclient.Executable = { command: serverCommand, args: [] };

	// Options to control the language client
	let clientOptions: languageclient.LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'dm' }],
		// Synchronize the settings to the server
		synchronize: { configurationSection: 'dreammaker' }
	};

	// Create the language client and start the client.
	let disposable = new languageclient.LanguageClient('dm-langserver', 'DreamMaker Language Server', serverOptions, clientOptions).start();

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
}
