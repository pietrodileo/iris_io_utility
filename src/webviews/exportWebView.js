"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportWebview = void 0;
const vscode = __importStar(require("vscode"));
const baseWebView_1 = require("../models/baseWebView");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pathHelper_1 = require("../utils/pathHelper");
const XLSX = require("xlsx");
/**
 * Webview for exporting data from IRIS
 */
class ExportWebview extends baseWebView_1.BaseWebview {
    constructor(context, connection, connectionManager, outputChannel) {
        super(context, connection, connectionManager, "import", outputChannel);
    }
    getTitle() {
        return `Export Data - ${this.connection.name}`;
    }
    getBodyContent() {
        const html = pathHelper_1.PathHelper.readWebviewFile(this.context, "webviews", "export", "export.html");
        const css = pathHelper_1.PathHelper.readWebviewFile(this.context, "webviews", "export", "export.css");
        // Replace placeholders with actual connection data
        let port = this.connection.superServerPort.toString();
        const processedHtml = html
            .replace("{{connectionName}}", this.connection.name)
            .replace("{{connectionEndpoint}}", this.connector.host)
            .replace("{{connectionPort}}", port)
            .replace("{{connectionNamespace}}", this.connector.namespace);
        return `
      <style>${css}</style>
      ${processedHtml}
    `;
    }
    getCustomScript() {
        return `
      // Search schema button handler
      document.getElementById('search-schema-btn').addEventListener('click', () => {
        const filter = document.getElementById('schema-search').value.trim();
        sendMessage('load-schemas', filter || null);
      });

      document.getElementById('cancel-btn').addEventListener('click', (e) => {
        sendMessage('cancel', null);
      });

      // Schema selection handler
      document.getElementById('schema').addEventListener('change', (e) => {
        const schema = e.target.value;
        if (schema) {
          sendMessage('load-tables', { schema });
        } else {
          const tableSelect = document.getElementById('table');
          tableSelect.innerHTML = '<option value="">Select a schema first</option>';
          tableSelect.disabled = true;
        }
      });

      // Folder path change handler - show/hide banner
      document.getElementById('folder-path').addEventListener('input', (e) => {
        const folderPath = e.target.value;
        const banner = document.getElementById('workspace-banner');
        banner.style.display = (!folderPath || folderPath.trim() === '') ? 'flex' : 'none';
      });

      // Browse folder button
      document.getElementById('browse-folder-btn').addEventListener('click', () => {
        sendMessage('browse-folder', null);
      });

      // Show/hide delimiter options based on format selection
      document.getElementById('format').addEventListener('change', (e) => {
        const format = e.target.value;
        const delimiterGroup = document.getElementById('txt-delimiter-group');
        const delimiterCustomInput = document.getElementById('txt-delimiter-custom');
        
        if (format === 'txt') {
          delimiterGroup.style.display = 'block';
        } else {
          delimiterGroup.style.display = 'none';
          delimiterCustomInput.style.display = 'none';
        }
      });

      // Show custom delimiter input when "custom" is selected
      document.getElementById('txt-delimiter').addEventListener('change', (e) => {
        const customInput = document.getElementById('txt-delimiter-custom');
        if (e.target.value === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      });

      // Export button
      document.getElementById('export-btn').addEventListener('click', () => {
        const schema = document.getElementById('schema').value;
        const table = document.getElementById('table').value;
        const format = document.getElementById('format').value;
        const fileName = document.getElementById('file-name').value.trim();
        const folderPath = document.getElementById('folder-path').value;

        if (!schema) {
          sendMessage('error', 'Please select a schema');
          return;
        }

        if (!table) {
          sendMessage('error', 'Please select a table');
          return;
        }

        // Support for custom txt delimiter
        let delimiter = ','; // default
        if (format === 'txt') {
          const delimiterSelect = document.getElementById('txt-delimiter').value;
          if (delimiterSelect === 'custom') {
            delimiter = document.getElementById('txt-delimiter-custom').value || ',';
          } else {
            delimiter = delimiterSelect;
          }
        }

        sendMessage('export', { schema, table, format, fileName, folderPath, delimiter });
      });

      // Show workspace banner initially
      document.getElementById('workspace-banner').style.display = 'flex';

      // Override handleMessage to include export-specific handlers
      const originalHandleMessage = handleMessage;
      handleMessage = function(message) {
        switch (message.type) {
          case 'schemas-loaded':
            const schemaSelect = document.getElementById('schema');
            schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
            message.data.forEach(schema => {
              const option = document.createElement('option');
              option.value = schema;
              option.textContent = schema;
              schemaSelect.appendChild(option);
            });
            schemaSelect.disabled = false;
            break;

          case 'tables-loaded':
            const tableSelect = document.getElementById('table');
            tableSelect.innerHTML = '<option value="">Select a table...</option>';
            message.data.forEach(table => {
              const option = document.createElement('option');
              option.value = table;
              option.textContent = table;
              tableSelect.appendChild(option);
            });
            tableSelect.disabled = false;
            break;

          case 'folder-selected':
            const folderInput = document.getElementById('folder-path');
            folderInput.value = message.data;
            document.getElementById('workspace-banner').style.display = 'none';
            break;

          default:
            originalHandleMessage(message);
        }
      };
    `;
    }
    async handleMessage(message) {
        this.log(`[ExportWebview] Received message: ${JSON.stringify(message)}`);
        switch (message.type) {
            case "load-schemas":
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading schemas...`,
                    cancellable: false,
                }, async (progress) => {
                    await this.handleLoadSchemas(message.data);
                });
                break;
            case "load-tables":
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading tables for schema ${message.data.schema}...`,
                    cancellable: false,
                }, async (progress) => {
                    await this.handleLoadTables(message.data.schema);
                });
                break;
            case "browse-folder":
                await this.handleBrowseFolder();
                break;
            case "export":
                let outputPath;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Exporting...`,
                    cancellable: false,
                }, async (progress) => {
                    outputPath = await this.handleExport(message.data);
                });
                if (outputPath) {
                    // Ask if user wants to open the file
                    const openFile = await vscode.window.showInformationMessage(`Export completed: ${outputPath}`, "Open File", "Open Folder");
                    if (openFile === "Open File") {
                        const doc = await vscode.workspace.openTextDocument(outputPath);
                        await vscode.window.showTextDocument(doc);
                    }
                    else if (openFile === "Open Folder") {
                        await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outputPath));
                    }
                }
                break;
            case "cancel":
                this.dispose();
                break;
            case "error":
                vscode.window.showErrorMessage(message.data);
            default:
                this.log(`[ExportWebview] Unknown message type: ${message.type}`);
                break;
        }
    }
    async handleLoadSchemas(filter) {
        try {
            this.log(`[ExportWebview] Loading schemas... with filter: ${filter}`);
            const schemas = filter && filter.trim() !== ""
                ? await this.connector.getSchemas(filter)
                : await this.connector.getSchemas();
            this.postMessage("schemas-loaded", schemas);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load schemas: ${error.message}`);
            this.postMessage("error", `Failed to load schemas: ${error.message}`);
        }
    }
    async handleLoadTables(schema) {
        try {
            this.log(`[ExportWebview] Loading tables for schema: ${schema}`);
            const tables = await this.connector.getTables(schema);
            this.log(`[ExportWebview] Loaded tables`);
            this.postMessage("tables-loaded", tables);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load tables: ${error.message}`);
            this.postMessage("error", `Failed to load tables: ${error.message}`);
            this.postMessage("loading", false);
        }
    }
    async handleBrowseFolder() {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Select export destination folder",
        });
        if (folderUri && folderUri[0]) {
            this.postMessage("folder-selected", folderUri[0].fsPath);
        }
    }
    async handleExport(data) {
        try {
            this.postMessage("loading", true);
            // Determine the output path
            let outputFolder;
            if (data.folderPath && data.folderPath.trim() !== "") {
                outputFolder = data.folderPath;
            }
            else {
                // Use workspace folder
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    outputFolder = workspaceFolders[0].uri.fsPath;
                }
                else {
                    throw new Error("No workspace folder found and no output path specified");
                }
            }
            // if fileName is not specified, use schema name and table name
            if (!data.fileName) {
                data.fileName = `${data.schema}_${data.table}`;
            }
            // Append timestamp to fileName
            const timestampString = this.generateTimestamp();
            data.fileName = `${data.fileName}_${timestampString}`;
            // remove eventual double . at the end of fileName
            if (data.fileName.endsWith(".")) {
                data.fileName = data.fileName.slice(0, -1);
            }
            const outputPath = path.join(outputFolder, `${data.fileName}.${data.format}`);
            // Export based on format
            let exportData;
            switch (data.format) {
                case "csv":
                    exportData = await this.connector.exportTableToCsv(data.table, data.schema);
                    break;
                case "txt":
                    const delimiter = data.delimiter;
                    exportData = await this.connector.exportTableToTxt(data.table, data.schema, delimiter);
                    break;
                case "json":
                    const jsonData = await this.connector.exportTableToJson(data.table, data.schema);
                    // Custom replacer to handle BigInt serialization
                    exportData = JSON.stringify(jsonData, (key, value) => {
                        if (typeof value === "bigint") {
                            return value.toString();
                        }
                        return value;
                    }, 2);
                    break;
                case "xlsx":
                    const xlsxData = await this.connector.exportTableToJson(data.table, data.schema);
                    // Convert BigInt values to strings for Excel
                    const sanitizedData = xlsxData.map((row) => {
                        const newRow = {};
                        for (const [key, value] of Object.entries(row)) {
                            if (typeof value === "bigint") {
                                newRow[key] = value.toString();
                            }
                            else if (value === null || value === undefined) {
                                newRow[key] = "";
                            }
                            else {
                                newRow[key] = value;
                            }
                        }
                        return newRow;
                    });
                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(sanitizedData);
                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(workbook, worksheet, data.table.substring(0, 31)); // Sheet name max 31 chars
                    // Write to buffer
                    exportData = XLSX.write(workbook, {
                        type: "buffer",
                        bookType: "xlsx",
                    });
                    break;
                default:
                    throw new Error(`Unsupported format: ${data.format}`);
            }
            // Write to file
            fs.writeFileSync(outputPath, exportData, "utf8");
            this.postMessage("success", `Data exported successfully to: ${outputPath}`);
            this.postMessage("loading", false);
            return outputPath;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Export failed: ${error.message}`);
            this.postMessage("error", `Export failed: ${error.message}`);
            this.postMessage("loading", false);
        }
    }
}
exports.ExportWebview = ExportWebview;
//# sourceMappingURL=exportWebView.js.map