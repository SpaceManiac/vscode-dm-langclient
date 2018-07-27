// File system provider which serves HTML excerpts from the BYOND reference.
'use strict';

import { Uri, TextDocumentContentProvider, ViewColumn, TextEditor, WebviewPanel, window, commands } from "vscode";
import { CancellationToken, Emitter } from "vscode-jsonrpc";
import { readFile } from "./misc";
import * as config from './config';

let panel: WebviewPanel | null = null;

function open_panel(html: string): WebviewPanel {
    if (!panel) {
        panel = window.createWebviewPanel("dreammaker.reference", "DM Reference", ViewColumn.Two, {
            enableCommandUris: true,
            enableFindWidget: true,
        });
        panel.onDidDispose(() => {
            panel = null;
        });
    }
    panel.webview.html = html;
    return panel;
}

export class Provider implements TextDocumentContentProvider {
    public scheme: string = "dm";

    private change_emitter = new Emitter<Uri>();
    public onDidChange = this.change_emitter.event;

    public async open_reference(dm_path?: string) {
        open_panel(await this.reference_contents(dm_path));
    }

    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | undefined> {
        //assert uri.scheme == this.scheme
        if (uri.authority === 'docs' && uri.path === '/reference.dm') {
            // Return a snippet which will appear in the Go To Definition hover
            // preview. If Workspace Symbol Search is used or the definition
            // is actually gone to, check_kill_ed below will open the webview
            // with the actual contents of the reference.
            return `${uri.fragment}  // in the reference`;
        }
    }

    // Close the dummy editor created by Workspace Symbol Search.
    public check_kill_ed(ed: TextEditor | undefined) {
        if (!ed || ed.document.uri.scheme !== this.scheme) {
            return;
        }
        let uri = ed.document.uri;
        if (uri.authority === 'docs' && uri.path === '/reference.dm') {
            this.open_reference(uri.fragment);
            if (ed.hide) {
                // deprecated
                ed.hide();
            } else {
                // might close the wrong editor
                commands.executeCommand("workbench.action.closeActiveEditor");
            }
        }
    }

    private async reference_contents(dm_path?: string): Promise<string> {
        // Read the reference HTML
        const directory: string | undefined = await config.byond_path();
        if (!directory) {
            return "You must <a href='command:workbench.action.openSettings'>configure</a> <tt>dreammaker.byondPath</tt> to use the pop-up reference.";
        }

        let body;
        if (dm_path) {
            dm_path = dm_path.replace(/>/g, "&gt;").replace(/</g, "&lt;");
            let fname = `${directory}/help/ref/info.html`;
            let contents = await readFile(fname, {encoding: 'latin1'});

            // Extract the section for the item being looked up
            let start = contents.indexOf(`<a name=${dm_path}>`);
            if (start < 0) {
                // Handle @dt; and @qu;
                start = contents.indexOf(`<a name=${dm_path} toc=`);
                dm_path = dm_path.replace(/@dt;/g, ".").replace(/@qu;/g, '?');
            }
            if (start < 0) {
                // Handle constants which are subordinate to another entry
                let raw_name = dm_path.substr(1 + dm_path.lastIndexOf("/"));
                start = contents.indexOf(raw_name);
                start = contents.lastIndexOf("<a name=", start);
            }
            if (start < 0) {
                body = `No such entry <tt>${dm_path}</tt> in the reference.`;
            } else {
                start = contents.indexOf("\n", start);
                let end = contents.indexOf("<hr", start);
                body = contents.slice(start, end).toString();
            }
        } else {
            // Take the contents of the index file
            let fname = `${directory}/help/ref/contents.html`;
            let contents = await readFile(fname, {encoding: 'latin1'});
            body = contents.slice(contents.indexOf("<dl>")).toString();
        }

        // Replace all links with commands which will update the HTML preview
        body = body.replace(/(href=)(?:info\.html)?("?)#(\/[^">]+)/g, (_: any, p1: string, p2: string, dm_path: string) =>
            `${p1}${p2}command:dreammaker.openReference?${encodeURI(JSON.stringify(dm_path))}`);

        // Finalize the output
        return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none';">
</head>
<body>
<div style='margin:10px; padding:10px; background: rgba(128,128,128,0.2);'>
<b><tt>${dm_path || "/"}</tt></b> |
<a href="command:dreammaker.openReference">Index</a> |
<a href="command:workbench.action.showAllSymbols">Search</a> |
<a href="https://secure.byond.com/docs/ref/index.html">Online</a>
</div>
${body}
</body>
</html>`;
    }
}
