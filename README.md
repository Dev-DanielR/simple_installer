# Simple Installer

A simple utility that installs dependencies declared on a manifest file.

The recommended way to use this utility is grab a copy of the install.js file and run it from the root of your project.
```sh
cd /path/to/project
curl -O https://raw.githubusercontent.com/Dev-DanielR/simple_installer/master/install.js
node install.js
```

## Manifest file

The manifest file should be named `manifest.json` and it should be located in the root of your project.

Here is a sample file:
```json
{
  "tempDir": "./.tmp",
  "dependencies": [
    {
      "provider": "degit",
      "name": "starter-template",
      "path": "./projects",
      "url": "user/repo#main"
    },
    {
      "provider": "pip",
      "name": "requests",
      "path": "./python_libs",
    },
    {
      "provider": "npm",
      "name": "express"
    },
    {
      "provider": "pnpm",
      "name": "lodash"
    },
    {
      "provider": "tarball",
      "name": "sample-tar",
      "path": "./archives",
      "url": "https://example.com/sample.tar.gz",
      "extract": ["dist"]
    },
    {
      "provider": "zip",
      "name": "sample-zip",
      "path": "./archives",
      "url": "https://example.com/sample.zip",
      "extract": ["bin", "lib"]
    }
  ]
}
```

### Supported providers

Currently it accepts the following providers:
- degit : For cloning git repos without git history. Useful to pull specific subdirectories.
- pip : For pulling python dependencies. For best use set the path to a virtual environment.
- npm : For pulling node dependencies with npm.
- pnpm : For pulling node dependencies with pnpm.
- tarball : For pulling from archives in `tar.gz` format
- zip : For pulling from archives in `zip` format
