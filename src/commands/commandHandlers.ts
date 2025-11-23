import * as vscode from "vscode";
import { ConnectionsProvider, Connection } from "../connectionsProvider";
import { ConnectionManager } from "../connectionManager";
import { ConnectionInputs } from "./connectionInputs";

/**
 * Handles all command registrations
 */
export class CommandHandlers {
  constructor(
    private context: vscode.ExtensionContext,
    private connectionsProvider: ConnectionsProvider,
    private connectionManager: ConnectionManager,
    private outputChannel: vscode.OutputChannel
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
    this.registerOpenConnection();
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
                  vscode.window.showInformationMessage(
                    `✅ Connected to "${connection.name}"!`
                  );
                } else {
                  connection.status = "error";
                  connection.errorMessage = "Connection test failed";
                  this.connectionsProvider.updateConnection(connection);
                  vscode.window
                    .showErrorMessage(
                      `❌ Failed to connect to "${connection.name}"! Test failed.`,
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
                    `❌ Failed to connect to "${connection.name}": ${error.message}`,
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
            vscode.window.showInformationMessage(
              `Not connected to "${connection.name}"`
            );
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

  private registerOpenConnection(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "irisIO.openConnection",
        async (connection: Connection) => {
          if (!connection) {
            vscode.window.showErrorMessage("Invalid connection");
            return;
          }

          this.connectionManager.logSeparator();
          this.outputChannel.appendLine(
            `Opening connection: ${connection.name}`
          );

          // Check if connection is active
          if (!this.connectionManager.isConnected(connection.id)) {
            vscode.window.showWarningMessage(
              `Connection "${connection.name}" is not active. Please connect first.`
            );
            return;
          }

          const connector = this.connectionManager.getConnector(connection.id);
          if (!connector) {
            vscode.window.showErrorMessage(
              `Could not retrieve connector for "${connection.name}"`
            );
            return;
          }

          try {
            const content = `# IRIS Connection: ${connection.name}

## Connection Details
- **Endpoint**: ${connection.endpoint}:${connection.port}
- **Namespace**: ${connection.namespace}
- **User**: ${connection.user}
- **Status**: Connected ✅

## Description
${connection.description || "No description provided"}

---

*This is a placeholder for your IRIS connection interface.*
*You can extend this to show globals, classes, queries, etc.*

## Quick Actions
- View Globals
- Execute ObjectScript
- Browse Classes
- Run SQL Queries
`;

            const document = await vscode.workspace.openTextDocument({
              content: content,
              language: "markdown",
            });

            await vscode.window.showTextDocument(document, {
              preview: false,
              viewColumn: vscode.ViewColumn.Active,
            });

            this.outputChannel.appendLine(
              `✓ Opened tab for connection: ${connection.name}`
            );
          } catch (error: any) {
            this.outputChannel.appendLine(
              `❌ Error opening connection tab: ${error.message}`
            );
            vscode.window.showErrorMessage(
              `Failed to open connection: ${error.message}`
            );
          }
        }
      )
    );
  }
}
