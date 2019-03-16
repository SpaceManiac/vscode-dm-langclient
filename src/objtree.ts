import { window, TreeDataProvider, TreeItem, ProviderResult, TreeItemCollapsibleState, DocumentSelector, Uri, Command, ThemeIcon } from "vscode";
import { Emitter } from "vscode-jsonrpc";
import { StaticFeature, ClientCapabilities, ServerCapabilities, SymbolKind } from "vscode-languageclient";
import { ObjectTreeParams, ObjectTreeEntry, ObjectTreeType } from "./extras";

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
        let uri: Uri | undefined;
        let command: Command | undefined;

        if (element.location) {
            if (element.location.uri.startsWith('dm://docs/reference.dm')) {
                uri = Uri.parse(element.location.uri);
                command = {
                    title: "Open DM Reference",
                    command: 'dreammaker.openReference',
                    arguments: [uri.fragment],
                };
            } else {
                uri = Uri.parse(element.location.uri).with({fragment: `${1 + element.location.range.start.line}`});
                command = {
                    title: "Go to Definition",
                    command: 'vscode.open',
                    arguments: [uri],
                };
            }
        }

        let hasChildren;
        if (element instanceof VarsFolder || element instanceof ProcsFolder) {
            hasChildren = true;
        } else if (element.kind == SymbolKind.Class) {
            let type = element as ObjectTreeType;
            hasChildren = type.vars.length || type.procs.length || type.children.length;
        }

        return {
            label: element.name,
            command: command,
            iconPath: element.location ? ThemeIcon.File : ThemeIcon.Folder,
            collapsibleState: hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
        };
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
        let experimental = (capabilities.experimental || (capabilities.experimental = {}));
        let dreammaker = (experimental.dreammaker || (experimental.dreammaker = {}));
        dreammaker.objectTree = true;
    }

    initialize(capabilities: ServerCapabilities, documentSelector: DocumentSelector | undefined): void {
        // nothing
    }
}
