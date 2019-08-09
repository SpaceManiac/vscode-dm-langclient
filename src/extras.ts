// Nonstandard extensions to the LSP used by dm-langserver.
'use strict';

import { NotificationType, SymbolKind, Location } from 'vscode-languageclient';

export const WindowStatus: NotificationType<WindowStatusParams, {}> = new NotificationType('$window/status');
export interface WindowStatusParams {
    environment: string | undefined,
    tasks: string[] | undefined,
}

export const ObjectTree: NotificationType<ObjectTreeParams, {}> = new NotificationType('experimental/dreammaker/objectTree');
export interface ObjectTreeParams {
    root: ObjectTreeType,
}
export interface ObjectTreeEntry {
    name: string,
    kind: SymbolKind,
    location: Location | undefined,
}
export interface ObjectTreeType extends ObjectTreeEntry {
    vars: ObjectTreeVar[],
    procs: ObjectTreeProc[],
    children: ObjectTreeType[],
}
export interface ObjectTreeVar extends ObjectTreeEntry {
    is_declaration: boolean,
}
export interface ObjectTreeProc extends ObjectTreeEntry {
    is_verb: boolean | undefined,
}

export const Reparse: NotificationType<{}, {}> = new NotificationType('experimental/dreammaker/reparse');
export const Recompile: NotificationType<{}, {}> = new NotificationType('experimental/dreammaker/recompile');