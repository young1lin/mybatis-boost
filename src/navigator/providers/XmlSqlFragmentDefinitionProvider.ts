/**
 * Definition provider for SQL fragment references within XML
 * Handles <include refid="xxx"> -> <sql id="xxx"> navigation
 */

import * as vscode from 'vscode';
import { escapeRegex } from '../../utils/stringUtils';
import { matchXmlAttributeAtCursor, findAttributeValueLocation, CursorMatchInfo } from '../../utils/navigationUtils';

/**
 * Provides go-to-definition for SQL fragment references
 * 1. <include refid="xxx"> -> <sql id="xxx"> with cursor position mapping
 * 2. <sql id="xxx"> -> all <include refid="xxx"> (shows all references)
 */
export class XmlSqlFragmentDefinitionProvider implements vscode.DefinitionProvider {

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
        const line = document.lineAt(position.line).text;

        // Check if cursor is on refid attribute in <include> tag
        const includeMatch = matchXmlAttributeAtCursor(line, position.character, /<include[^>]+refid\s*=\s*["']([^"']+)["']/g);
        if (includeMatch) {
            console.log(`[XmlSqlFragmentDefinitionProvider] Found include refid: ${includeMatch.value} at offset ${includeMatch.cursorOffset}`);
            return this.findSqlFragmentDefinition(document, includeMatch);
        }

        // Check if cursor is on id attribute in <sql> tag
        const sqlIdMatch = matchXmlAttributeAtCursor(line, position.character, /<sql[^>]+id\s*=\s*["']([^"']+)["']/g);
        if (sqlIdMatch) {
            console.log(`[XmlSqlFragmentDefinitionProvider] Found sql id: ${sqlIdMatch.value} at offset ${sqlIdMatch.cursorOffset}`);
            return this.findAllIncludeReferences(document, sqlIdMatch);
        }

        return null;
    }

    /**
     * Find <sql id="xxx"> definition in the document with cursor position mapping
     */
    private findSqlFragmentDefinition(
        document: vscode.TextDocument,
        matchInfo: CursorMatchInfo
    ): vscode.Location | null {
        const text = document.getText();
        const lines = text.split('\n');
        const fragmentId = matchInfo.value;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(`<sql[^>]+id\\s*=\\s*["']${escapeRegex(fragmentId)}["']`);
            if (regex.test(line)) {
                console.log(`[XmlSqlFragmentDefinitionProvider] Found sql fragment at line ${i}`);
                const location = findAttributeValueLocation(line, i, document.uri, 'id', fragmentId, matchInfo);
                return location || new vscode.Location(document.uri, new vscode.Position(i, 0));
            }
        }

        console.log(`[XmlSqlFragmentDefinitionProvider] SQL fragment ${fragmentId} not found`);
        return null;
    }

    /**
     * Find all <include refid="xxx"> references in the document with cursor position mapping
     */
    private findAllIncludeReferences(
        document: vscode.TextDocument,
        matchInfo: CursorMatchInfo
    ): vscode.Location[] {
        const text = document.getText();
        const lines = text.split('\n');
        const locations: vscode.Location[] = [];
        const fragmentId = matchInfo.value;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(`<include[^>]+refid\\s*=\\s*["']${escapeRegex(fragmentId)}["']`);
            if (regex.test(line)) {
                console.log(`[XmlSqlFragmentDefinitionProvider] Found include reference at line ${i}`);
                const location = findAttributeValueLocation(line, i, document.uri, 'refid', fragmentId, matchInfo);
                locations.push(location || new vscode.Location(document.uri, new vscode.Position(i, 0)));
            }
        }

        console.log(`[XmlSqlFragmentDefinitionProvider] Found ${locations.length} references to ${fragmentId}`);
        return locations;
    }

}
