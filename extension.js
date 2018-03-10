'use strict';

let vscode = require('vscode');
let languageclient = require('vscode-languageclient');

exports.activate = function activate(context) {
	// The server is implemented in Rust
	let serverCommand = "dm-langserver.exe";
	let serverArgs = [];
	let serverOptions = { command: serverCommand, args: serverArgs };

	// Options to control the language client
	let clientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'dm' }],
		synchronize: {
			// Synchronize the settings to the server
			configurationSection: 'dreammaker',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	let disposable = new languageclient.LanguageClient('dm-langserver', 'DreamMaker Language Server', serverOptions, clientOptions).start();

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
};
