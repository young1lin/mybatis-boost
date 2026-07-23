/**
 * Definition provider for navigating from XML resultMap property attributes to Java class fields
 * Handles navigation like: <result property="taskId"/> -> Java field declaration
 */

import * as vscode from 'vscode';
import { isBuiltInTypeForNavigation as isBuiltInType } from '../../utils/javaTypeUtils';
import { matchXmlAttributeAtCursor, mapCursorProportionally, CursorMatchInfo } from '../../utils/navigationUtils';
import { findFieldInHierarchy } from '../../utils/javaFieldHierarchy';

/**
 * Provides go-to-definition for property attributes in resultMap tags
 * Supports: <result>, <id>, <association>, <collection>
 */
export class XmlResultMapPropertyDefinitionProvider implements vscode.DefinitionProvider {
    // Tags that contain property attributes
    private readonly PROPERTY_TAGS = ['result', 'id', 'association', 'collection'];

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const line = document.lineAt(position.line).text;

        // Check if cursor is on property attribute value
        const propertyMatch = matchXmlAttributeAtCursor(line, position.character, /property\s*=\s*["']([^"']+)["']/g);
        if (!propertyMatch) {
            return null;
        }

        console.log(`[XmlResultMapPropertyDefinitionProvider] Found property: ${propertyMatch.value}`);
        console.log(`[XmlResultMapPropertyDefinitionProvider] Cursor offset in XML: ${propertyMatch.cursorOffset}/${propertyMatch.value.length}`);

        // Find the parent resultMap tag to get the type attribute
        const javaClassName = await this.findResultMapType(document, position.line);
        if (!javaClassName) {
            console.log('[XmlResultMapPropertyDefinitionProvider] No resultMap type found');
            return null;
        }

        console.log(`[XmlResultMapPropertyDefinitionProvider] Java class: ${javaClassName}`);

        // Find the Java class and field
        return this.findJavaField(javaClassName, propertyMatch);
    }

    /**
     * Find the parent resultMap tag and extract type attribute
     * Searches backward from current position
     */
    private async findResultMapType(
        document: vscode.TextDocument,
        startLine: number
    ): Promise<string | null> {
        const text = document.getText();
        const lines = text.split('\n');

        // Search backward from current line to find <resultMap> tag
        let resultMapStartLine = -1;
        for (let i = startLine; i >= 0; i--) {
            const line = lines[i];

            // If we encounter a closing resultMap tag, stop searching
            if (line.includes('</resultMap>')) {
                break;
            }

            // Check if this line contains the opening resultMap tag
            if (/<resultMap\b/.test(line)) {
                resultMapStartLine = i;
                break;
            }
        }

        if (resultMapStartLine === -1) {
            return null;
        }

        // Now extract the entire resultMap opening tag (may span multiple lines)
        let resultMapTag = '';
        for (let i = resultMapStartLine; i < lines.length; i++) {
            const line = lines[i];
            resultMapTag += line + ' ';

            // Stop when we find the closing > of the opening tag
            if (line.includes('>')) {
                break;
            }
        }

        // Extract type attribute from the complete tag
        const typeMatch = resultMapTag.match(/type\s*=\s*["']([^"']+)["']/);
        return typeMatch ? typeMatch[1] : null;
    }

    /**
     * Find Java class and field by fully-qualified class name and field name,
     * searching superclasses when the field is inherited.
     * Maps cursor position proportionally from XML property to Java field
     */
    private async findJavaField(
        className: string,
        matchInfo: CursorMatchInfo
    ): Promise<vscode.Definition | null> {
        const fieldName = matchInfo.value;

        // Handle primitive types and java.lang classes (skip navigation)
        if (isBuiltInType(className)) {
            return null;
        }

        try {
            const resolved = await findFieldInHierarchy(className, fieldName);
            if (!resolved) {
                console.log(`[XmlResultMapPropertyDefinitionProvider] Field ${fieldName} not found in class ${className} or its superclasses`);
                return null;
            }

            const { field } = resolved;
            const sourceLength = matchInfo.endColumn - matchInfo.startColumn;
            const targetLength = fieldName.length;

            const targetColumn = (sourceLength > 0 && targetLength > 0)
                ? mapCursorProportionally(matchInfo.cursorOffset, sourceLength, field.startColumn, targetLength)
                : field.startColumn;

            console.log(`[XmlResultMapPropertyDefinitionProvider] Field position: ${resolved.filePath} line ${field.line}, column ${targetColumn}`);
            return new vscode.Location(
                vscode.Uri.file(resolved.filePath),
                new vscode.Position(field.line, targetColumn)
            );

        } catch (error) {
            console.error('[XmlResultMapPropertyDefinitionProvider] Error finding Java field:', error);
            return null;
        }
    }

}
