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
    roots: ObjectTreeEntry[],
}
export interface ObjectTreeEntry {
    name: string,
    kind: SymbolKind,
    location: Location | undefined,
    children: ObjectTreeEntry[],
}
