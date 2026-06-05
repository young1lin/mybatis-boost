/**
 * Unit tests for activation configuration (issue #46)
 * Verifies activationEvents avoid the broad workspaceContains:**\/*.java that caused
 * pre-activation timeouts, and that the workspace exclude pattern is well-formed.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { WORKSPACE_EXCLUDE_PATTERN } from '../../utils/fileUtils';

describe('Activation configuration (issue #46)', () => {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')
    );
    const events: string[] = pkg.activationEvents || [];

    describe('package.json activationEvents', () => {
        it('does not use the broad workspaceContains:**/*.java (caused pre-activation timeout)', () => {
            assert.ok(
                !events.includes('workspaceContains:**/*.java'),
                'workspaceContains:**/*.java must be removed to avoid the file-search timeout'
            );
        });

        it('activates lazily on Java and XML languages', () => {
            assert.ok(events.includes('onLanguage:java'), 'should include onLanguage:java');
            assert.ok(events.includes('onLanguage:xml'), 'should include onLanguage:xml');
        });

        it('includes a build.gradle.kts workspace trigger', () => {
            assert.ok(
                events.includes('workspaceContains:**/build.gradle.kts'),
                'should include workspaceContains:**/build.gradle.kts'
            );
        });

        it('activates on a Java debug session so the SQL log console is ready', () => {
            assert.ok(
                events.includes('onDebugAdapterProtocolTracker:java'),
                'should include onDebugAdapterProtocolTracker:java for the SQL log console'
            );
        });
    });

    describe('WORKSPACE_EXCLUDE_PATTERN', () => {
        it('has no leading space after the opening brace', () => {
            assert.ok(
                !WORKSPACE_EXCLUDE_PATTERN.includes('{ '),
                `pattern must not contain "{ " (breaks the first exclusion): ${WORKSPACE_EXCLUDE_PATTERN}`
            );
        });

        it('excludes node_modules as the first brace alternative', () => {
            assert.ok(
                WORKSPACE_EXCLUDE_PATTERN.includes('{node_modules,'),
                `node_modules must be excluded: ${WORKSPACE_EXCLUDE_PATTERN}`
            );
        });
    });
});
