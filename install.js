const { spawnSync } = require('node:child_process');
const { mkdirSync, rmSync, existsSync, cpSync } = require('node:fs');
const { join } = require('node:path');
const manifest = require('./manifest.json');

// FILTER DEPENDENCIES VIA CLI =========================================================================================

const deps = new Set(process.argv.slice(2));

const dependenciesToInstall = (deps.length == 0) ? manifest.dependencies
    : manifest.dependencies.filter(dep => deps.has(dep.name));

// VALIDATE EXTERNAL TOOLS =============================================================================================

function checkTool(tool) {
    const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [tool], { stdio: 'pipe' });
    return result.status === 0;
}

const providerTools = {
    degit   : ['degit'],
    pip     : ['pip'],
    npm     : ['npm'],
    pnpm    : ['pnpm'],
    tarball : ['curl', 'tar'],
    zip     : ['curl', 'unzip'],
};

const neededTools = new Set();
for (const dep of dependenciesToInstall) {
    const tools = providerTools[dep.provider];
    if (tools) tools.forEach(t => neededTools.add(t));
}

const missing = [...neededTools].filter(tool => !checkTool(tool));
if (missing.length > 0) {
    console.error(`✖ Missing required tools: ${missing.join(', ')}`);
    process.exit(1);
}

// VALIDATE MANIFEST ===================================================================================================

const Validate = {
    exists : (obj, key) => (key in obj),
    string : (obj, key) => (key in obj && typeof obj[key] === 'string' && obj[key].trim() !== ''),
    array  : (obj, key) => (key in obj && Array.isArray(obj[key])),
}

if (!manifest) {
    console.error(`✖ Missing manifest.`);
    process.exit(1);
}

const errors = [];
if (!Validate.string(manifest, 'tempDir'))     errors.push('Manifest: Missing or empty "tempDir".');
if (!Validate.array(manifest, 'dependencies')) errors.push('Manifest: Missing "dependencies".');
if (errors.length > 0) {
    console.error(`✖ Malformed manifest:`);
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
}

dependenciesToInstall.forEach((dep, idx) => {
    for (const field of ['provider', 'name', 'path']) {
        if (!Validate.string(dep, field)) {
            errors.push(`Dependency "${dep.name || idx}": Missing or empty "${field}".`);
        }
    }
    if (['tarball', 'zip', 'degit'].includes(dep.provider)) {
        if (!Validate.string(dep, 'url')) {
            errors.push(`Dependency "${dep.name}": Missing or empty "url".`);
        }
    }

    if (Validate.exists(dep, 'url')) {
        if (['npm', 'pnpm'].includes(dep.provider)) {
            errors.push(`Dependency "${dep.name}": Provider ${dep.provider} does not accept "url".`);
        }
    }

    if (Validate.exists(dep, 'extract')) {
        if (!['tarball', 'zip'].includes(dep.provider)) {
            errors.push(`Dependency "${dep.name}": Provider ${dep.provider} does not accept "extract".`);
        }
        else if (!Validate.array(dep, 'extract')) {
            errors.push(`Dependency "${dep.name}": Invalid "extract". It needs to be an array.`);
        }
    }
});
if (errors.length > 0) {
    console.error(`✖ Malformed manifest:`);
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
}

// INSTALL DEPENDENCIES ================================================================================================

function runCommand(command, ...args) {
    console.log(`→ Running: ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, { stdio: 'inherit', shell: true });

    if (result.error)        throw result.error;
    if (result.status !== 0) throw new Error(`Command "${command}" failed with exit code ${result.status}`);
}

function installFromArchive({ url, fullPath, archivePath, extract, command, optionFlag, destFlag }) {
    runCommand('curl', '-L', url, '-o', archivePath);
    mkdirSync(fullPath, { recursive: true });

    if (extract.length === 0) {
        runCommand(command, optionFlag, archivePath, destFlag, fullPath);
    }
    else {
        const extractPath = join(tempDir, `${Date.now()}-extract`);
        mkdirSync(extractPath, { recursive: true });
        runCommand(command, optionFlag, archivePath, destFlag, extractPath);
        for (const subPath of extract) {
            const source = join(extractPath, subPath);
            if (existsSync(source)) cpSync(source, fullPath, { recursive: true });
            else console.warn(`⚠ Extract path "${subPath}" not found, skipping.`);
        }
    }
}

let tempDir;
try {
    tempDir = manifest.tempDir;
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    for (const { provider, name, path, url, extract = [] } of dependenciesToInstall)  {
        const fullPath = join(path, name);
        mkdirSync(path, { recursive: true });

        console.log(`\n📦 Installing "${name}" from provider "${provider}"...`);
        switch (provider) {
            case 'degit': {
                runCommand('degit', url, fullPath, '--force');
                break;
            }
            case 'pip' : {
                if (url?.endsWith('.txt')) {
                    runCommand('pip', 'install', '-r', url, '--target', fullPath);
                } else {
                    runCommand('pip', 'install', name, '--target', fullPath);
                }
                break;
            }
            case 'npm': {
                runCommand('npm', 'install', name);
                break;
            }
            case 'pnpm': {
                runCommand('pnpm', 'add', name);
                break;
            }
            case 'tarball': {
                installFromArchive({
                    url, extract,
                    fullPath, archivePath: join(tempDir, `${name}.tar.gz`),
                    command : 'tar', optionFlag: '-xzf', destFlag: '-C'
                });
                break;
            }
            case 'zip': {
                installFromArchive({
                    url, extract,
                    fullPath, archivePath: join(tempDir, `${name}.zip`),
                    command : 'unzip', optionFlag: '-q', destFlag: '-d'
                });
                break;
            }
            default: {
                console.warn(`⚠ Unsupported provider "${provider}". Skipping "${name}".`);
            }
        }
    }
    console.log('\n✔ All installs completed successfully.');
}
catch (err) {
    console.error(`✖ Installation failed: ${err.message}`);
}
finally {
    if (tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
        console.log('🧹 Temporary files cleaned up.');
    }
}