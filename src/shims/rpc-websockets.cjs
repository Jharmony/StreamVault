// Shim: rpc-websockets browser build only exports `Client`.
// The Turbo SDK tries to destructure `CommonClient` from the same module,
// which fails at runtime. This shim re-exports Client under both names.
const { Client } = require('rpc-websockets/dist/index.browser.cjs');
exports.Client = Client;
exports.CommonClient = Client;
