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

    // Replace placeholders with actual connection data
    const processedHtml = html
      .replace("{{connectionName}}", this.connection.name)
      .replace("{{connectionEndpoint}}", this.connection.endpoint)
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

      // --- Browse Button Handlers (New vs Existing) ---
      document.getElementById('browse-new-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'new-file-input');
      });
      
      document.getElementById('browse-existing-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'existing-file-input');
      });
      
      // --- General Handlers ---
      document.getElementById('cancel-btn').addEventListener('click', () => {
        sendMessage('cancel', null);
      });

      // --- Schema Loading Handlers ---

      // Button handler for 'Create New Table' schema search
      document.getElementById('search-new-schema-btn').addEventListener('click', () => {
          const filter = document.getElementById('new-schema-input').value.trim();
          // Send the target datalist ID ('new-schema-list') to the back-end
          sendMessage('load-schemas', { filter: filter || null, inputId: 'new-schema-list' });
      });

      // Load schemas when the 'Load Existing' tab is activated (if needed)
      document.getElementById('tab-existing').addEventListener('click', () => {
        const schemaSelect = document.getElementById('schema-import');
        if (schemaSelect && schemaSelect.options.length <= 1) {
            schemaSelect.innerHTML = '<option value="">Loading schemas...</option>';
            schemaSelect.disabled = true;
            // Send the target select ID ('schema-import')
            sendMessage('load-schemas', { filter: null, inputId: 'schema-import' }); 
        }
      });

      // Schema selection handler for EXISTING Table Tab (triggers table loading)
      document.getElementById('schema-import').addEventListener('change', (e) => {
        const schema = e.target.value;
        const tableSelect = document.getElementById('table-import');
        if (schema) {
            tableSelect.innerHTML = '<option value="">Loading tables...</option>';
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
        // Fetch schema from the INPUT field, allowing user entry
        const schema = document.getElementById('new-schema-input').value.trim(); 
        const tableName = document.getElementById('new-table-name').value.trim();
        const fileExt = getFileExtension(filePath);
        
        if (!filePath) {
            showError('Please select a file to import');
            return;
        }
        if (!schema) {
             showError('Please select or enter a schema name');
             return;
        }
        if (!tableName) {
            showError('Please enter a name for the new table');
            return;
        }
        if (!['csv', 'json', 'txt'].includes(fileExt)) {
            showError('Unsupported file format. Must be CSV, JSON, or TXT.');
            return;
        }

        showLoading(true);
        const data = {
            mode: 'create',
            filePath: filePath,
            tableName: tableName,
            schema: schema, // Use the user-defined schema
            fileFormat: fileExt,
            dataAction: 'replace' 
        };
        
        sendMessage('import', data);
      });


      // --- Import Logic for LOAD EXISTING Table Tab (Remains the same) ---
      document.getElementById('load-existing-btn').addEventListener('click', () => {
        const filePath = document.getElementById('existing-file-input').value;
        const schema = document.getElementById('schema-import').value;
        const tableName = document.getElementById('table-import').value;
        const dataAction = document.querySelector('input[name="data-action"]:checked').value;
        const fileExt = getFileExtension(filePath);

        if (!filePath) {
            showError('Please select a file to import');
            return;
        }
        if (!schema || !tableName) {
            showError('Please select a target schema and table');
            return;
        }
        if (!['csv', 'json', 'txt'].includes(fileExt)) {
            showError('Unsupported file format. Must be CSV, JSON, or TXT.');
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

      // Override handleMessage to include import-specific handlers for UI updates
      const originalHandleMessage = handleMessage;
      handleMessage = function(message) {
        switch (message.type) {
            case 'file-selected':
                // message.data contains { filePath, inputId }
                const inputId = message.data.inputId;
                document.getElementById(inputId).value = message.data.filePath;
                break;
            
            case 'schemas-loaded':
                // message.data now contains { schemas, inputId }
                const targetId = message.data.inputId;
                const schemaList = message.data.schemas;

                // Handle <select> for "Load Existing" tab
                if (targetId === 'schema-import') {
                    const schemaSelect = document.getElementById(targetId);
                    schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
                    schemaList.forEach(schema => {
                        const option = document.createElement('option');
                        option.value = schema;
                        option.textContent = schema;
                        schemaSelect.appendChild(option);
                    });
                    schemaSelect.disabled = false;
                } 
                // Handle <datalist> for "Create New" tab
                else if (targetId === 'new-schema-list') {
                    const dataList = document.getElementById(targetId);
                    // Clear existing options
                    dataList.innerHTML = '';
                    schemaList.forEach(schema => {
                        const option = document.createElement('option');
                        option.value = schema;
                        dataList.appendChild(option);
                    });
                }
                break;

            case 'tables-loaded':
                const tableSelect = document.getElementById('table-import');
                if (tableSelect) {
                    tableSelect.innerHTML = '<option value="">Select a table...</option>';
                    message.data.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table;
                        option.textContent = table;
                        tableSelect.appendChild(option);
                    });
                    tableSelect.disabled = false;
                }
                break;

            default:
                // Pass all other messages (success, error, loading) to the original handler
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
            // Pass the target input ID along so the front-end knows where to render the list
            await this.handleLoadSchemas(
              message.data?.filter || null,
              message.data?.inputId
            );
          }
        );
        break;
      case "load-tables":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Loading tables...`,
            cancellable: false,
          },
          async () => {
            await this.handleLoadTables(message.data.schema);
          }
        );
        break;
      case "browse":
        // message.data now contains the ID of the input field to update
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
      default:
        this.log(`[ImportWebview] Unknown message type: ${message.type}`);
        break;
    }
  }

  private async handleLoadSchemas(
    filter?: string,
    inputId?: string
  ): Promise<void> {
    try {
      // Placeholder logic: assuming this.connector.getSchemas exists
      let schemas = [
        "Schema1",
        "Schema2",
        "SQLUser",
        this.connection.namespace,
      ];

      if (filter) {
        schemas = schemas.filter((s) =>
          s.toLowerCase().includes(filter.toLowerCase())
        );
      }

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

  private async handleLoadTables(schema: string): Promise<void> {
    try {
      // Placeholder logic: assuming this.connector.getTables exists
      const tables = [
        `${schema}.TableA`,
        `${schema}.TableB`,
        `${schema}.OldData`,
      ];
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
      // Only allow CSV, JSON, TXT as per final requirement (ignoring XLSX/XLS from previous step)
      filters: {
        "Data Files": ["csv", "json", "txt"],
      },
      title: "Select file to import",
    });

    if (fileUri && fileUri[0]) {
      // Post the path back along with the input ID so the script knows which field to update
      this.postMessage("file-selected", {
        filePath: fileUri[0].fsPath,
        inputId,
      });
    }
  }

  private async handleImport(data: ImportData): Promise<void> {
    try {
      this.postMessage("loading", true);

      // --- LOGIC TEST ---
      let status = `Mode: **${data.mode}**; Target: **${data.schema}.${data.tableName}**; Action: **${data.dataAction}**; File: ${data.filePath} (${data.fileFormat})`;

      // Placeholder for actual import logic
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
  mode: "create" | "load"; // New table or existing table
  filePath: string;
  fileFormat: "csv" | "json" | "txt";
  schema: string;
  tableName: string;
  dataAction: "append" | "replace"; // Append or replace data in the table
}