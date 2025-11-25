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
    const jsPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "import",
      "import.js"
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
