// Nonstandard extensions to the LSP used by dm-langserver.
'use strict';

import { NotificationType, SymbolKind, Location, RequestType } from 'vscode-languageclient';

// ----------------------------------------------------------------------------
// WindowStatus
export const WindowStatus: NotificationType<WindowStatusParams, {}> = new NotificationType('$window/status');
export interface WindowStatusParams {
    environment: string | undefined,
    tasks: string[] | undefined,
}

// ----------------------------------------------------------------------------
// ObjectTree
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
    n_vars?: number,
    n_procs?: number,
    n_children?: number,

    path?: string,
}
export interface ObjectTreeVar extends ObjectTreeEntry {
    is_declaration: boolean,
}
export interface ObjectTreeProc extends ObjectTreeEntry {
    is_verb: boolean | undefined,
}

// ----------------------------------------------------------------------------
// ObjectTree2
export const ObjectTree2: NotificationType<ObjectTree2Params, {}> = new NotificationType('experimental/dreammaker/objectTree2');
export interface ObjectTree2Params {
}

export const QueryObjectTree: RequestType<QueryObjectTreeParams, QueryObjectTreeResult, void, void> = new RequestType('experimental/dreammaker/objectTree2');
export interface QueryObjectTreeParams {
    path: string;
}
export type QueryObjectTreeResult = ObjectTreeType;

// ----------------------------------------------------------------------------
// Reparse
export const Reparse: NotificationType<{}, {}> = new NotificationType('experimental/dreammaker/reparse');

// ----------------------------------------------------------------------------
// StartDebugger
// params, result, error, registration options
export const StartDebugger: RequestType<StartDebuggerParams, StartDebuggerResult, void, void> = new RequestType('experimental/dreammaker/startDebugger');
export interface StartDebuggerParams {
    dreamseeker_exe: string,
    env: Record<string, string> | undefined,
}
export interface StartDebuggerResult {
    port: number,
}
