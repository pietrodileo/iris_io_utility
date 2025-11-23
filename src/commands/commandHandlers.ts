import * as vscode from "vscode";
import { Connection } from "../models/baseConnection";
import { ConnectionsProvider } from "../providers/connectionsProvider";
import { ConnectionManager } from "../iris/connectionManager";
import { ConnectionInputs } from "./connectionInputs";
import { TableTransferWebview } from "../webviews/tableTransferWebview";
import { ImportWebview } from "../webviews/importWebView";
import { ExportWebview } from "../webviews/exportWebView";
import { WebviewManager } from "../webviews/webViewManager";

/**
 * Handles all command registrations
 */
export class CommandHandlers {
  constructor(
    private context: vscode.ExtensionContext,
    private connectionsProvider: ConnectionsProvider,
    private connectionManager: ConnectionManager,
    private outputChannel: vscode.OutputChannel,
    private webviewManager: WebviewManager
  ) {}

  /**
   * Register all commands
   */
  registerAll(): void {
    this.registerAddConnection();
    this.registerEditConnection();
    this.registerDeleteConnection();
    this.registerConnectToIris();
    this.registerDisconnectFromIris();
    this.registerAddFavorite();
    this.registerRemoveFavorite();
    this.registerImportTables();
    this.registerExportTables();
    this.registerCopyConnectionInfo();
  }

  private registerAddConnection(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("irisIO.addConnection", async () => {
        const connectionData = await ConnectionInputs.promptForConnection();
        if (!connectionData) {
          return;
        }

        const connection: Connection = {
          id: Date.now().toString(),
          ...connectionData,
          status: "idle",
        };

        this.connectionsProvider.addConnection(connection);
        vscode.window.showInformationMessage(
          `Connection "${connection.name}" added successfully!`
        );
      })
    );
  }

  private registerEditConnection(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.editConnection",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = item.connection as Connection;
          const connectionData = await ConnectionInputs.promptForConnection(
            connection
          );

          if (!connectionData) {
            return;
          }

          const updatedConnection: Connection = {
            id: connection.id,
            ...connectionData,
            status: connection.status,
          };

          this.connectionsProvider.updateConnection(updatedConnection);
          vscode.window.showInformationMessage(
            `Connection "${updatedConnection.name}" updated successfully!`
          );
        }
      )
    );
  }

  private registerDeleteConnection(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.deleteConnection",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = item.connection as Connection;
          const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${connection.name}"?`,
            "Delete",
            "Cancel"
          );

          if (answer === "Delete") {
            // Disconnect if connected
            if (this.connectionManager.isConnected(connection.id)) {
              this.connectionManager.disconnect(connection.id);
            }

            this.connectionsProvider.deleteConnection(connection.id);
            vscode.window.showInformationMessage(
              `Connection "${connection.name}" deleted successfully!`
            );
          }
        }
      )
    );
  }

  private registerConnectToIris(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.connectToIris",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = { ...item.connection } as Connection;

          // Update to connecting status immediately
          connection.status = "connecting";
          this.connectionsProvider.updateConnection(connection);

          this.connectionManager.logSeparator();

          // Show progress notification
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Connecting to "${connection.name}"...`,
              cancellable: false,
            },
            async (progress) => {
              try {
                progress.report({ message: "Establishing connection..." });

                const success = await this.connectionManager.connect(
                  connection
                );

                if (success) {
                  connection.status = "connected";
                  connection.errorMessage = undefined;
                  this.connectionsProvider.updateConnection(connection);
                  // vscode.window.showInformationMessage(
                  //   `Connected to "${connection.name}"!`
                  // );
                } else {
                  connection.status = "error";
                  connection.errorMessage = "Connection test failed";
                  this.connectionsProvider.updateConnection(connection);
                  vscode.window
                    .showErrorMessage(
                      `Failed to connect to "${connection.name}"! Test failed.`,
                      "Show Output"
                    )
                    .then((selection) => {
                      if (selection === "Show Output") {
                        this.outputChannel.show();
                      }
                    });
                }
              } catch (error: any) {
                connection.status = "error";
                connection.errorMessage = error.message || "Connection failed";
                this.connectionsProvider.updateConnection(connection);
                vscode.window
                  .showErrorMessage(
                    `Failed to connect to "${connection.name}": ${error.message}`,
                    "Show Output"
                  )
                  .then((selection) => {
                    if (selection === "Show Output") {
                      this.outputChannel.show();
                    }
                  });
              }
            }
          );
        }
      )
    );
  }

  private registerDisconnectFromIris(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.disconnectFromIris",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = { ...item.connection } as Connection;

          if (!this.connectionManager.isConnected(connection.id)) {
            // vscode.window.showInformationMessage(
            //   `Not connected to "${connection.name}"`
            // );
            return;
          }

          this.connectionManager.disconnect(connection.id);

          connection.status = "idle";
          connection.errorMessage = undefined;
          this.connectionsProvider.updateConnection(connection);
          vscode.window.showInformationMessage(
            `Disconnected from "${connection.name}"`
          );
        }
      )
    );
  }

  private registerAddFavorite(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.addFavorite",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }
          const connection = item.connection;
          // Check if already a favorite
          if (this.connectionsProvider.isFavorite(connection.id)) {
            vscode.window.showInformationMessage(
              `"${connection.name}" is already a favorite`
            );
            return;
          }
          this.connectionsProvider.addFavorite(connection.id);
          vscode.window.showInformationMessage(
            `Added "${connection.name}" to favorites`
          );
        }
      )
    );
  }

  private registerRemoveFavorite(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.removeFavorite",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = item.connection;
          this.connectionsProvider.removeFavorite(connection.id);
          vscode.window.showInformationMessage(
            `Removed "${connection.name}" from favorites`
          );
        }
      )
    );
  }

  /* ================== Table Import/Export ==================== */
  private tableWebviews: Map<string, TableTransferWebview> = new Map();

  private openTableWebview(connection: Connection, mode: "import" | "export") {
    if (!connection) {
      vscode.window.showErrorMessage("Invalid connection");
      return;
    }

    if (!this.connectionManager.isConnected(connection.id)) {
      vscode.window.showWarningMessage(
        `Connection "${connection.name}" is not active. Please connect first.`
      );
      return;
    }

    const key = `${connection.id}-${mode}`;

    let webview = this.tableWebviews.get(key);
    if (!webview) {
      webview = new TableTransferWebview();
      this.tableWebviews.set(key, webview);

      // When the panel is closed, remove it from the map
      webview.onDidDispose(() => {
        this.tableWebviews.delete(key);
      });
    }

    webview.open(connection, mode);
  }

  private registerImportTables(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("irisIO.importTables",async (item: any) => {
        if (!item?.connection) {
          vscode.window.showErrorMessage("Invalid connection item");
          return;
        }

        const connection = item.connection;
        this.webviewManager.show(connection, "import");
      })
    );
  }

  private registerExportTables(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("irisIO.exportTables",async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }
          const connection = item.connection;
          this.openTableWebview(connection, "export");
        }
      )
    );
  }

  private registerCopyConnectionInfo(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.copyConnectionInfo",
        async (item: any) => {
          if (!item?.connection) {
            vscode.window.showErrorMessage("Invalid connection item");
            return;
          }

          const connection = item.connection as Connection;

          // Build connection info text
          const info = [
            `Connection: ${connection.name}`,
            `Endpoint: ${connection.endpoint}:${connection.port}`,
            `Namespace: ${connection.namespace}`,
            `User: ${connection.user}`,
            connection.description
              ? `Description: ${connection.description}`
              : null,
            `Status: ${connection.status || "idle"}`,
            connection.errorMessage
              ? `Error: ${connection.errorMessage}`
              : null,
          ]
            .filter(Boolean) // Remove null entries
            .join("\n");

          // Copy to clipboard
          await vscode.env.clipboard.writeText(info);

          vscode.window.showInformationMessage(
            `Copied connection info for "${connection.name}" to clipboard`
          );

          this.outputChannel.appendLine(`\n${"=".repeat(60)}`);
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] Copied connection info to clipboard`
          );
          this.outputChannel.appendLine(info);
        }
      )
    );
  }
}