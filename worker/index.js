import httpWorker from './http-worker.js';

// Runtime-neutral HTTP composition root. The private FCR WorkerEntrypoint
// lives in fcr-rpc-entry.js and is exported by security/chief-edge-entry.js,
// so Node tests never import the Cloudflare-only virtual module.
export default httpWorker;
