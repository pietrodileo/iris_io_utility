import * as vscode from "vscode";
import { ConnectionsProvider, Connection } from "./connectionsProvider";
import { IrisConnector } from "./iris/irisConnector";

// Store active connections
const activeConnections = new Map<string, IrisConnector>();

// Output channel for logging
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log("IRIS IO Utility is now active");

  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
  context.subscriptions.push(outputChannel);

  const connectionsProvider = new ConnectionsProvider(context);

  vscode.window.registerTreeDataProvider(
    "irisIOConnections",
    connectionsProvider
  );

  // Helper function to update context for button visibility
  const updateConnectionContext = (
    connectionId: string,
    isConnected: boolean
  ) => {
    vscode.commands.executeCommand(
      "setContext",
      "irisIO.isConnected",
      isConnected
    );
  };

  // Add new connection
  context.subscriptions.push(
    vscode.commands.registerCommand("irisIO.addConnection", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter connection name",
        placeHolder: "My IRIS Connection",
      });

      if (!name) {
        return;
      }

      const endpoint = await vscode.window.showInputBox({
        prompt: "Enter endpoint",
        placeHolder: "localhost or 192.168.1.100",
      });

      if (!endpoint) {
        return;
      }

      const port = await vscode.window.showInputBox({
        prompt: "Enter port",
        placeHolder: "52773",
        validateInput: (value) => {
          const portNum = parseInt(value);
          if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return "Please enter a valid port number (1-65535)";
          }
          return null;
        },
      });

      if (!port) {
        return;
      }

      const namespace = await vscode.window.showInputBox({
        prompt: "Enter namespace",
        placeHolder: "USER",
        value: "USER",
      });

      if (!namespace) {
        return;
      }

      const user = await vscode.window.showInputBox({
        prompt: "Enter username",
        placeHolder: "_SYSTEM",
      });

      if (!user) {
        return;
      }

      const password = await vscode.window.showInputBox({
        prompt: "Enter password",
        placeHolder: "SYS",
        password: true,
      });

      if (!password) {
        return;
      }

      const description = await vscode.window.showInputBox({
        prompt: "Enter description (optional)",
        placeHolder: "Development database",
      });

      const connection: Connection = {
        id: Date.now().toString(),
        name,
        endpoint,
        port: parseInt(port),
        namespace,
        user,
        password,
        description: description || "",
        status: "idle",
      };

      connectionsProvider.addConnection(connection);
      vscode.window.showInformationMessage(
        `Connection "${name}" added successfully!`
      );
    })
  );

  // Edit connection
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "irisIO.editConnection",
      async (item: any) => {
        if (!item || !item.connection) {
          vscode.window.showErrorMessage("Invalid connection item");
          return;
        }

        const connection = item.connection as Connection;

        const name = await vscode.window.showInputBox({
          prompt: "Enter connection name",
          value: connection.name,
        });

        if (!name) {
          return;
        }

        const endpoint = await vscode.window.showInputBox({
          prompt: "Enter endpoint",
          value: connection.endpoint,
        });

        if (!endpoint) {
          return;
        }

        const port = await vscode.window.showInputBox({
          prompt: "Enter port",
          value: connection.port.toString(),
          validateInput: (value) => {
            const portNum = parseInt(value);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
              return "Please enter a valid port number (1-65535)";
            }
            return null;
          },
        });

        if (!port) {
          return;
        }

        const namespace = await vscode.window.showInputBox({
          prompt: "Enter namespace",
          value: connection.namespace,
        });

        if (!namespace) {
          return;
        }

        const user = await vscode.window.showInputBox({
          prompt: "Enter username",
          value: connection.user,
        });

        if (!user) {
          return;
        }

        const password = await vscode.window.showInputBox({
          prompt: "Enter password",
          value: connection.password,
          password: true,
        });

        if (!password) {
          return;
        }

        const description = await vscode.window.showInputBox({
          prompt: "Enter description (optional)",
          value: connection.description,
        });

        const updatedConnection: Connection = {
          id: connection.id,
          name,
          endpoint,
          port: parseInt(port),
          namespace,
          user,
          password,
          description: description || "",
          status: connection.status,
        };

        connectionsProvider.updateConnection(updatedConnection);
        vscode.window.showInformationMessage(
          `Connection "${name}" updated successfully!`
        );
      }
    )
  );

  // Delete connection
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "irisIO.deleteConnection",
      async (item: any) => {
        if (!item || !item.connection) {
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
          if (activeConnections.has(connection.id)) {
            const connector = activeConnections.get(connection.id);
            connector?.close();
            activeConnections.delete(connection.id);
          }

          connectionsProvider.deleteConnection(connection.id);
          vscode.window.showInformationMessage(
            `Connection "${connection.name}" deleted successfully!`
          );
        }
      }
    )
  );

  // Connect to IRIS (with automatic test)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "irisIO.connectToIris",
      async (item: any) => {
        if (!item || !item.connection) {
          vscode.window.showErrorMessage("Invalid connection item");
          return;
        }

        const connection = item.connection as Connection;

        // Check if already connected
        if (activeConnections.has(connection.id)) {
          vscode.window.showInformationMessage(
            `Already connected to "${connection.name}"`
          );
          return;
        }

        outputChannel.appendLine(`\n${"=".repeat(60)}`);
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Connecting to: ${connection.name}`
        );
        outputChannel.appendLine(`Connection details:`);
        outputChannel.appendLine(`  Host: ${connection.endpoint}`);
        outputChannel.appendLine(`  Port: ${connection.port}`);
        outputChannel.appendLine(`  Namespace: ${connection.namespace}`);
        outputChannel.appendLine(`  User: ${connection.user}`);

        // Update to connecting status immediately
        connection.status = "connecting";
        connectionsProvider.updateConnection(connection);

        // Show progress notification
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Connecting to "${connection.name}"...`,
            cancellable: false,
          },
          async (progress) => {
            try {
              const connector = new IrisConnector();

              progress.report({ message: "Establishing connection..." });
              outputChannel.appendLine(`Attempting to connect...`);

              const config = {
                host: connection.endpoint,
                port: connection.port,
                ns: connection.namespace,
                user: connection.user,
                pwd: connection.password,
              };
              outputChannel.appendLine(
                `Config: ${JSON.stringify({ ...config, pwd: "***" })}`
              );

              await connector.connect(config);
              outputChannel.appendLine(`✓ Connection established successfully`);

              progress.report({ message: "Testing connection..." });
              outputChannel.appendLine(`Testing connection...`);
              const testResult = await connector.test();
              outputChannel.appendLine(`Test result: ${testResult}`);

              if (testResult) {
                activeConnections.set(connection.id, connector);
                connection.status = "connected";
                connection.errorMessage = undefined;
                connectionsProvider.updateConnection(connection);
                updateConnectionContext(connection.id, true);
                outputChannel.appendLine(`✅ Successfully connected!`);
                vscode.window.showInformationMessage(
                  `✅ Connected to "${connection.name}"!`
                );
              } else {
                connector.close();
                connection.status = "error";
                connection.errorMessage = "Connection test failed";
                connectionsProvider.updateConnection(connection);
                outputChannel.appendLine(`❌ Connection test failed`);
                vscode.window
                  .showErrorMessage(
                    `❌ Failed to connect to "${connection.name}"! Test failed.`,
                    "Show Output"
                  )
                  .then((selection) => {
                    if (selection === "Show Output") {
                      outputChannel.show();
                    }
                  });
              }
            } catch (error: any) {
              connection.status = "error";
              connection.errorMessage = error.message || "Connection failed";
              connectionsProvider.updateConnection(connection);
              outputChannel.appendLine(
                `❌ Error: ${error.message || "Unknown error"}`
              );
              outputChannel.appendLine(
                `Stack trace: ${error.stack || "No stack trace"}`
              );
              vscode.window
                .showErrorMessage(
                  `❌ Failed to connect to "${connection.name}": ${error.message}`,
                  "Show Output"
                )
                .then((selection) => {
                  if (selection === "Show Output") {
                    outputChannel.show();
                  }
                });
            }
          }
        );
      }
    )
  );

  // Disconnect from IRIS
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "irisIO.disconnectFromIris",
      async (item: any) => {
        if (!item || !item.connection) {
          vscode.window.showErrorMessage("Invalid connection item");
          return;
        }

        const connection = item.connection as Connection;

        if (!activeConnections.has(connection.id)) {
          vscode.window.showInformationMessage(
            `Not connected to "${connection.name}"`
          );
          return;
        }

        const connector = activeConnections.get(connection.id);
        connector?.close();
        activeConnections.delete(connection.id);

        connection.status = "idle";
        connection.errorMessage = undefined;
        connectionsProvider.updateConnection(connection);
        updateConnectionContext(connection.id, false);
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Disconnected from: ${connection.name}`
        );
        vscode.window.showInformationMessage(
          `Disconnected from "${connection.name}"`
        );
      }
    )
  );

  // Open connection in a new tab
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "irisIO.openConnection",
      async (connection: Connection) => {
        if (!connection) {
          vscode.window.showErrorMessage("Invalid connection");
          return;
        }

        outputChannel.appendLine(`\n${"=".repeat(60)}`);
        outputChannel.appendLine(
          `[${new Date().toISOString()}] Opening connection: ${connection.name}`
        );

        // Check if connection is active
        if (!activeConnections.has(connection.id)) {
          vscode.window.showWarningMessage(
            `Connection "${connection.name}" is not active. Please connect first.`
          );
          return;
        }

        const connector = activeConnections.get(connection.id);
        if (!connector) {
          vscode.window.showErrorMessage(
            `Could not retrieve connector for "${connection.name}"`
          );
          return;
        }

        try {
          // Create a new untitled document with connection info
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

          outputChannel.appendLine(
            `✓ Opened tab for connection: ${connection.name}`
          );
        } catch (error: any) {
          outputChannel.appendLine(
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

export function deactivate() {
  // Close all active connections
  activeConnections.forEach((connector) => connector.close());
  activeConnections.clear();
}
