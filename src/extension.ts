import * as vscode from "vscode";
import { ConnectionsProvider } from "./providers/connectionsProvider";
import { FavoritesProvider } from "./providers/favoritesProvider";
import { ConnectionManager } from "./iris/connectionManager";
import { CommandHandlers } from "./commands/commandHandlers";
import { WebviewManager } from "./webviews/webViewManager";

let connectionManager: ConnectionManager;
let webviewManager: WebviewManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
  context.subscriptions.push(outputChannel);

  // Initialize connection manager
  connectionManager = new ConnectionManager(outputChannel);
  webviewManager = new WebviewManager(context, connectionManager, outputChannel);

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
    outputChannel,
    webviewManager
  );
  commandHandlers.registerAll();
}

export function deactivate() {
  // Close all active connections
  connectionManager?.disconnectAll();
}
