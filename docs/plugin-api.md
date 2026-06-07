# Plugin API

OpenHub supports a constrained v1 plugin API for local extensions. Plugins are
disabled by default until their declared permissions are explicitly authorized
and the user enables them.

## Manifest

Each plugin root must contain `plugin.json`:

```json
{
  "id": "mock-agent-plugin",
  "name": "Mock Agent Plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "plugin.js",
  "capabilities": [{ "type": "agent-adapter", "id": "mock-agent" }],
  "permissions": [],
  "integrity": {
    "algorithm": "sha256",
    "hash": "<sha256 of plugin.js>"
  }
}
```

Supported capability types:

- `agent-adapter`
- `importer`
- `sync-driver`

Supported permissions:

- `agent-root:read`
- `network:fetch`
- `import:local`
- `sync-driver`

Unknown permissions, unknown capability types, unsafe entry paths,
incompatible API versions, and entry integrity mismatches reject registration or
enablement.

## User Workflow

Plugins are managed from Settings through preload IPC:

- add a local plugin folder containing `plugin.json`
- inspect manifest details, declared permissions, grants, capabilities, and
  recorded errors
- authorize a declared permission with a reason
- enable the plugin after all declared permissions have active grants
- inspect the runtime registry after enablement
- disable the plugin and remove its registered capabilities from the registry

The plugin record stores metadata and validation failures in SQLite. Enablement
is the step that runs the constrained registration entry.

## Entry Module

The v1 entry is a small JavaScript module that assigns `exports.register`:

```js
exports.register = (host) => {
  host.registerAgentAdapter({
    code: 'mock-agent',
    displayName: 'Mock Agent'
  });
};
```

The host currently exposes registration methods only:

- `registerAgentAdapter({ code, displayName })`
- `registerImporter({ id, name })`
- `registerSyncDriver({ id, name })`

Every registration must match a declared manifest capability. Disabling a
plugin removes all capabilities registered by that plugin from the runtime
registry. Undeclared registrations fail and are recorded as plugin errors for
the UI.

## Security Limits

The plugin host does not expose filesystem, network, shell, process, or SQLite
APIs. Entry source is blocked when it contains unsafe escape patterns such as
`require`, dynamic `import`, `process`, `fetch`, `node:`, `child_process`, `fs`,
`eval`, or `Function`.

This is a constrained capability boundary, not a complete sandbox for arbitrary
untrusted JavaScript. Maintainers should still review plugin code before
authorizing permissions or enabling a plugin.
