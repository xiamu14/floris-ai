import { echoTool } from "./echo-tool";
import { gitStatusTool } from "./git-status-tool";
import { httpRequestTool } from "./http-request-tool";
import { listFilesTool } from "./list-files-tool";
import { readFileTool } from "./read-file-tool";
import { runCommandTool } from "./run-command-tool";
import { searchFilesTool } from "./search-files-tool";
import { InMemoryToolRegistry } from "./tool-registry";

export const toolRegistry = new InMemoryToolRegistry([
  echoTool,
  listFilesTool,
  readFileTool,
  searchFilesTool,
  gitStatusTool,
  httpRequestTool,
  runCommandTool,
]);
