import { registerTool } from './registry.js'
import { readFileTool } from './read-file.js'
import { listDirTool } from './list-dir.js'
import { writeFileTool } from './write-file.js'
import { editFileTool } from './edit-file.js'
import { bashTool } from './bash.js'

export function registerDefaultTools(): void {
  registerTool(readFileTool)
  registerTool(listDirTool)
  registerTool(writeFileTool)
  registerTool(editFileTool)
  registerTool(bashTool)
}
