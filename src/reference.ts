// File system provider which serves HTML excerpts from the BYOND reference.
'use strict';

import { Uri, TextDocumentContentProvider, commands, ViewColumn, TextEditor } from "vscode";
import { CancellationToken, Emitter } from "vscode-jsonrpc";
import { readFile } from "./misc";
import * as config from './config';

const AUTHORITY = "singlepage";

export class Provider implements TextDocumentContentProvider {
    public scheme: string = "byond-docs";
    private singlepage_uri = Uri.parse(`${this.scheme}://${AUTHORITY}/`);

    private change_emitter = new Emitter<Uri>();
    public onDidChange = this.change_emitter.event;

    private last_dm_path: string | undefined;

    public async open_reference(dm_path?: string) {
        this.last_dm_path = dm_path;
        this.change_emitter.fire(this.singlepage_uri);
        return commands.executeCommand("vscode.previewHtml", this.singlepage_uri, ViewColumn.Two, "DM Reference");
    }

    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | undefined> {
        //assert uri.scheme == this.scheme
        if (uri.authority == AUTHORITY) {
            return this.provideSinglePage();
        } else if (uri.authority == 'reference') {
            // Open the reference and return a blank page - see check_kill_ed.
            // This is done because Workspace Symbol Search will try to open
            // the URL the language server returns as a normal text document,
            // and we want an HTML preview.
            this.open_reference(uri.fragment);
            return "";
        }
    }

    // Close the dummy editor created by Workspace Symbol Search.
    public check_kill_ed(ed: TextEditor | undefined) {
        if (ed) {
            if (ed.document.uri.scheme == this.scheme && ed.document.uri.authority != AUTHORITY) {
                commands.executeCommand("workbench.action.closeActiveEditor");
            }
        }
    }

    private async provideSinglePage(): Promise<string> {
        // Read the reference HTML
        const directory: string | undefined = await config.byond_path();
        if (!directory) {
            return "You must <a href='command:workbench.action.openSettings'>configure</a> <tt>dreammaker.byondPath</tt> to use the pop-up reference.";
        }

        let body;
        let dm_path = this.last_dm_path && this.last_dm_path.replace(/>/g, "&gt;").replace(/</g, "&lt;");
        if (dm_path) {
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
