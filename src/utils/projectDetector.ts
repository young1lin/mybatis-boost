/**
 * Project detection utilities
 * These functions contain pure logic that can be unit tested without VS Code API
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Type for file existence check function (for dependency injection in tests)
 */
export type FileExistsFn = (filePath: string) => boolean;

const PROJECT_INDICATOR_FILES = ['pom.xml', 'build.gradle', 'build.gradle.kts'];

/**
 * Return the project indicator file directly inside a directory, or null.
 */
function findIndicatorInDir(dir: string, fileExists: FileExistsFn): string | null {
    for (const name of PROJECT_INDICATOR_FILES) {
        const indicator = path.join(dir, name);
        if (fileExists(indicator)) {
            return indicator;
        }
    }
    return null;
}

/**
 * Walk up the directory tree to find Java project indicator files (pom.xml, build.gradle, etc.)
 * @param startPath The starting directory path
 * @param maxLevels Maximum number of parent directories to search (default: 10)
 * @param fileExists Function to check file existence (default: fs.existsSync, injectable for testing)
 * @returns The path to the found project file, or null if not found
 */
export function findProjectFileInParents(
    startPath: string,
    maxLevels: number = 10,
    fileExists: FileExistsFn = fs.existsSync
): string | null {
    let currentPath = startPath;

    // Search up to maxLevels to prevent infinite recursion
    for (let i = 0; i < maxLevels; i++) {
        const indicator = findIndicatorInDir(currentPath, fileExists);
        if (indicator) {
            return indicator;
        }

        // Move to parent directory
        const parent = path.dirname(currentPath);
        // Stop if we've reached the filesystem root
        if (parent === currentPath) {
            break;
        }
        currentPath = parent;
    }

    return null;
}

/**
 * Walk up from startPath to stopDir (inclusive) and return the OUTERMOST project
 * indicator file found on the way. In a multi-module Maven/Gradle project this
 * resolves the aggregate root (the parent pom.xml / root build.gradle) instead of
 * the nearest module, so lookups can see sibling modules (e.g. mapper XML that
 * lives in a different module than its Java interface).
 *
 * The walk never goes above stopDir, so with one workspace folder containing many
 * independent services (each with its own build files but no shared parent build
 * file), each service still resolves to its own root — services are never merged.
 *
 * @param startPath Directory to start from (must be inside stopDir; see isPathInside)
 * @param stopDir Boundary directory, typically the VS Code workspace folder
 * @param fileExists Function to check file existence (injectable for testing)
 * @returns The outermost indicator file between startPath and stopDir, or null
 */
export function findOutermostProjectFileInParents(
    startPath: string,
    stopDir: string,
    fileExists: FileExistsFn = fs.existsSync
): string | null {
    const stop = path.resolve(stopDir);
    let currentPath = startPath;
    let outermost: string | null = null;

    // Hard cap as loop safety; the stopDir boundary is the real terminator.
    for (let i = 0; i < 64; i++) {
        const indicator = findIndicatorInDir(currentPath, fileExists);
        if (indicator) {
            outermost = indicator;
        }

        if (path.resolve(currentPath) === stop) {
            break;
        }
        const parent = path.dirname(currentPath);
        if (parent === currentPath) {
            break;
        }
        currentPath = parent;
    }

    return outermost;
}

/**
 * Check whether child is the same directory as parent or nested anywhere below it.
 */
export function isPathInside(child: string, parent: string): boolean {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Check if a directory contains Java project indicator files
 * This is a simpler check that only looks in the specified directory
 * @param directoryPath The directory to check
 * @param fileExists Function to check file existence (default: fs.existsSync, injectable for testing)
 * @returns true if any project indicator file is found
 */
export function hasProjectFiles(directoryPath: string, fileExists: FileExistsFn = fs.existsSync): boolean {
    const indicators = [
        path.join(directoryPath, 'pom.xml'),
        path.join(directoryPath, 'build.gradle'),
        path.join(directoryPath, 'build.gradle.kts'),
        path.join(directoryPath, 'src', 'main', 'java')
    ];

    return indicators.some(indicator => fileExists(indicator));
}
