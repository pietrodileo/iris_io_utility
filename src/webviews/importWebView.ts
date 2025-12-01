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

    let port = this.connection.webServerPort.toString();
    if (this.connection.isOdbc === true) {
      port = this.connection.superServerPort.toString();
    }

    const processedHtml = html
      .replace("{{connectionName}}", this.connection.name)
      .replace("{{connectionEndpoint}}", this.connection.endpoint)
      .replace("{{connectionPort}}", port)
      .replace("{{connectionNamespace}}", this.connection.namespace);

    return `
      <style>${css}</style>
      ${processedHtml}
    `;
  }

  protected getCustomScript(): string {
    return `
      const getFileExtension = (filename) => {
        return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
      };

      // ---------------- TAB HANDLERS ----------------
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

      // ---------------- FILE BROWSE HANDLERS ----------------
      document.getElementById('browse-new-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'new-file-input');
      });

      document.getElementById('browse-existing-file-btn').addEventListener('click', () => {
        sendMessage('browse', 'existing-file-input');
      });

      // ---------------- NEW TABLE SCHEMA HANDLING ----------------
      // Toggle between dropdown and text input for schema
      document.getElementById('new-schema-mode-toggle').addEventListener('click', () => {
        const dropdown = document.getElementById('new-schema-select-wrapper');
        const textInput = document.getElementById('new-schema-text-wrapper');
        const button = document.getElementById('new-schema-mode-toggle');
        
        if (dropdown.style.display === 'none') {
          // Switch to dropdown mode
          dropdown.style.display = 'block';
          textInput.style.display = 'none';
          button.textContent = 'Create New Schema';
          button.title = 'Switch to manual entry to create a new schema';
        } else {
          // Switch to text input mode
          dropdown.style.display = 'none';
          textInput.style.display = 'block';
          button.textContent = 'Select Existing Schema';
          button.title = 'Switch to dropdown to select an existing schema';
        }
      });

      // Load schemas for new table creation
      document.getElementById('search-new-schema-btn').addEventListener('click', () => {
        const filter = document.getElementById('new-schema-search')?.value?.trim();
        sendMessage('run-with-progress', {
          title: filter ? \`Searching schemas (\${filter})...\` : 'Loading schemas...',
          command: 'load-schemas',
          args: {
            filter: filter || null,
            inputId: 'new-schema-select'
          }
        });
      });

      // Get current schema value (from dropdown or text input)
      function getCurrentNewSchema() {
        const dropdown = document.getElementById('new-schema-select-wrapper');
        if (dropdown.style.display === 'none') {
          return document.getElementById('new-schema-text-input').value.trim();
        } else {
          return document.getElementById('new-schema-select').value;
        }
      }

      // ---------------- FILE ANALYSIS ON SELECTION ----------------
      // Automatically analyze file when selected in "Create New Table" mode
      document.getElementById('new-file-input').addEventListener('change', (e) => {
        const filePath = e.target.value;
        if (filePath) {
          const fileExt = getFileExtension(filePath);
          sendMessage('run-with-progress', {
            title: 'Analyzing file structure...',
            command: 'analyze-file',
            args: { filePath, fileFormat: fileExt }
          });
        }
      });

      // ---------------- LOAD SCHEMAS FOR EXISTING TABLE ----------------
      document.getElementById('search-schema-btn-import').addEventListener('click', () => {
        const filter = document.getElementById('schema-search-import')?.value?.trim();
        sendMessage('run-with-progress', {
          title: filter ? \`Searching schemas (\${filter})...\` : 'Loading schemas...',
          command: 'load-schemas',
          args: {
            filter: filter || null,
            inputId: 'schema-import'
          }
        });
      });

      // ---------------- LOAD TABLES AFTER SCHEMA SELECT ----------------
      document.getElementById('schema-import').addEventListener('change', (e) => {
        const schema = e.target.value;
        const tableSelect = document.getElementById('table-import');

        if (schema) {
          tableSelect.disabled = true;
          sendMessage('run-with-progress', {
            title: \`Loading tables for \${schema}...\`,
            command: 'load-tables',
            args: { schema, inputId: 'table-import' }
          });
        } else {
          tableSelect.innerHTML = '<option value="">Select a schema first</option>';
          tableSelect.disabled = true;
        }
      });

      // ---------------- CREATE NEW TABLE IMPORT ----------------
      document.getElementById('create-import-btn').addEventListener('click', () => {
        const filePath = document.getElementById('new-file-input').value;
        const schema = getCurrentNewSchema();
        const tableName = document.getElementById('new-table-name').value.trim();
        const fileExt = getFileExtension(filePath);

        if (!filePath) return sendMessage('error', 'Please select a file to import');
        if (!schema) return sendMessage('error', 'Please enter or select a schema name');
        if (!tableName) return sendMessage('error', 'Please enter a table name');
        if (!['csv','json','txt','xlsx','xls'].includes(fileExt))
          return sendMessage('error', 'Unsupported file format. Must be CSV, JSON, TXT, or Excel');

        // Collect column type mappings
        let columnTypes = {};
        const typeSelects = document.querySelectorAll('.column-type-select');
        typeSelects.forEach(select => {
          const colName = select.dataset.colname;
          columnTypes[colName] = select.value;
        });

        sendMessage('run-with-progress', {
          title: \`Importing into \${schema}.\${tableName}...\`,
          command: 'import',
          args: {
            mode: 'create',
            filePath,
            tableName,
            schema,
            fileFormat: fileExt,
            columnTypes
          }
        });
      });

      // ---------------- LOAD EXISTING TABLE IMPORT ----------------
      document.getElementById('load-existing-btn').addEventListener('click', () => {
        const filePath = document.getElementById('existing-file-input').value;
        const schema = document.getElementById('schema-import').value;
        const tableName = document.getElementById('table-import').value;
        const dataAction = document.querySelector('input[name="data-action"]:checked').value;
        const fileExt = getFileExtension(filePath);

        if (!filePath) return sendMessage('error', 'Please select a file to import');
        if (!schema || !tableName)
          return sendMessage('error', 'Please select a target schema and table');
        if (!['csv','json','txt','xlsx','xls'].includes(fileExt))
          return sendMessage('error', 'Unsupported file format');

        sendMessage('run-with-progress', {
          title: \`Importing into \${schema}.\${tableName}...\`,
          command: 'import',
          args: {
            mode: 'load',
            filePath,
            tableName,
            schema,
            fileFormat: fileExt,
            dataAction
          }
        });
      });

      // ---------------- HANDLE MESSAGES ----------------
      const originalHandleMessage = handleMessage;
      handleMessage = function(message) {
        switch (message.type) {

          case 'schemas-loaded':
            const schemaSelect = document.getElementById(message.data.inputId);
            if (schemaSelect) {
              schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
              message.data.schemas.forEach(schema => {
                const option = document.createElement('option');
                option.value = schema;
                option.textContent = schema;
                schemaSelect.appendChild(option);
              });
              schemaSelect.disabled = false;
            }
            break;

          case 'tables-loaded':
            const tableSelect = document.getElementById(message.data.inputId || 'table-import');
            if (tableSelect) {
              tableSelect.innerHTML = '<option value="">Select a table...</option>';
              message.data.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                tableSelect.appendChild(option);
              });
              tableSelect.disabled = false;
            }
            break;

          case 'file-selected':
            const fileInput = document.getElementById(message.data.inputId);
            if (fileInput) {
              fileInput.value = message.data.filePath;
              // Trigger change event to auto-analyze if in new table mode
              if (message.data.inputId === 'new-file-input') {
                fileInput.dispatchEvent(new Event('change'));
              }
            }
            break;

          case 'file-analysis-complete':
            const container = document.getElementById('column-types-panel');
            if (message.data.columns && message.data.columns.length > 0) {
              container.innerHTML = \`
                <details open>
                  <summary>Column Type Mapping (\${message.data.columns.length} columns detected)</summary>
                  <div class="column-type-grid">
                    \${message.data.columns.map((c) => \`
                      <div class="column-row">
                        <span class="column-name" title="\${c.originalName}">\${c.name}</span>
                        <select data-colname="\${c.name}" class="column-type-select">
                          <option value="VARCHAR(255)" \${c.inferredType === "VARCHAR(255)" ? "selected":""}>VARCHAR(255)</option>
                          <option value="VARCHAR(4000)" \${c.inferredType === "VARCHAR(4000)" ? "selected":""}>VARCHAR(4000)</option>
                          <option value="CLOB" \${c.inferredType === "CLOB" ? "selected":""}>CLOB</option>
                          <option value="INTEGER" \${c.inferredType === "INTEGER" ? "selected":""}>INTEGER</option>
                          <option value="BIGINT" \${c.inferredType === "BIGINT" ? "selected":""}>BIGINT</option>
                          <option value="NUMERIC" \${c.inferredType === "NUMERIC" ? "selected":""}>NUMERIC</option>
                          <option value="DOUBLE" \${c.inferredType === "DOUBLE" ? "selected":""}>DOUBLE</option>
                          <option value="DATE" \${c.inferredType === "DATE" ? "selected":""}>DATE</option>
                          <option value="TIMESTAMP" \${c.inferredType === "TIMESTAMP" ? "selected":""}>TIMESTAMP</option>
                          <option value="BIT" \${c.inferredType === "BIT" ? "selected":""}>BIT</option>
                        </select>
                        <span class="column-sample" title="Sample: \${c.sampleValue}">\${c.sampleValue?.substring(0, 30) || 'NULL'}</span>
                      </div>
                    \`).join("")}
                  </div>
                </details>
              \`;
              container.style.display = "block";
            } else {
              container.innerHTML = '<p class="warning">No columns detected in file</p>';
              container.style.display = "block";
            }
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
      case "run-with-progress":
        // Handle progress-wrapped commands
        await this.handleProgressCommand(message.data);
        break;

      case "load-schemas":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: message.data?.filter
              ? `Searching schemas (${message.data.filter})...`
              : "Loading schemas...",
            cancellable: false,
          },
          async () => {
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
            await this.handleLoadTables(
              message.data.schema,
              message.data.inputId
            );
          }
        );
        break;

      case "browse":
        await this.handleBrowse(message.data);
        break;

      case "analyze-file":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing file structure...",
            cancellable: false,
          },
          async () => {
            await this.handleAnalyzeFile(message.data);
          }
        );
        break;

      case "import":
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Importing data...",
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

  /**
   * Handle progress-wrapped commands from frontend
   */
  private async handleProgressCommand(data: {
    title: string;
    command: string;
    args: any;
  }): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: data.title,
        cancellable: false,
      },
      async () => {
        // Route to appropriate handler based on command
        switch (data.command) {
          case "load-schemas":
            await this.handleLoadSchemas(data.args?.filter, data.args?.inputId);
            break;

          case "load-tables":
            await this.handleLoadTables(data.args.schema, data.args?.inputId);
            break;

          case "analyze-file":
            await this.handleAnalyzeFile(data.args);
            break;

          case "import":
            await this.handleImport(data.args);
            break;

          default:
            this.log(
              `[ImportWebview] Unknown command in run-with-progress: ${data.command}`
            );
            break;
        }
      }
    );
  }

  private async handleLoadSchemas(
    filter?: string,
    inputId?: string
  ): Promise<void> {
    try {
      this.log(`[ImportWebview] Loading schemas with filter: ${filter}`);
      const schemas = await this.connector.getSchemas(filter || null);

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

  private async handleLoadTables(
    schema: string,
    inputId?: string
  ): Promise<void> {
    try {
      this.log(`[ImportWebview] Loading tables for schema: ${schema}`);
      const tables = await this.connector.getTables(schema);

      this.postMessage("tables-loaded", {
        tables: tables,
        inputId: inputId || "table-import",
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load tables: ${error.message}`);
      this.postMessage("error", `Failed to load tables: ${error.message}`);
    }
  }

  private async handleBrowse(inputId: string): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        "Data Files": ["csv", "json", "txt", "xlsx", "xls"],
        "CSV Files": ["csv"],
        "JSON Files": ["json"],
        "Text Files": ["txt"],
        "Excel Files": ["xlsx", "xls"],
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

  private async handleAnalyzeFile(data: {
    filePath: string;
    fileFormat: string;
  }): Promise<void> {
    try {
      this.log(`[ImportWebview] Analyzing file: ${data.filePath}`);

      // Use connector's analyzeFile method
      const analysis = await this.connector.analyzeFile(
        data.filePath,
        data.fileFormat
      );

      this.log(
        `[ImportWebview] File analysis complete: ${analysis.columns.length} columns`
      );
      this.postMessage("file-analysis-complete", analysis);
    } catch (error: any) {
      vscode.window.showErrorMessage(`File analysis failed: ${error.message}`);
      this.postMessage("error", `File analysis failed: ${error.message}`);
    }
  }

  private async handleImport(data: ImportData): Promise<void> {
    try {
      this.log(`[ImportWebview] Starting import: ${JSON.stringify(data)}`);

      if (data.mode === "create") {
        // Create new table and import data
        await this.connector.importToNewTable(
          data.filePath,
          data.tableName,
          data.schema,
          data.fileFormat,
          data.columnTypes
        );
      } else {
        // Import into existing table
        await this.connector.importToExistingTable(
            data.filePath,
            data.tableName,
            data.schema,
            data.fileFormat,
            data.dataAction || 'append'
          );
      }

      vscode.window.showInformationMessage(
        `Data imported successfully into ${data.schema}.${data.tableName}`
      );
      this.postMessage("success", `Import completed successfully!`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Import failed: ${error.message}`);
      this.postMessage("error", `Import failed: ${error.message}`);
    }
  }
}

export interface ImportData {
  mode: "create" | "load";
  filePath: string;
  fileFormat: "csv" | "json" | "txt" | "xlsx" | "xls";
  schema: string;
  tableName: string;
  dataAction?: "append" | "replace";
  columnTypes?: Record<string, string>;
}
