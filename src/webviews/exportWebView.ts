import * as vscode from "vscode";
import { BaseWebview } from "../models/baseWebView";
import { Connection } from "../models/baseConnection";
import { ConnectionManager } from "../iris/connectionManager";
import * as path from "path";
import * as fs from "fs";

/**
 * Webview for exporting data from IRIS
 */
export class ExportWebview extends BaseWebview {
  constructor(
    context: vscode.ExtensionContext, 
    connection: Connection, 
    connectionManager: ConnectionManager,
    outputChannel: vscode.OutputChannel
  ) {
    super(context, connection, connectionManager, "import", outputChannel);
  }

  protected getTitle(): string {
    return `Export Data - ${this.connector.namespace}@${this.connector.host}`;
  }

  protected getBodyContent(): string {
    const htmlPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "export",
      "export.html"
    );
    const cssPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "export",
      "export.css"
    );

    const html = fs.readFileSync(htmlPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    // Replace placeholders with actual connection data
    const processedHtml = html
      .replace("{{connectionName}}", this.connector.namespace)
      .replace("{{connectionEndpoint}}", this.connector.host)
      .replace("{{connectionPort}}", this.connector.port.toString())
      .replace("{{connectionNamespace}}", this.connector.namespace);

    return `
      <style>${css}</style>
      ${processedHtml}
    `;
  }

  protected getCustomScript(): string {
    return `
      // Schema selection handler
      document.getElementById('schema').addEventListener('change', (e) => {
        const schema = e.target.value;
        if (schema) {
          showLoading(true);
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
        
        if (!folderPath || folderPath.trim() === '') {
          banner.style.display = 'flex';
        } else {
          banner.style.display = 'none';
        }
      });

      // Browse folder button
      document.getElementById('browse-folder-btn').addEventListener('click', () => {
        sendMessage('browse-folder', null);
      });

      // Export button
      document.getElementById('export-btn').addEventListener('click', () => {
        const schema = document.getElementById('schema').value;
        const table = document.getElementById('table').value;
        const format = document.getElementById('format').value;
        const fileName = document.getElementById('file-name').value.trim();
        const folderPath = document.getElementById('folder-path').value;

        if (!schema) {
          showError('Please select a schema');
          return;
        }

        if (!table) {
          showError('Please select a table');
          return;
        }

        showLoading(true);
        sendMessage('export', { schema, table, format, fileName, folderPath });
      });

      // Cancel button
      document.getElementById('cancel-btn').addEventListener('click', () => {
        sendMessage('cancel', null);
      });

      // Request initial schemas on load
      sendMessage('load-schemas', null);

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
            showLoading(false);
            break;

          case 'folder-selected':
            const folderInput = document.getElementById('folder-path');
            folderInput.value = message.data;
            const banner = document.getElementById('workspace-banner');
            banner.style.display = 'none';
            break;

          default:
            originalHandleMessage(message);
        }
      };
    `;
  }

  protected async handleMessage(message: any): Promise<void> {
    this.log(`[ExportWebview] Received message: ${JSON.stringify(message)}`);
    switch (message.type) {
      case "load-schemas":
        await this.handleLoadSchemas();
        break;
      case "load-tables":
        await this.handleLoadTables(message.data.schema);
        break;
      case "browse-folder":
        await this.handleBrowseFolder();
        break;
      case "export":
        await this.handleExport(message.data);
        break;
      case "cancel":
        this.dispose();
        break;
    }
  }

  private async handleLoadSchemas(): Promise<void> {
    try {
      this.log("[ExportWebview] Loading schemas...");
      this.log(`[ExportWebview]  Using connector: ${this.connector}`);
      const schemas = await this.connector.getSchemas();
      this.log(`[ExportWebview] Loaded schemas: ${schemas}`);
      this.postMessage("schemas-loaded", schemas);
    } catch (error: any) {
      this.postMessage("error", `Failed to load schemas: ${error.message}`);
    }
  }

  private async handleLoadTables(schema: string): Promise<void> {
    try {
      this.log(`[ExportWebview] Loading tables for schema: ${schema}`);
      const tables = await this.connector.getTables(schema);
      this.log(`[ExportWebview] Loaded tables: ${tables}`);
      this.postMessage("tables-loaded", tables);
    } catch (error: any) {
      this.postMessage("error", `Failed to load tables: ${error.message}`);
      this.postMessage("loading", false);
    }
  }

  private async handleBrowseFolder(): Promise<void> {
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

  private async handleExport(data: ExportData): Promise<void> {
    try {
      this.postMessage("loading", true);

      // Determine the output path
      let outputFolder: string;
      if (data.folderPath && data.folderPath.trim() !== "") {
        outputFolder = data.folderPath;
      } else {
        // Use workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          outputFolder = workspaceFolders[0].uri.fsPath;
        } else {
          throw new Error(
            "No workspace folder found and no output path specified"
          );
        }
      }

      // if fileName is not specified, use schema name and table name
      if (!data.fileName) {
        data.fileName = `${data.schema}_${data.table}`;
      }

      // Append timestamp to fileName
      const timestampString = this.generateTimestamp(); 
      data.fileName = `${data.fileName}_${timestampString}`;

      const outputPath = path.join(
        outputFolder,
        `${data.fileName}.${data.format}`
      );

      // Export based on format
      let exportData: string;
      switch (data.format) {
        case "csv":
          exportData = await this.connector.exportTableToCsv(
            data.table,
            data.schema
          );
          break;
        case "txt":
          exportData = await this.connector.exportTableToTxt(
            data.table,
            data.schema
          );
          break;
        case "json":
          const jsonData = await this.connector.exportTableToJson(
            data.table,
            data.schema
          );
          exportData = JSON.stringify(jsonData, null, 2);
          break;
        case "xlsx":
          // For Excel, we would need a library like 'xlsx' or 'exceljs'
          // For now, export as CSV with .xlsx extension (placeholder)
          this.postMessage(
            "error",
            "XLSX export requires additional library. Using CSV format instead."
          );
          exportData = await this.connector.exportTableToCsv(
            data.table,
            data.schema
          );
          break;
        default:
          throw new Error(`Unsupported format: ${data.format}`);
      }

      // Write to file
      fs.writeFileSync(outputPath, exportData, "utf8");

      this.postMessage(
        "success",
        `Data exported successfully to: ${outputPath}`
      );
      this.postMessage("loading", false);

      // Ask if user wants to open the file
      const openFile = await vscode.window.showInformationMessage(
        `Export completed: ${outputPath}`,
        "Open File",
        "Open Folder"
      );

      if (openFile === "Open File") {
        const doc = await vscode.workspace.openTextDocument(outputPath);
        await vscode.window.showTextDocument(doc);
      } else if (openFile === "Open Folder") {
        await vscode.commands.executeCommand(
          "revealFileInOS",
          vscode.Uri.file(outputPath)
        );
      }
    } catch (error: any) {
      this.postMessage("error", `Export failed: ${error.message}`);
      this.postMessage("loading", false);
    }
  }
}

export interface ExportData {
  schema: string;
  table: string;
  format: "csv" | "json" | "xlsx" | "txt";
  fileName: string;
  folderPath: string;
}
