import * as vscode from "vscode";
import { ConnectionsProvider } from "./providers/connectionsProvider";
import { FavoritesProvider } from "./providers/favoritesProvider";
import { ConnectionManager } from "./connectionManager";
import { CommandHandlers } from "./commands/commandHandlers";

let connectionManager: ConnectionManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
  context.subscriptions.push(outputChannel);

  // Initialize connection manager
  connectionManager = new ConnectionManager(outputChannel);

  // Initialize connections provider
  const connectionsProvider = new ConnectionsProvider(context);
  vscode.window.registerTreeDataProvider("irisIOConnections",connectionsProvider);

  // Initialize favorites provider
  const favoritesProvider = new FavoritesProvider(connectionsProvider);
  vscode.window.registerTreeDataProvider("irisIOFavorites", favoritesProvider);

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
