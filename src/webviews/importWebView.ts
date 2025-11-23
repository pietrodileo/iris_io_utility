import * as vscode from "vscode";
import { BaseWebview } from "../models/baseWebView";
import { Connection } from "../models/baseConnection";

/**
 * Webview for importing data into IRIS
 */
export class ImportWebview extends BaseWebview {
  constructor(
    context: vscode.ExtensionContext,
    connection: Connection
  ) {
    super(context, connection, "import");
  }

  protected getTitle(): string {
    return `Import Data - ${this.connection.name}`;
  }

  protected getBodyContent(): string {
    return `
      <div class="container">
        <div class="header">
          <h1>Import Data</h1>
          <div class="connection-info">
            Connected to: ${this.connection.name} (${this.connection.endpoint}:${this.connection.port} - Namespace: ${this.connection.namespace})
          </div>
        </div>

        <div class="info-message">
          Select a file (CSV, JSON, TXT, or Excel) to import into an IRIS table.
        </div>

        <div class="form-group">
          <label for="file-path">File to Import *</label>
          <div class="file-input-wrapper">
            <input type="text" id="file-path" placeholder="Select a file..." readonly required />
            <button type="button" id="browse-btn">Browse...</button>
          </div>
          <small style="color: var(--vscode-descriptionForeground); margin-top: 4px; display: block;">
            Supported formats: CSV, JSON, TXT, XLSX, XLS
          </small>
        </div>

        <div class="form-group">
          <label for="schema">Target Schema *</label>
          <input type="text" id="schema" placeholder="e.g., SQLUser" required />
          <small style="color: var(--vscode-descriptionForeground); margin-top: 4px; display: block;">
            The schema where the table will be created or updated
          </small>
        </div>

        <div class="form-group">
          <label for="table">Target Table Name *</label>
          <input type="text" id="table" placeholder="e.g., MyTable" required />
          <small style="color: var(--vscode-descriptionForeground); margin-top: 4px; display: block;">
            The table name to import data into
          </small>
        </div>

        <div class="button-group">
          <button type="button" id="import-btn">Import Data</button>
          <button type="button" id="cancel-btn" class="secondary">Cancel</button>
        </div>

        <div class="loading">
          <p>Importing data...</p>
        </div>
      </div>
    `;
  }

  protected getCustomScript(): string {
    return `
      document.getElementById('browse-btn').addEventListener('click', () => {
        sendMessage('browse', null);
      });

      document.getElementById('import-btn').addEventListener('click', () => {
        const filePath = document.getElementById('file-path').value;
        const schema = document.getElementById('schema').value.trim();
        const table = document.getElementById('table').value.trim();

        if (!filePath) {
          showError('Please select a file to import');
          return;
        }

        if (!schema) {
          showError('Please enter a schema name');
          return;
        }

        if (!table) {
          showError('Please enter a table name');
          return;
        }

        showLoading(true);
        sendMessage('import', { filePath, schema, table });
      });

      document.getElementById('cancel-btn').addEventListener('click', () => {
        sendMessage('cancel', null);
      });

      // Override handleMessage to include import-specific handlers
      const originalHandleMessage = handleMessage;
      handleMessage = function(message) {
        switch (message.type) {
          case 'file-selected':
            document.getElementById('file-path').value = message.data;
            break;
          default:
            originalHandleMessage(message);
        }
      };
    `;
  }

  protected async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case "browse":
        await this.handleBrowse();
        break;
      case "import":
        await this.handleImport(message.data);
        break;
      case "cancel":
        this.dispose();
        break;
    }
  }

  private async handleBrowse(): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        "Data Files": ["csv", "json", "txt", "xlsx", "xls"],
        "CSV Files": ["csv"],
        "JSON Files": ["json"],
        "Text Files": ["txt"],
        "Excel Files": ["xlsx", "xls"],
        "All Files": ["*"],
      },
      title: "Select file to import",
    });

    if (fileUri && fileUri[0]) {
      this.postMessage("file-selected", fileUri[0].fsPath);
    }
  }

  private async handleImport(data: ImportData): Promise<void> {
    try {
      this.postMessage("loading", true);
      // To do
      this.postMessage("success", "Data imported successfully!");
    } catch (error: any) {
      this.postMessage("error", `Import failed: ${error.message}`);
    }
  }
}

export interface ImportData {
  filePath: string;
  schema: string;
  table: string;
}
