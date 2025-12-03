import * as vscode from "vscode";
import { Connection } from "../models/baseConnection";
import { BaseWebview } from "../models/baseWebView";
import { ExportWebview } from "./exportWebView";
import { ImportWebview } from "./importWebView";
import { ConnectionManager } from "../iris/connectionManager";

/* Manages webview panels for different connections and modes */
export class WebviewManager {
  private panels: Map<string, BaseWebview> = new Map();
  private connectionManager: ConnectionManager;
  private outputChannel: vscode.OutputChannel;
  private static readonly CONNECTION_TYPE_KEY = "irisIO.defaultConnectionType";
  private static readonly ODBC_DRIVER_KEY = "irisIO.odbcDriver";

  constructor(
    private context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
    outputChannel: vscode.OutputChannel
  ) {
    this.outputChannel = outputChannel;
    this.connectionManager = connectionManager;
  }

  /**
   * Show a webview for a connection and mode
   */
  public show(connection: Connection, mode: "import" | "export") {
    const key = `iris-${mode}-${connection.id}`;
    this.log(
      `[WebviewManager] Showing webview with mode '${mode}' for connection item: ${key}`
    );
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
          ? new ImportWebview(
              this.context,
              connection,
              this.connectionManager,
              this.outputChannel
            )
          : new ExportWebview(
              this.context,
              connection,
              this.connectionManager,
              this.outputChannel
            );

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

  static getDefaultConnectionType(
    context: vscode.ExtensionContext
  ): "native" | "odbc" {
    return context.workspaceState.get<"native" | "odbc">(
      this.CONNECTION_TYPE_KEY,
      "native"
    );
  }

  static getOdbcDriver(context: vscode.ExtensionContext): string {
    return context.workspaceState.get<string>(
      this.ODBC_DRIVER_KEY,
      "InterSystems IRIS ODBC35"
    );
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
