# DreamMaker Language Client

This VS Code extension acts as a client to the [DreamMaker language server][ls],
a component of [SpacemanDMM]. It provides language-related services for
DreamMaker, the scripting language of the [BYOND] engine.
It is currently best used in tandem with the [BYOND DM Language Support]
extension, which provides syntax highlighting.

[ls]: https://github.com/SpaceManiac/SpacemanDMM/tree/master/src/langserver
[SpacemanDMM]: https://github.com/SpaceManiac/SpacemanDMM/
[Byond]: https://secure.byond.com/
[BYOND DM Language Support]: https://marketplace.visualstudio.com/items?itemName=gbasood.byond-dm-language-support

The extension has an optional auto-update feature for the language server, with
binaries available for Windows and Linux. On other platforms, the path to the
`dm-langserver` binary must be specified manually.

For other platforms such as macOS/darwin, you'll need to clone the source repository for the dm-langserver linked above. Once cloned, with rust installed, you'll follow that repo's README to compile the langserver (takes about 7 minutes without rust already having the dependencies cached). In the resulting '/target/release/' directory in the repo's root folder, you'll find 'dm-langserver'. When opening a repo with a .dme, I.E. tgstation - this extension will prompt you to find your dm-langserver executable and select it. (Be sure to not enable auto-update when prompted, the autoupdate server will not contain darwin/x64 binaries)

Language server features include:

* Workspace symbol search (Ctrl+T).
* Go to definition (Ctrl+Click).
* Go to type definition.
* As-you-type autocomplete.
* Signature help in proc calls.
* Find references to a symbol.
* Current file outline view.
* Hovering `var` and `proc` definitions to see their parents.
* And more, with details at the [language server documentation][ls].

Additional extension features include:

* Project object tree view.
* Build task (Ctrl+Shift+B) support for invoking DreamMaker.
* Status bar control to toggle a file's tickmark in the `.dme`.
  * Optionally automatically ticking created/unticking deleted files.
* Built-in DM Reference browser.
  * Open index with "DreamMaker: Open DM Reference" in the command palette.
  * Look up items with workspace symbol search, go to definition, or object tree.

## Building

1. Install [Node and NPM][node].
2. Download dependencies: `npm install`
3. If installing VSCE globally:
   1. `sudo npm install -g vsce`
   2. `vsce package`
4. If installing VSCE locally:
   1. `npm install vsce`
   2. `./node_modules/vsce/out/vsce package`
5. Install produced `.vsix` into Visual Studio Code.

[node]: https://nodejs.org/en/

## License

DreamMaker Language Client is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

DreamMaker Language Client is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with DreamMaker Language Client.  If not, see <http://www.gnu.org/licenses/>.
