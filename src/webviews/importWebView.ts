import * as vscode from "vscode";
import { BaseWebview } from "../models/baseWebView";
import { Connection } from "../models/baseConnection";
import { ConnectionManager } from "../iris/connectionManager";
import * as path from "path";
import * as fs from "fs";

/**
 * Webview for importing data into IRIS
 */
export class ImportWebview extends BaseWebview {
  constructor(
    context: vscode.ExtensionContext,
    connection: Connection,
    connectionManager: ConnectionManager,
    outputChannel: vscode.OutputChannel
  ) {
    // NOTE: Changed base view name back to "import"
    super(context, connection, connectionManager, "import", outputChannel);
  }

  protected getTitle(): string {
    return `Import Data - ${this.connection.name}`;
  }

  protected getBodyContent(): string {
    const htmlPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "import",
      "import.html"
    );
    const cssPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "import",
      "import.css"
    );

    const html = fs.readFileSync(htmlPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    // NOTE: Using this.connection for properties as defined in ImportWebview constructor
    const processedHtml = html
      .replace("{{connectionName}}", this.connection.name)
      .replace("{{connectionEndpoint}}", this.connection.endpoint) // Assuming BaseWebview exposes endpoint/port on connection
      .replace("{{connectionPort}}", this.connection.port.toString())
      .replace("{{connectionNamespace}}", this.connection.namespace);

    return `
            <style>${css}</style>
            ${processedHtml}
        `;
  }

  protected getCustomScript(): string {
    return `
      // Helper to get file extension
      const getFileExtension = (filename) => {
        return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
      };

      // --- Tab Handlers (Needed for switching views) ---
      document.getElementById('tab-new').addEventListener('click', () => {
          document.getElementById('content-new').classList.add('active');
          document.getElementById('content-existing').classList.remove('active');
          document.getElementById('tab-new').classList.add('active');
          document.getElementById('tab-existing').classList.remove('active');
      });
      document.getElementById('tab-existing').addEventListener('click', () => {
          document.getElementById('content-existing').classList.add('active');
          document.getElementById('content-new').classList.remove('active');
          document.getElementById('tab-existing').classList.add('active');
          document.getElementById('tab-new').classList.remove('active');
      });
      
      document.getElementById('tab-new').click();

      // --- Browse File Handlers ---
      document.getElementById('browse-new-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'new-file-input');
      });
      
      document.getElementById('browse-existing-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'existing-file-input');
      });

      // --- Schema/Table Handlers (LOAD EXISTING TAB) ---
      // Search schema button handler (Load Existing) - This is the ONLY trigger now
      document.addEventListener("click", (event) => {
          if (event.target && event.target.id === "search-schema-btn-import") {
              const filter = document.getElementById("schema-search-import")?.value?.trim();
              sendMessage("load-schemas", {
                  filter: filter || null,
                  inputId: "schema-import"
              });
          }
      });

      // Schema selection handler (Load Existing)
      document.getElementById('schema-import').addEventListener('change', (e) => {
        const schema = e.target.value;
        const tableSelect = document.getElementById('table-import');
        if (schema) {
          tableSelect.disabled = true;
          sendMessage('load-tables', { schema });
        } else {
          tableSelect.innerHTML = '<option value="">Select a schema first</option>';
          tableSelect.disabled = true;
        }
      });

      // --- Import Logic for CREATE NEW Table Tab ---
      document.getElementById('create-import-btn').addEventListener('click', () => {
        const filePath = document.getElementById('new-file-input').value;
        const schema = document.getElementById('new-schema-input').value.trim(); 
        const tableName = document.getElementById('new-table-name').value.trim();
        const fileExt = getFileExtension(filePath);
        
        if (!filePath) {
          sendMessage('error', 'Please select a file to import');
          return;
        }
        if (!schema) {
          sendMessage('error', 'Please enter a schema name');
          return;
        }
        if (!tableName) {
          sendMessage('error', 'Please enter a table name');
          return;
        }
        if (!['csv', 'json', 'txt'].includes(fileExt)) {
          sendMessage('error', 'Unsupported file format. Must be CSV, JSON, or TXT');
          return;
        }

        showLoading(true);
        const data = {
            mode: 'create',
            filePath: filePath,
            tableName: tableName,
            schema: schema,
            fileFormat: fileExt,
            dataAction: 'replace' // Always replace for new table creation
        };
        
        sendMessage('import', data);
      });


      // --- Import Logic for LOAD EXISTING Table Tab ---
      document.getElementById('load-existing-btn').addEventListener('click', () => {
        const filePath = document.getElementById('existing-file-input').value;
        const schema = document.getElementById('schema-import').value;
        const tableName = document.getElementById('table-import').value;
        const dataAction = document.querySelector('input[name="data-action"]:checked').value;
        const fileExt = getFileExtension(filePath);

        if (!filePath) {
            sendMessage('error', 'Please select a file to import');
            return;
        }
        if (!schema || !tableName) {
            sendMessage('error', 'Please select a target schema and table');
            return;
        }
        if (!['csv', 'json', 'txt'].includes(fileExt)) {
            sendMessage('error', 'Unsupported file format. Must be CSV, JSON, or TXT.');
            return;
        }
        
        showLoading(true);
        const data = {
            mode: 'load',
            filePath: filePath,
            tableName: tableName,
            schema: schema,
            fileFormat: fileExt,
            dataAction: dataAction 
        };
        
        sendMessage('import', data);
      });

      // Override handleMessage to include import-specific handlers
      const originalHandleMessage = handleMessage;
      handleMessage = function(message) {
        switch (message.type) {

          case 'schemas-loaded':
            const schemaSelect = document.getElementById(message.data.inputId);
            schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
            message.data.schemas.forEach(schema => {
              const option = document.createElement('option');
              option.value = schema;
              option.textContent = schema;
              schemaSelect.appendChild(option);
            });
            schemaSelect.disabled = false;
            break;

          case 'tables-loaded':
            const tableSelect = document.getElementById('table-import');
            tableSelect.innerHTML = '<option value="">Select a table...</option>';
            message.data.forEach(table => {
              const option = document.createElement('option');
              option.value = table;
              option.textContent = table;
              tableSelect.appendChild(option);
            });
            tableSelect.disabled = false;
            break;

          case 'file-selected':
            const fileInput = document.getElementById(message.data.inputId);
            fileInput.value = message.data.filePath;
            break;

          default:
            originalHandleMessage(message);
        }
      };
    `;
  } 
  
  protected async handleMessage(message: any): Promise<void> {
    this.log(`[ImportWebview] Received message: ${JSON.stringify(message)}`);
    switch (message.type) {
      case "load-schemas":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Loading schemas...`,
            cancellable: false,
          },
          async () => {
            // Pass filter and target inputId from frontend message data
            await this.handleLoadSchemas(
              message.data?.filter,
              message.data?.inputId
            );
          }
        );
        break;
      case "load-tables":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Loading tables for schema ${message.data.schema}...`,
            cancellable: false,
          },
          async () => {
            await this.handleLoadTables(message.data.schema);
          }
        );
        break;
      case "browse":
        await this.handleBrowse(message.data);
        break;
      case "import":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Importing data...`,
            cancellable: false,
          },
          async () => {
            await this.handleImport(message.data);
          }
        );
        break;
      case "cancel":
        this.dispose();
        break;
      case "error":
        vscode.window.showErrorMessage(message.data);
        break;
      default:
        this.log(`[ImportWebview] Unknown message type: ${message.type}`);
        break;
    }
  }

  // Implementation reused from ExportWebview
  private async handleLoadSchemas(
    filter?: string,
    inputId?: string
  ): Promise<void> {
    try {
      this.log(`[ImportWebview] Loading schemas... with filter: ${filter}`);
      const schemas =
        filter && filter.trim() !== ""
          ? await this.connector.getSchemas(filter)
          : await this.connector.getSchemas();

      // Post back the schemas along with the target ID for the JS to handle correctly
      this.postMessage("schemas-loaded", {
        schemas: schemas,
        inputId: inputId || "schema-import",
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to load schemas: ${error.message}`
      );
      this.postMessage("error", `Failed to load schemas: ${error.message}`);
    }
  }

  // Implementation reused from ExportWebview
  private async handleLoadTables(schema: string): Promise<void> {
    try {
      this.log(`[ImportWebview] Loading tables for schema: ${schema}`);
      const tables = await this.connector.getTables(schema);
      this.log(`[ImportWebview] Loaded tables`);
      this.postMessage("tables-loaded", tables);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load tables: ${error.message}`);
      this.postMessage("error", `Failed to load tables: ${error.message}`);
      this.postMessage("loading", false);
    }
  }

  private async handleBrowse(inputId: string): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        "Data Files": ["csv", "json", "txt"],
      },
      title: "Select file to import",
    });

    if (fileUri && fileUri[0]) {
      this.postMessage("file-selected", {
        filePath: fileUri[0].fsPath,
        inputId,
      });
    }
  }

  private async handleImport(data: ImportData): Promise<void> {
    try {
      this.postMessage("loading", true);

      // --- Placeholder Import Logic ---
      let status = `Mode: **${data.mode}**; Target: **${data.schema}.${data.tableName}**; Action: **${data.dataAction}**; File: ${data.filePath} (${data.fileFormat})`;

      // Simulate actual import logic
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.postMessage(
        "success",
        `Import request processed (Test only). ${status}`
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Import failed: ${error.message}`);
      this.postMessage("error", `Import failed: ${error.message}`);
    } finally {
      this.postMessage("loading", false);
    }
  }
}

export interface ImportData {
  mode: "create" | "load";
  filePath: string;
  fileFormat: "csv" | "json" | "txt";
  schema: string;
  tableName: string;
  dataAction: "append" | "replace";
}
