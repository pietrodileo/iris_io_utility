import * as vscode from "vscode";
import { Connection } from "../models/baseConnection";
import { BaseWebview } from "../models/baseWebView";
import { ExportWebview } from "./exportWebView";
import { ImportWebview } from "./importWebView";

/* Manages webview panels for different connections and modes */
export class WebviewManager {
  private panels: Map<string, BaseWebview> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Show a webview for a connection and mode
   */
  public show(connection: Connection, mode: "import" | "export") {
    const key = `iris-${mode}-${connection.id}`;
    // Get existing panel if it exists
    let webview = this.panels.get(key);

    // If the panel exists but its internal WebviewPanel is disposed, remove it
    if (webview?.isDisposed?.()) {
      this.panels.delete(key);
      webview = undefined;
    }

    // If no existing panel, create a new one
    if (!webview) {
      webview =
        mode === "import"
          ? new ImportWebview(this.context, connection)
          : new ExportWebview(this.context, connection);

      this.panels.set(key, webview);

      // Remove from map on dispose
      webview.onDidDispose(() => {
        this.panels.delete(key);
      });
    }

    // Show the panel (reveal if already exists)
    webview.show();
  }

  /**
   * Close all panels (optional helper)
   */
  public disposeAll() {
    for (const webview of this.panels.values()) {
      webview.dispose();
    }
    this.panels.clear();
  }
}
