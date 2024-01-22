import { window, TreeDataProvider, TreeItem, ProviderResult, TreeItemCollapsibleState, DocumentSelector, Uri, ThemeIcon } from "vscode";
import { Emitter } from "vscode-jsonrpc";
import { StaticFeature, ClientCapabilities, ServerCapabilities, SymbolKind } from "vscode-languageclient";
import { ObjectTreeParams, ObjectTreeEntry, ObjectTreeType, ObjectTreeVar, ObjectTreeProc } from "./extras";

let provider: TreeProvider;

export function get_provider(): TreeProvider {
    if (!provider) {
        provider = new TreeProvider();
        window.createTreeView("dreammaker-objtree", {
            showCollapseAll: true,
            treeDataProvider: provider,
        });
    }
    return provider;
}

class VarsFolder implements ObjectTreeEntry {
    name = "var";
    kind = SymbolKind.Namespace;
    location = undefined;
    type: ObjectTreeType;
    constructor(type: ObjectTreeType) {
        this.type = type;
    }
}

class ProcsFolder implements ObjectTreeEntry {
    name = "proc";
    kind = SymbolKind.Namespace;
    location = undefined;
    type: ObjectTreeType;
    constructor(type: ObjectTreeType) {
        this.type = type;
    }
}

export class TreeProvider implements TreeDataProvider<ObjectTreeEntry> {
    private data?: ObjectTreeParams;

    private change_emitter = new Emitter<ObjectTreeEntry | undefined>();
    onDidChangeTreeData = this.change_emitter.event;

    getTreeItem(element: ObjectTreeEntry): TreeItem {
        let item: TreeItem = {
            label: element.name,
            iconPath: element.location ? ThemeIcon.File : ThemeIcon.Folder,
            collapsibleState: TreeItemCollapsibleState.None,
        };

        if (element.location) {
            if (element.location.uri.startsWith('dm://docs/reference.dm')) {
                let uri = Uri.parse(element.location.uri);
                item.command = {
                    title: "Open DM Reference",
                    command: 'dreammaker.openReference',
                    arguments: [uri.fragment],
                };
            } else {
                let uri = Uri.parse(element.location.uri).with({ fragment: `${1 + element.location.range.start.line}` });
                item.command = {
                    title: "Go to Definition",
                    command: 'vscode.open',
                    arguments: [uri],
                };
            }
        }

        if (element instanceof VarsFolder || element instanceof ProcsFolder) {
            item.collapsibleState = TreeItemCollapsibleState.Collapsed;
        } else if (element.kind == SymbolKind.Class) {
            let type = element as ObjectTreeType;
            if (type.vars.length || type.procs.length || type.children.length) {
                item.collapsibleState = TreeItemCollapsibleState.Collapsed;
            }
            item.contextValue = 'symbol';
        } else if (element.kind == SymbolKind.Field) {
            let field = element as ObjectTreeVar;
            if (field.is_declaration) {
                item.description = "var";
            }
            item.contextValue = 'symbol';
        } else if (element.kind == SymbolKind.Method || element.kind == SymbolKind.Constructor || element.kind == SymbolKind.Function) {
            let proc = element as ObjectTreeProc;
            if (proc.is_verb !== null) {
                item.description = proc.is_verb ? "verb" : "proc";
            }
            item.contextValue = 'symbol';
        }

        return item;
    }

    getChildren(element?: ObjectTreeEntry | undefined): ProviderResult<ObjectTreeEntry[]> {
        if (!element) {
            if (!this.data) {
                return [];
            }
            element = this.data.root;
        }

        if (element instanceof VarsFolder) {
            return element.type.vars;
        } else if (element instanceof ProcsFolder) {
            return element.type.procs;
        } else if (element.kind == SymbolKind.Class) {
            let type = element as ObjectTreeType;
            let list: ObjectTreeEntry[] = [];
            if (type.vars.length) {
                list.push(new VarsFolder(type));
            }
            if (type.procs.length) {
                list.push(new ProcsFolder(type));
            }
            list.push(...type.children);
            return list;
        } else {
            return [];
        }
    }

    update(message: ObjectTreeParams) {
        this.data = message;
        this.change_emitter.fire(undefined);
    }
}

export class ObjectTreeFeature implements StaticFeature {
    fillClientCapabilities(capabilities: ClientCapabilities): void {
        let experimental: { dreammaker?: any } = (capabilities.experimental || (capabilities.experimental = {}));
        let dreammaker: any = (experimental.dreammaker || (experimental.dreammaker = {}));
        dreammaker.objectTree = true;
    }

    initialize(capabilities: ServerCapabilities, documentSelector: DocumentSelector | undefined): void {
        // nothing
    }
}
