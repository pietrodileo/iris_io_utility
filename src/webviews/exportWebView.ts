import * as vscode from "vscode";
import { BaseWebview } from "../models/baseWebView";
import { Connection } from "../models/baseConnection";

/**
 * Webview for exporting data from IRIS
 */
export class ExportWebview extends BaseWebview {
  private schemas: string[] = [];
  private tables: string[] = [];

  constructor(
    context: vscode.ExtensionContext,
    connection: Connection
  ) {
    super(context, connection, "export");
  }

  protected getTitle(): string {
    return `Export Data - ${this.connection.name}`;
  }

  protected getBodyContent(): string {
    return `
      <div class="container">
        <div class="header">
          <h1>Export Data</h1>
          <div class="connection-info">
            Connected to: ${this.connection.name} (${this.connection.endpoint}:${this.connection.port} - Namespace: ${this.connection.namespace})
          </div>
        </div>

        <div class="info-message">
          Select a schema and table to export data from IRIS database.
        </div>

        <div class="form-group">
          <label for="schema">Schema *</label>
          <select id="schema" required>
            <option value="">Loading schemas...</option>
          </select>
          <small style="color: var(--vscode-descriptionForeground); margin-top: 4px; display: block;">
            Select the schema to export from
          </small>
        </div>

        <div class="form-group">
          <label for="table">Table *</label>
          <select id="table" required disabled>
            <option value="">Select a schema first</option>
          </select>
          <small style="color: var(--vscode-descriptionForeground); margin-top: 4px; display: block;">
            Select the table to export
          </small>
        </div>

        <div class="form-group">
          <label for="format">Export Format *</label>
          <select id="format" required>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="output-path">Output File Path *</label>
          <div class="file-input-wrapper">
            <input type="text" id="output-path" placeholder="Select output location..." readonly required />
            <button type="button" id="browse-output-btn">Browse...</button>
          </div>
        </div>

        <div class="button-group">
          <button type="button" id="export-btn">Export Data</button>
          <button type="button" id="cancel-btn" class="secondary">Cancel</button>
        </div>

        <div class="loading">
          <p>Exporting data...</p>
        </div>
      </div>
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

      // Browse output path
      document.getElementById('browse-output-btn').addEventListener('click', () => {
        const format = document.getElementById('format').value;
        sendMessage('browse-output', { format });
      });

      // Export button
      document.getElementById('export-btn').addEventListener('click', () => {
        const schema = document.getElementById('schema').value;
        const table = document.getElementById('table').value;
        const format = document.getElementById('format').value;
        const outputPath = document.getElementById('output-path').value;

        if (!schema) {
          showError('Please select a schema');
          return;
        }

        if (!table) {
          showError('Please select a table');
          return;
        }

        if (!outputPath) {
          showError('Please select an output file path');
          return;
        }

        showLoading(true);
        sendMessage('export', { schema, table, format, outputPath });
      });

      // Cancel button
      document.getElementById('cancel-btn').addEventListener('click', () => {
        sendMessage('cancel', null);
      });

      // Request initial schemas on load
      sendMessage('load-schemas', null);

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

          case 'output-path-selected':
            document.getElementById('output-path').value = message.data;
            break;

          default:
            originalHandleMessage(message);
        }
      };
    `;
  }

  protected async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case "load-schemas":
        await this.handleLoadSchemas();
        break;
      case "load-tables":
        await this.handleLoadTables(message.data.schema);
        break;
      case "browse-output":
        await this.handleBrowseOutput(message.data.format);
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
      // this.schemas = await this.onLoadSchemas();
      this.postMessage("schemas-loaded", this.schemas);
    } catch (error: any) {
      this.postMessage("error", `Failed to load schemas: ${error.message}`);
    }
  }

  private async handleLoadTables(schema: string): Promise<void> {
    try {
      // this.tables = await this.onLoadTables(schema);
      this.postMessage("tables-loaded", this.tables);
    } catch (error: any) {
      this.postMessage("error", `Failed to load tables: ${error.message}`);
      this.postMessage("loading", false);
    }
  }

  private async handleBrowseOutput(format: string): Promise<void> {
    const filters: { [key: string]: string[] } = {
      csv: ["csv"],
      json: ["json"],
      xlsx: ["xlsx"],
    };

    const fileUri = await vscode.window.showSaveDialog({
      filters: {
        [`${format.toUpperCase()} Files`]: filters[format],
        "All Files": ["*"],
      },
      defaultUri: vscode.Uri.file(`export.${format}`),
      title: "Save exported data",
    });

    if (fileUri) {
      this.postMessage("output-path-selected", fileUri.fsPath);
    }
  }

  private async handleExport(data: ExportData): Promise<void> {
    try {
      this.postMessage("loading", true);
      // await this.onExport(data);
      this.postMessage("success", "Data exported successfully!");
    } catch (error: any) {
      this.postMessage("error", `Export failed: ${error.message}`);
    }
  }
}

export interface ExportData {
  schema: string;
  table: string;
  format: "csv" | "json" | "xlsx";
  outputPath: string;
}
