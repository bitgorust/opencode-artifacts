# Local environment observation — 2026-08-16

Purpose: record available evidence without promoting it to a supported platform cell.

```text
OS: Ubuntu 24.04.4 LTS; Linux 6.8.0-106-generic x86_64
system Node: v18.19.1
npm-script PATH Node: v24.19.0 from an extraneous node_modules binary
npm: 9.2.0
OpenCode: 1.18.18
Chromium/Chrome/Firefox executables: not found on PATH
```

The system shell is below the Node 24 support floor, the local Node 24 binary is not a clean
lockfile install, and no target browser exists. This environment is useful for repository
diagnostics only and is not a D-01 platform pass. The prior host probe records OpenCode plugin
registration but did not record a complete exact OS/Node/browser journey.
