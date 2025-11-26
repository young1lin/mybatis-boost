/**
 * Mock VS Code API for unit tests (JavaScript version)
 * This file is loaded before tests run to replace the 'vscode' module
 */

const path = require('path');

// Mock VS Code API
const vscode = {
    Uri: {
        file: (filePath) => ({
            scheme: 'file',
            path: filePath,
            fsPath: filePath,
            toString: function() {
                return this.fsPath;
            }
        }),
        joinPath: function(baseUri, ...pathSegments) {
            const path = require('path');
            let basePath = baseUri.fsPath || baseUri.path || '';
            for (const segment of pathSegments) {
                basePath = path.join(basePath, segment);
            }
            return {
                scheme: baseUri.scheme || 'file',
                path: basePath,
                fsPath: basePath,
                toString: function() {
                    return this.fsPath;
                }
            };
        }
    },

    Position: class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },

    Range: class Range {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },

    workspace: {
        workspaceFolders: [
            {
                uri: { fsPath: process.cwd() },
                name: 'workspace',
                index: 0
            }
        ],

        openTextDocument: async function(optionsOrUriOrFileName) {
            let uri, fileName, languageId, content;

            if (typeof optionsOrUriOrFileName === 'string') {
                uri = vscode.Uri.file(optionsOrUriOrFileName);
                fileName = optionsOrUriOrFileName;
                languageId = 'xml';
                content = '';
            } else if (optionsOrUriOrFileName && optionsOrUriOrFileName.fsPath) {
                // It's a Uri
                uri = optionsOrUriOrFileName;
                fileName = optionsOrUriOrFileName.fsPath;
                languageId = 'xml';
                content = '';
            } else {
                // It's options object
                uri = vscode.Uri.file('untitled:test');
                fileName = 'test';
                languageId = optionsOrUriOrFileName.language || 'plaintext';
                content = optionsOrUriOrFileName.content || '';
            }

            return createMockDocument(uri, fileName, languageId, content);
        },

        getConfiguration: function(section) {
            return {
                get: (key, defaultValue) => defaultValue,
                update: () => Promise.resolve(),
                inspect: () => undefined,
                has: () => false
            };
        },
        onDidChangeTextDocument: function(callback) {
            return {
                dispose: () => {}
            };
        },
        onDidChangeConfiguration: function(callback) {
            return {
                dispose: () => {}
            };
        }
    },

    window: {
        createTextEditorDecorationType: function(options) {
            return {
                dispose: () => {}
            };
        },
        onDidChangeActiveTextEditor: function(callback) {
            // Return a disposable for the event listener
            return {
                dispose: () => {}
            };
        },
        onDidChangeVisibleTextEditors: function(callback) {
            return {
                dispose: () => {}
            };
        },
        visibleTextEditors: [],
        showWarningMessage: function(message) {
            return Promise.resolve();
        }
    },

    EventEmitter: class EventEmitter {
        constructor() {
            this.listeners = [];
        }

        get event() {
            return (listener) => {
                this.listeners.push(listener);
                return {
                    dispose: () => {
                        const index = this.listeners.indexOf(listener);
                        if (index > -1) {
                            this.listeners.splice(index, 1);
                        }
                    }
                };
            };
        }

        fire(data) {
            this.listeners.forEach(listener => listener(data));
        }

        dispose() {
            this.listeners = [];
        }
    },

    ExtensionMode: {
        Production: 1,
        Development: 2,
        Test: 3
    },

    ExtensionKind: {
        UI: 1,
        Workspace: 2
    },

    commands: {
        getCommands: (filterInternal) => Promise.resolve([]),
        executeCommand: (command, ...rest) => Promise.resolve(undefined)
    },

    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    }
};

// Helper function to create mock document
function createMockDocument(uri, fileName, languageId, content) {
    const lines = content.split('\n');

    return {
        uri,
        fileName,
        languageId,
        lineCount: lines.length,
        getText: function(range) {
            if (!range) {
                return content;
            }
            const startOffset = this.offsetAt(range.start);
            const endOffset = this.offsetAt(range.end);
            return content.substring(startOffset, endOffset);
        },
        positionAt: function(offset) {
            const beforeOffset = content.substring(0, offset);
            const line = beforeOffset.split('\n').length - 1;
            const lineStart = beforeOffset.lastIndexOf('\n') + 1;
            const character = offset - lineStart;
            return new vscode.Position(line, character);
        },
        offsetAt: function(position) {
            let offset = 0;
            for (let i = 0; i < position.line && i < lines.length; i++) {
                offset += lines[i].length + 1; // +1 for newline
            }
            offset += position.character;
            return offset;
        }
    };
}

// Override module loading for 'vscode'
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === 'vscode') {
        return vscode;
    }
    return originalRequire.apply(this, arguments);
};

module.exports = vscode;

