#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of Node.js built-in modules
const builtins = new Set([
    "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns",
    "domain", "events", "fs", "http", "https", "net", "os", "path", "process",
    "punycode", "querystring", "readline", "repl", "stream", "string_decoder",
    "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib"
]);

// Recursively traverses all files in a directory and scans files with .js or .mjs extension
function scanDirectory(dir) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            } else if (entry.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.mjs'))) {
                scanFile(fullPath);
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}: ${err.message}`);
    }
}

// Scans a single file line by line
function scanFile(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error(`Error reading file ${filePath}: ${err.message}`);
        return;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        // Check for import ... from '...'
        const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
            let modName = importMatch[1].replace(/^node:/, '');
            if (builtins.has(modName)) {
                console.log(`${filePath}:${index + 1}: ${line.trim()}`);
            }
        }
        // Check for require('...')
        const requireMatch = line.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
            let modName = requireMatch[1].replace(/^node:/, '');
            if (builtins.has(modName)) {
                console.log(`${filePath}:${index + 1}: ${line.trim()}`);
            }
        }
    });
}

/**
 * Function to determine the dependency directory.
 * First, it looks in the parent's node_modules folder; if not found, then in the root node_modules.
 */
function getDepDirectory(parentDir, depName) {
    let candidate = path.join(parentDir, "node_modules", depName);
    if (fs.existsSync(candidate)) return candidate;
    candidate = path.join(process.cwd(), "node_modules", depName);
    if (fs.existsSync(candidate)) return candidate;
    return null;
}

/**
 * Recursively scans dependencies.
 * scannedSet is a set of already scanned directories to avoid duplicates.
 */
function scanDepsRecursively(depDir, scannedSet) {
    if (scannedSet.has(depDir)) return;
    scannedSet.add(depDir);
    console.log(`\n=== Scanning dependency: ${depDir} ===`);
    scanDirectory(depDir);

    // Try reading package.json for this dependency
    const pkgPath = path.join(depDir, 'package.json');
    let pkg;
    try {
        const pkgContent = fs.readFileSync(pkgPath, 'utf8');
        pkg = JSON.parse(pkgContent);
    } catch (err) {
        return;
    }
    const deps = pkg.dependencies || {};
    for (const depName of Object.keys(deps)) {
        // First, look for the dependency inside the current dependency,
        // then in the root node_modules
        const childDepDir = getDepDirectory(depDir, depName) || getDepDirectory(process.cwd(), depName);
        if (childDepDir) {
            scanDepsRecursively(childDepDir, scannedSet);
        } else {
            console.log(`Dependency ${depName} not found for ${depDir}`);
        }
    }
}

/**
 * Scans the library and its dependencies (recursively).
 */
function scanLibraryAndAllDeps(targetDir) {
    console.log(`\n=== Scanning library: ${targetDir} ===`);
    scanDirectory(targetDir);

    const scannedDeps = new Set();
    // Try reading package.json of the main library
    const pkgPath = path.join(targetDir, 'package.json');
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (err) {
        console.error(`Unable to read package.json in ${targetDir}: ${err.message}`);
        return;
    }
    const deps = pkg.dependencies || {};
    for (const depName of Object.keys(deps)) {
        const depDir = getDepDirectory(targetDir, depName) || getDepDirectory(process.cwd(), depName);
        if (depDir) {
            scanDepsRecursively(depDir, scannedDeps);
        } else {
            console.log(`Dependency ${depName} not found`);
        }
    }
}

// Main target directory to scan (by default node_modules/node-llama-cpp)
const targetDir = process.argv[2] || path.join(process.cwd(), "node_modules", "node-llama-cpp");

scanLibraryAndAllDeps(targetDir);
