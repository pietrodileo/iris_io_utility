// TableTransferWebview.ts
import * as vscode from "vscode";
import { Connection } from "../connectionsProvider";

export class TableTransferWebview {
  private panel?: vscode.WebviewPanel;
  private disposeCallback?: () => void;

  // Expose a callback setter for disposal
  public onDidDispose(callback: () => void) {
    this.disposeCallback = callback;
  }

  open(connection: Connection, mode: "import" | "export") {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        `iris-${mode}-${connection.id}`, // unique viewType per connection+mode
        `${mode.toUpperCase()} tables: ${connection.name}`,
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        if (this.disposeCallback) {this.disposeCallback();}
      });
    }

    this.panel.title = `${mode.toUpperCase()} tables: ${connection.name}`;
    this.panel.webview.html = this.getHtml(connection, mode);
    this.panel.reveal(vscode.ViewColumn.Active);
  }

  private getHtml(connection: Connection, mode: string) {
    return `<html>
      <body>
        <h1>${mode.toUpperCase()} tables for ${connection.name}</h1>
        <p>Here you can implement table import/export UI.</p>
      </body>
    </html>`;
  }
}
