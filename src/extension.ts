import * as vscode from "vscode";
import { ConnectionsProvider } from "./connectionsProvider";
import { ConnectionManager } from "./connectionManager";
import { CommandHandlers } from "./commands/commandHandlers";

let connectionManager: ConnectionManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log("IRIS IO Utility is now active");

  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
  context.subscriptions.push(outputChannel);

  // Initialize connection manager
  connectionManager = new ConnectionManager(outputChannel);

  // Initialize connections provider
  const connectionsProvider = new ConnectionsProvider(context);
  vscode.window.registerTreeDataProvider(
    "irisIOConnections",
    connectionsProvider
  );

  // Register all commands
  const commandHandlers = new CommandHandlers(
    context,
    connectionsProvider,
    connectionManager,
    outputChannel
  );
  commandHandlers.registerAll();
}

export function deactivate() {
  // Close all active connections
  connectionManager?.disconnectAll();
}
