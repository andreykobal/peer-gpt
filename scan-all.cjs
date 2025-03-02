#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of all Node.js built-in modules
const builtins = new Set([
    "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns",
    "domain", "events", "fs", "http", "https", "net", "os", "path", "process",
    "punycode", "querystring", "readline", "repl", "stream", "string_decoder",
    "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib"
]);

// Set of built-in modules that have Bare-compatible alternatives (from Bare Reference)
const bareSupported = new Set([
    "assert",    // bare-assert
    "buffer",    // bare-buffer
    "child_process", // bare-subprocess
    "events",    // bare-events
    "fs",        // bare-fs
    "http",      // bare-http1
    "os",        // bare-os
    "path",      // bare-path
    "process",   // bare-process
    "readline",  // bare-readline
    "repl",      // bare-repl
    "timers",    // bare-timers
    "tty",       // bare-tty
    "url"        // bare-url
]);

// Global set to collect non-replaceable built-ins found in the code
const nonReplaceableFound = new Set();

// Recursively traverse all files in a directory and scan for .js/.mjs files
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

// Scan a file line by line and check for built-in module imports or requires
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
        // Check for "import ... from '...'"
        const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
            let modName = importMatch[1].replace(/^node:/, '');
            if (builtins.has(modName)) {
                console.log(`${filePath}:${index + 1}: ${line.trim()}`);
                if (!bareSupported.has(modName)) {
                    nonReplaceableFound.add(modName);
                }
            }
        }
        // Check for "require('...')"
        const requireMatch = line.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
            let modName = requireMatch[1].replace(/^node:/, '');
            if (builtins.has(modName)) {
                console.log(`${filePath}:${index + 1}: ${line.trim()}`);
                if (!bareSupported.has(modName)) {
                    nonReplaceableFound.add(modName);
                }
            }
        }
    });
}

/**
 * Determines the directory for a dependency.
 * It first looks in the parent's node_modules folder,
 * then in the root node_modules.
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

    // Attempt to read package.json for this dependency
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
        // First, try to locate the dependency inside the current dependency folder,
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
 * Scans the target library and all its dependencies recursively.
 */
function scanLibraryAndAllDeps(targetDir) {
    console.log(`\n=== Scanning library: ${targetDir} ===`);
    scanDirectory(targetDir);

    const scannedDeps = new Set();
    // Read the main library's package.json
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

// Main target directory (defaults to node_modules/node-llama-cpp)
const targetDir = process.argv[2] || path.join(process.cwd(), "node_modules", "node-llama-cpp");

scanLibraryAndAllDeps(targetDir);

// Print non-replaceable modules in red if any were found
if (nonReplaceableFound.size > 0) {
    const red = "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`${red}\nThe following built-in modules were found that have no Bare-compatible alternative:${reset}`);
    for (const mod of nonReplaceableFound) {
        console.log(`${red}${mod}${reset}`);
    }
} else {
    console.log("\nAll built-in modules found have Bare-compatible alternatives.");
}
