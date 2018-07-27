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
binaries available for common platforms. On other platforms, the path to the
`dm-langserver` binary may be specified manually.

Language server features include:

* Workspace symbol search (Ctrl+T).
* Hovering `var` and `proc` definitions to see their parents.
* And more, with details at the [language server documentation][ls].

Additional extension features include:

* Build task (Ctrl+Shift+B) support for invoking DreamMaker.
* Status bar control to toggle a file's tickmark in the `.dme`.
  * Automatically unticking deleted files.
  * Optionally ticking newly-created files.
* Built-in DM Reference browser.
  * Open index with "DreamMaker: Open DM Reference" in the command palette.
  * Look up items with workspace symbol search (Ctrl+T).

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
