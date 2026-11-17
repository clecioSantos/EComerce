import { createServer } from "node:http";
import { config } from "./config.js";
import { handleAgentRequest, startAgentWorker, stopAgentWorker } from "./server.js";

// Compatibility launcher for installations that intentionally host the worker separately.
// Hostinger's unified app uses /server.mjs instead.
const server = createServer((req, res) => { void handleAgentRequest(req, res); });
server.listen(config.PORT, () => console.log("Sales agent listening on :" + config.PORT));
startAgentWorker();
async function shutdown() {
  server.close();
  await stopAgentWorker();
}
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
