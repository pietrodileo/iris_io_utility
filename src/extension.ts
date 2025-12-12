import * as vscode from "vscode";
import { ConnectionsProvider } from "./providers/connectionsProvider";
import { FavoritesProvider } from "./providers/favoritesProvider";
import { ConnectionManager } from "./iris/connectionManager";
import { CommandHandlers } from "./commands/commandHandlers";
import { WebviewManager } from "./webviews/webViewManager";
import { OdbcDriverChecker } from "./iris/models/connection/odbcDriverChecker";
import { SettingsManager } from "./webviews/settingsManager";

let connectionManager: ConnectionManager;
let webviewManager: WebviewManager;
let outputChannel: vscode.OutputChannel;
let settingsManager: SettingsManager;

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
    context.subscriptions.push(outputChannel);

    // Check if the ODBC driver has already been selected by the user
    const odbcDriver = SettingsManager.getOdbcDriver(context);
    if (odbcDriver) {
      // Use the selected ODBC driver
      outputChannel.appendLine(`[Activation] Using ODBC driver: ${odbcDriver}`);
    } else {
      // Check for ODBC drivers
      outputChannel.appendLine("[Activation] Checking for ODBC drivers...");
      const driverChecker = new OdbcDriverChecker(outputChannel);
      const driversAvailable = await driverChecker.checkOdbcDrivers();
      if (!driversAvailable) {
        outputChannel.appendLine(
          "[Activation] No ODBC drivers found. Please install ODBC drivers."
        );
      } else {
        // List installed drivers
        const available = await driverChecker.listInstalledDrivers();
        // Prefer InterSystems / IRIS / Cache if present
        const preferred =
          available.find(
            (d) =>
              d.toLowerCase().includes("iris") ||
              d.toLowerCase().includes("intersystems") ||
              d.toLowerCase().includes("cache")
          ) ?? available[0];

        outputChannel.appendLine(`[Activation] Selected ODBC driver: ${preferred}`);

        // Save in workspaceState
        await SettingsManager.setOdbcDriver(context, preferred);
      }
    }

    // Initialize connection manager
    connectionManager = new ConnectionManager(context, outputChannel);
    webviewManager = new WebviewManager(
      context,
      connectionManager,
      outputChannel
    );

    // Initialize connections provider
    const connectionsProvider = new ConnectionsProvider(context);
    vscode.window.registerTreeDataProvider(
      "irisIOConnections",
      connectionsProvider
    );

    // Initialize favorites provider
    const favoritesProvider = new FavoritesProvider(connectionsProvider);
    vscode.window.registerTreeDataProvider(
      "irisIOFavorites",
      favoritesProvider
    );

    // Register all commands
    const commandHandlers = new CommandHandlers(
      context,
      connectionsProvider,
      connectionManager,
      outputChannel,
      webviewManager
    );
    commandHandlers.registerAll();
    vscode.window.showInformationMessage("IRIS IO Utility is now active!");
  } catch (error) {
    vscode.window.showErrorMessage(`IRIS IO Utility failed to activate: ${error}`);
    console.error("Activation error:", error);
  }
}

export function deactivate() {
  // Close all active connections
  connectionManager?.disconnectAll();
}
