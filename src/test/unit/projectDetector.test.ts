/**
 * Unit tests for projectDetector
 * These tests validate the logic for detecting Java projects in various directory structures
 */

import * as assert from 'assert';
import * as path from 'path';
import { findProjectFileInParents, hasProjectFiles, FileExistsFn } from '../../utils/projectDetector';

describe('projectDetector Unit Tests', () => {
    // Helper function to create a mock file existence checker
    function createMockFileExists(existingFiles: Set<string>): FileExistsFn {
        return (filePath: string) => existingFiles.has(filePath);
    }

    describe('findProjectFileInParents', () => {
        it('should find pom.xml in current directory', () => {
            const testPath = '/project/src/main/java';
            const pomPath = path.join('/project/src/main/java', 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, pomPath);
        });

        it('should find build.gradle in current directory', () => {
            const testPath = '/project/module';
            const gradlePath = path.join('/project/module', 'build.gradle');
            const mockFileExists = createMockFileExists(new Set([gradlePath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, gradlePath);
        });

        it('should find build.gradle.kts in current directory', () => {
            const testPath = '/project/module';
            const gradleKtsPath = path.join('/project/module', 'build.gradle.kts');
            const mockFileExists = createMockFileExists(new Set([gradleKtsPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, gradleKtsPath);
        });

        it('should walk up to find pom.xml in parent directory', () => {
            const testPath = '/project/integration-test/src/main/java';
            const pomPath = path.join('/project/integration-test', 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, pomPath);
        });

        it('should walk up multiple levels to find project file', () => {
            const testPath = '/project/module/submodule/src/main/java';
            const pomPath = path.join('/project', 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, pomPath);
        });

        it('should prefer pom.xml over gradle files when both exist', () => {
            const testPath = '/project/src';
            const pomPath = path.join('/project/src', 'pom.xml');
            const gradlePath = path.join('/project/src', 'build.gradle');
            const mockFileExists = createMockFileExists(new Set([pomPath, gradlePath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            // pom.xml is checked first in the indicators array
            assert.strictEqual(result, pomPath);
        });

        it('should return null when no project file is found', () => {
            const mockFileExists = createMockFileExists(new Set());

            const result = findProjectFileInParents('/some/random/path', 10, mockFileExists);
            assert.strictEqual(result, null);
        });

        it('should stop at maxLevels to prevent infinite recursion', () => {
            const mockFileExists = createMockFileExists(new Set());

            const result = findProjectFileInParents('/very/deep/nested/path', 3, mockFileExists);

            assert.strictEqual(result, null);
        });

        it('should handle Windows-style paths', () => {
            // Skip this test on non-Windows platforms as path.join behaves differently
            if (process.platform !== 'win32') {
                return;
            }

            const testPath = 'C:\\project\\integration-test\\src\\main';
            const pomPath = path.join('C:\\project', 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, pomPath);
        });

        it('should stop at filesystem root', () => {
            const mockFileExists = createMockFileExists(new Set());

            // On Unix-like systems, root is '/'
            // On Windows, root is like 'C:\\'
            const rootPath = process.platform === 'win32' ? 'C:\\' : '/';
            const result = findProjectFileInParents(rootPath, 10, mockFileExists);

            assert.strictEqual(result, null);
        });

        it('should find gradle file when pom.xml does not exist', () => {
            const testPath = '/project/gradle-module/src';
            const gradlePath = path.join('/project/gradle-module', 'build.gradle');
            const mockFileExists = createMockFileExists(new Set([gradlePath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, gradlePath);
        });

        it('should handle deeply nested module structure (e.g., multi-module Maven project)', () => {
            // Simulates structure: /project/integration-test/src/main/java
            // where pom.xml is at /project/pom.xml
            const testPath = '/project/integration-test/src/main/java';
            const pomPath = path.join('/project', 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = findProjectFileInParents(testPath, 10, mockFileExists);
            assert.strictEqual(result, pomPath);
        });
    });

    describe('hasProjectFiles', () => {
        it('should return true when pom.xml exists in directory', () => {
            const testPath = '/project';
            const pomPath = path.join(testPath, 'pom.xml');
            const mockFileExists = createMockFileExists(new Set([pomPath]));

            const result = hasProjectFiles(testPath, mockFileExists);
            assert.strictEqual(result, true);
        });

        it('should return true when build.gradle exists in directory', () => {
            const testPath = '/project';
            const gradlePath = path.join(testPath, 'build.gradle');
            const mockFileExists = createMockFileExists(new Set([gradlePath]));

            const result = hasProjectFiles(testPath, mockFileExists);
            assert.strictEqual(result, true);
        });

        it('should return true when build.gradle.kts exists in directory', () => {
            const testPath = '/project';
            const gradleKtsPath = path.join(testPath, 'build.gradle.kts');
            const mockFileExists = createMockFileExists(new Set([gradleKtsPath]));

            const result = hasProjectFiles(testPath, mockFileExists);
            assert.strictEqual(result, true);
        });

        it('should return true when src/main/java directory exists', () => {
            const testPath = '/project';
            const srcPath = path.join(testPath, 'src', 'main', 'java');
            const mockFileExists = createMockFileExists(new Set([srcPath]));

            const result = hasProjectFiles(testPath, mockFileExists);
            assert.strictEqual(result, true);
        });

        it('should return false when no project indicators exist', () => {
            const mockFileExists = createMockFileExists(new Set());

            const result = hasProjectFiles('/some/random/path', mockFileExists);
            assert.strictEqual(result, false);
        });

        it('should return true when multiple indicators exist', () => {
            const testPath = '/project';
            const pomPath = path.join(testPath, 'pom.xml');
            const srcPath = path.join(testPath, 'src', 'main', 'java');
            const mockFileExists = createMockFileExists(new Set([pomPath, srcPath]));

            const result = hasProjectFiles(testPath, mockFileExists);
            assert.strictEqual(result, true);
        });

        it('should only check the specified directory, not parent directories', () => {
            const testPath = '/project/nested/deep';
            const checkedPaths: string[] = [];

            // Create a mock that tracks which paths were checked
            const mockFileExists = (filePath: string) => {
                checkedPaths.push(filePath);
                return false;
            };

            const result = hasProjectFiles(testPath, mockFileExists);

            assert.strictEqual(result, false);
            // Should only check 4 indicators in the specified directory
            assert.strictEqual(checkedPaths.length, 4);

            // Verify it doesn't check parent directories
            // Normalize paths for cross-platform comparison
            const normalizedTestPath = path.normalize(testPath);
            checkedPaths.forEach(checkedPath => {
                const normalizedCheckedPath = path.normalize(checkedPath);
                assert.ok(
                    normalizedCheckedPath.startsWith(normalizedTestPath),
                    `Should only check within ${testPath}, but checked ${checkedPath}`
                );
            });
        });
    });
});
