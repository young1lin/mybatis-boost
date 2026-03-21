/**
 * Definition provider for navigating from Java class references in XML to Java class definitions
 */

import * as vscode from 'vscode';
import { isBuiltInTypeForNavigation as isBuiltInType } from '../../utils/javaTypeUtils';
import { mapCursorProportionally, findJavaClassFile } from '../../utils/navigationUtils';

/**
 * Provides go-to-definition for Java class names in XML attributes
 */
export class JavaClassDefinitionProvider implements vscode.DefinitionProvider {
    // Attributes that contain Java class references
    private readonly CLASS_ATTRIBUTES = [
        'resultType',
        'parameterType',
        'type',
        'ofType',
        'javaType'
    ];

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const line = document.lineAt(position.line).text;

        // Try to find a class reference at cursor position
        for (const attr of this.CLASS_ATTRIBUTES) {
            const regex = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'g');
            let match;

            while ((match = regex.exec(line)) !== null) {
                const className = match[1];
                const startIdx = match.index + match[0].indexOf(className);
                const endIdx = startIdx + className.length;

                // Check if cursor is on the class name
                if (position.character >= startIdx && position.character <= endIdx) {
                    // Calculate cursor offset in the full class name
                    const cursorOffset = position.character - startIdx;

                    // Extract simple class name (last part after the last dot)
                    const simpleClassName = className.split('.').pop()!;
                    const simpleClassNameStart = className.lastIndexOf('.') + 1; // +1 to skip the dot

                    // Calculate cursor offset within the simple class name
                    let cursorOffsetInSimpleClass = 0;
                    if (cursorOffset >= simpleClassNameStart) {
                        cursorOffsetInSimpleClass = cursorOffset - simpleClassNameStart;
                    }
                    return this.findJavaClass(className, cursorOffsetInSimpleClass);
                }
            }
        }

        return null;
    }

    /**
     * Find Java class file by fully-qualified name
     * Maps cursor position proportionally from XML class reference to Java class declaration
     */
    private async findJavaClass(className: string, cursorOffsetInSimpleClass: number = 0): Promise<vscode.Definition | null> {
        // Handle primitive types and java.lang classes (skip navigation)
        if (isBuiltInType(className)) {
            return null;
        }

        try {
            const javaUri = await findJavaClassFile(className);
            if (!javaUri) {
                return null;
            }

            // Find the class declaration line
            const document = await vscode.workspace.openTextDocument(javaUri);
            const content = document.getText();
            const lines = content.split('\n');

            // Look for class/interface/enum declaration
            const simpleClassName = className.split('.').pop()!;
            const classRegex = new RegExp(
                `(?:public\\s+)?(?:class|interface|enum)\\s+(${simpleClassName})\\b`
            );

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(classRegex);

                if (match && match.index !== undefined) {
                    // Find the exact position of the class name (group 1)
                    const classNameMatch = line.match(new RegExp(`\\b${simpleClassName}\\b`));
                    if (classNameMatch && classNameMatch.index !== undefined) {
                        const classStartColumn = classNameMatch.index;

                        const targetColumn = (simpleClassName.length > 0 && cursorOffsetInSimpleClass > 0)
                            ? mapCursorProportionally(cursorOffsetInSimpleClass, simpleClassName.length, classStartColumn, simpleClassName.length)
                            : classStartColumn;

                        console.log(`[JavaClassDefinitionProvider] Found class at line ${i}, column ${targetColumn}`);
                        return new vscode.Location(javaUri, new vscode.Position(i, targetColumn));
                    }
                    // Fallback to line start
                    return new vscode.Location(javaUri, new vscode.Position(i, 0));
                }
            }

            // If not found, return first line
            return new vscode.Location(javaUri, new vscode.Position(0, 0));

        } catch (error) {
            console.error('[MyBatis Boost] Error finding Java class:', error);
            return null;
        }
    }

}
