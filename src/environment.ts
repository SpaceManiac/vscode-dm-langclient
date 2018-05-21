// Utilities for dealing with the `.dme` file in relation to the workspace.
'use strict';

import * as fs from 'fs';
import { Readable } from 'stream';
import { workspace, WorkspaceEdit, Uri, Position, Range } from 'vscode';
import * as readline from 'readline';
import { promisify } from './misc';

export function is_tickable(include: string): boolean {
    return include.endsWith(".dm") || include.endsWith(".dmm") || include.endsWith(".dmf");
}

export async function is_ticked(uri: Uri, include: string): Promise<boolean | undefined> {
    if (!is_tickable(include)) {
        return undefined;
    }

    let env = await EnvironmentFile.from_uri(uri);
    include = include.replace("/", "\\");

    for (let file of env.includes) {
        if (file == include) {
            return true;
        }
    }
    return false;
}

export async function toggle_ticked(environment_uri: Uri, include: string): Promise<WorkspaceEdit> {
    // parse the environment
    let env = await EnvironmentFile.from_uri(environment_uri);
    include = include.replace("/", "\\");

    // generate the workspace edit: either insert or delete the given line
    let edit = new WorkspaceEdit();
    let line = env.header.length;
    for (let file of env.includes) {
        if (file == include) {
            edit.delete(environment_uri, new Range(line, 0, line + 1, 0));
            return edit;
        } else if (sort_less(include, file)) {
            break;
        }
        ++line;
    }
    edit.insert(environment_uri, new Position(line, 0), `${EnvironmentFile.PREFIX}${include}${EnvironmentFile.SUFFIX}\n`);
    return edit;
}

function sort_less(a: string, b: string) {
    let parts_a = a.split("\\"), parts_b = b.split("\\");
    for (let i = 0;; ++i) {
        let part_a = parts_a[i].toLowerCase(), part_b = parts_b[i].toLowerCase();
        if (i == parts_a.length - 1 && i == parts_b.length - 1) {
            // files in the same directory sort by their extension first
            let bits_a = part_a.split("."), bits_b = part_b.split(".");
            let ext_a = bits_a[bits_a.length - 1].toLowerCase(), ext_b = bits_b[bits_b.length - 1].toLowerCase();
            if (ext_a != ext_b) {
                return ext_a < ext_b;
            }
            // and then by their filename
            return part_a < part_b;
        } else if (i == parts_a.length - 1) {
            // files sort before directories
            return true;
        } else if (i == parts_b.length - 1) {
            // directories sort after files
            return false;
        } else if (part_a != part_b) {
            // directories sort by their name
            return part_a < part_b;
        }
    }
}

export class EnvironmentFile {
    static BEGIN = "// BEGIN_INCLUDE";
    static END = "// END_INCLUDE";
    static PREFIX = "#include \"";
    static SUFFIX = "\"";

    // tuples of (line number, line contents)
    header: string[] = [];
    includes: string[] = [];
    footer: string[] = [];

    static async from_uri(uri: Uri): Promise<EnvironmentFile> {
        // find the environment file either in the open documents or on the filesystem
        let stream;
        for (let candidate of workspace.textDocuments) {
            if (candidate.uri.fsPath == uri.fsPath) {
                stream = new Readable();
                stream.push(candidate.getText());
                stream.push(null);
            }
        }
        if (!stream) {
            if (uri.scheme !== 'file') {
                throw `Cannot open non-file scheme "${uri.scheme}" in ${uri}`;
            }
            stream = fs.createReadStream(uri.fsPath);
        }
        return EnvironmentFile.from_stream(stream);
    }

    static async from_stream(input: Readable): Promise<EnvironmentFile> {
        let reader = readline.createInterface({ input });
        let env = new EnvironmentFile();

        let stage = 0;
        reader.on('line', (line: string) => {
            if (stage == 0) {
                env.header.push(line);
                if (line == EnvironmentFile.BEGIN) {
                    stage = 1;
                }
            } else if (stage == 1) {
                if (line == EnvironmentFile.END) {
                    env.footer.push(line);
                    stage = 2;
                } else if (line.startsWith(EnvironmentFile.PREFIX) && line.endsWith(EnvironmentFile.SUFFIX)) {
                    env.includes.push(line.substring(EnvironmentFile.PREFIX.length, line.length - EnvironmentFile.SUFFIX.length));
                }
                // junk lines in the INCLUDE section are discarded
            } else if (stage == 2) {
                env.footer.push(line);
            }
        });
        await promisify(reader.once, reader)("close");
        return env;
    }
}
