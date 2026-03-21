/**
 * Definition provider for resultMap references within XML
 * Handles resultMap="xxx" -> <resultMap id="xxx"> navigation
 */

import * as vscode from 'vscode';
import { escapeRegex } from '../../utils/stringUtils';
import { matchXmlAttributeAtCursor, findAttributeValueLocation, CursorMatchInfo } from '../../utils/navigationUtils';

/**
 * Provides go-to-definition for resultMap references
 * 1. resultMap="xxx" -> <resultMap id="xxx">
 * 2. <resultMap id="xxx"> -> all references with resultMap="xxx"
 */
export class XmlResultMapDefinitionProvider implements vscode.DefinitionProvider {

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
        const line = document.lineAt(position.line).text;

        // Check if cursor is on resultMap attribute (e.g., resultMap="PermissionResultMap")
        const resultMapRefMatch = matchXmlAttributeAtCursor(line, position.character, /resultMap\s*=\s*["']([^"']+)["']/g);
        if (resultMapRefMatch) {
            console.log(`[XmlResultMapDefinitionProvider] Found resultMap reference: ${resultMapRefMatch.value} at offset ${resultMapRefMatch.cursorOffset}`);
            return this.findResultMapDefinition(document, resultMapRefMatch);
        }

        // Check if cursor is on id attribute in <resultMap> tag
        const resultMapIdMatch = matchXmlAttributeAtCursor(line, position.character, /<resultMap[^>]+id\s*=\s*["']([^"']+)["']/g);
        if (resultMapIdMatch) {
            console.log(`[XmlResultMapDefinitionProvider] Found resultMap id: ${resultMapIdMatch.value} at offset ${resultMapIdMatch.cursorOffset}`);
            return this.findAllResultMapReferences(document, resultMapIdMatch);
        }

        return null;
    }

    /**
     * Find <resultMap id="xxx"> definition in the document with cursor position mapping
     */
    private findResultMapDefinition(
        document: vscode.TextDocument,
        matchInfo: CursorMatchInfo
    ): vscode.Location | null {
        const text = document.getText();
        const lines = text.split('\n');
        const resultMapId = matchInfo.value;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(`<resultMap[^>]+id\\s*=\\s*["']${escapeRegex(resultMapId)}["']`);
            if (regex.test(line)) {
                console.log(`[XmlResultMapDefinitionProvider] Found resultMap definition at line ${i}`);
                const location = findAttributeValueLocation(line, i, document.uri, 'id', resultMapId, matchInfo);
                return location || new vscode.Location(document.uri, new vscode.Position(i, 0));
            }
        }

        console.log(`[XmlResultMapDefinitionProvider] ResultMap ${resultMapId} not found`);
        return null;
    }

    /**
     * Find all resultMap="xxx" references in the document with cursor position mapping
     */
    private findAllResultMapReferences(
        document: vscode.TextDocument,
        matchInfo: CursorMatchInfo
    ): vscode.Location[] {
        const text = document.getText();
        const lines = text.split('\n');
        const locations: vscode.Location[] = [];
        const resultMapId = matchInfo.value;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip <resultMap> tag itself
            if (!line.includes('<resultMap')) {
                const regex = new RegExp(`resultMap\\s*=\\s*["']${escapeRegex(resultMapId)}["']`);
                if (regex.test(line)) {
                    console.log(`[XmlResultMapDefinitionProvider] Found resultMap reference at line ${i}`);
                    const location = findAttributeValueLocation(line, i, document.uri, 'resultMap', resultMapId, matchInfo);
                    locations.push(location || new vscode.Location(document.uri, new vscode.Position(i, 0)));
                }
            }
        }

        console.log(`[XmlResultMapDefinitionProvider] Found ${locations.length} references to ${resultMapId}`);
        return locations;
    }

}
