import { window, TreeDataProvider, TreeItem, ProviderResult, TreeItemCollapsibleState, DocumentSelector, Uri } from "vscode";
import { Emitter } from "vscode-jsonrpc";
import { StaticFeature, ClientCapabilities, ServerCapabilities } from "vscode-languageclient";
import { ObjectTreeParams, ObjectTreeEntry } from "./extras";

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

export class TreeProvider implements TreeDataProvider<ObjectTreeEntry> {
    private roots: ObjectTreeEntry[] = [];
    private change_emitter = new Emitter<ObjectTreeEntry | undefined>();
    onDidChangeTreeData = this.change_emitter.event;

    getTreeItem(element: ObjectTreeEntry): TreeItem {
        let uri = null;
        if (element.location) {
            if (element.location.uri.startsWith('dm:')) {
                uri = Uri.parse(element.location.uri);
            } else {
                uri = Uri.parse(`${element.location.uri}#${1 + element.location.range.start.line}`);
            }
        }

        return {
            label: element.name,
            //description: "Cool description",
            command: {
                title: "title",
                command: 'vscode.open',
                tooltip: "tooltip",
                arguments: [uri],
            },
            tooltip: element.location ? element.location.uri : "",
            collapsibleState: element.children.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
        };
    }

    getChildren(element?: ObjectTreeEntry | undefined): ProviderResult<ObjectTreeEntry[]> {
        let list = element ? element.children : this.roots;
        return list;
    }

    update(message: ObjectTreeParams) {
        this.roots = message.roots;
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
