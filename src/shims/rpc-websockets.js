/**
 * ESM shim for rpc-websockets.
 * The browser build only exports `Client` but the Turbo SDK also imports `CommonClient`.
 * We re-export `Client` as both `Client` and `CommonClient` so the SDK doesn't break.
 */
export { Client, Client as CommonClient } from 'rpc-websockets/dist/index.browser.cjs';
