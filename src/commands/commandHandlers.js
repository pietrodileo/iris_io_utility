"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandlers = void 0;
const vscode = __importStar(require("vscode"));
const connectionInputs_1 = require("./connectionInputs");
const OdbcSettingsWebView_1 = require("../webviews/OdbcSettingsWebView");
/**
 * Handles all command registrations
 */
class CommandHandlers {
    context;
    connectionsProvider;
    connectionManager;
    outputChannel;
    webviewManager;
    constructor(context, connectionsProvider, connectionManager, outputChannel, webviewManager) {
        this.context = context;
        this.connectionsProvider = connectionsProvider;
        this.connectionManager = connectionManager;
        this.outputChannel = outputChannel;
        this.webviewManager = webviewManager;
    }
    /**
     * Register all commands
     */
    registerAll() {
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
        this.registerCheckOdbcDrivers();
    }
    registerAddConnection() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.addConnection", async () => {
            const connectionData = await connectionInputs_1.ConnectionInputs.promptForConnection();
            if (!connectionData) {
                return;
            }
            const connection = {
                id: Date.now().toString(),
                ...connectionData,
                status: "idle",
            };
            this.connectionsProvider.addConnection(connection);
            vscode.window.showInformationMessage(`Connection "${connection.name}" added successfully!`);
        }));
    }
    registerEditConnection() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.editConnection", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            // if connection is connected, disconnect first
            if (this.connectionManager.isConnected(connection.id)) {
                this.connectionManager.disconnect(connection.id);
                connection.status = "idle";
                connection.errorMessage = undefined;
            }
            const connectionData = await connectionInputs_1.ConnectionInputs.promptForConnection(connection);
            if (!connectionData) {
                return;
            }
            const updatedConnection = {
                id: connection.id,
                ...connectionData,
                status: connection.status,
            };
            this.connectionsProvider.updateConnection(updatedConnection);
            vscode.window.showInformationMessage(`Connection "${updatedConnection.name}" updated successfully!`);
        }));
    }
    registerDeleteConnection() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.deleteConnection", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            const answer = await vscode.window.showWarningMessage(`Are you sure you want to delete "${connection.name}"?`, "Delete", "Cancel");
            if (answer === "Delete") {
                // Disconnect if connected
                if (this.connectionManager.isConnected(connection.id)) {
                    this.connectionManager.disconnect(connection.id);
                }
                this.connectionsProvider.deleteConnection(connection.id);
                vscode.window.showInformationMessage(`Connection "${connection.name}" deleted successfully!`);
            }
        }));
    }
    registerConnectToIris() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.connectToIris", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = { ...item.connection };
            // Update to connecting status immediately
            connection.status = "connecting";
            this.connectionsProvider.updateConnection(connection);
            this.connectionManager.logSeparator();
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Connecting to "${connection.name}."`,
                cancellable: false,
            }, async (progress) => {
                try {
                    progress.report({ message: "Establishing connection..." });
                    const success = await this.connectionManager.connect(connection);
                    if (success) {
                        connection.status = "connected";
                        connection.errorMessage = undefined;
                        this.connectionsProvider.updateConnection(connection);
                        // vscode.window.showInformationMessage(
                        //   `Connected to "${connection.name}"!`
                        // );
                    }
                    else {
                        connection.status = "error";
                        connection.errorMessage = "Connection test failed";
                        this.connectionsProvider.updateConnection(connection);
                        vscode.window
                            .showErrorMessage(`Failed to connect to "${connection.name}"! Test failed.`, "Show Output")
                            .then((selection) => {
                            if (selection === "Show Output") {
                                this.outputChannel.show();
                            }
                        });
                    }
                }
                catch (error) {
                    connection.status = "error";
                    connection.errorMessage = error.message || "Connection failed";
                    this.connectionsProvider.updateConnection(connection);
                    vscode.window
                        .showErrorMessage(`Failed to connect to "${connection.name}": ${error.message}`, "Show Output")
                        .then((selection) => {
                        if (selection === "Show Output") {
                            this.outputChannel.show();
                        }
                    });
                }
            });
        }));
    }
    registerDisconnectFromIris() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.disconnectFromIris", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = { ...item.connection };
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
            vscode.window.showInformationMessage(`Disconnected from "${connection.name}"`);
        }));
    }
    registerAddFavorite() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.addFavorite", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            // Check if already a favorite
            if (this.connectionsProvider.isFavorite(connection.id)) {
                vscode.window.showInformationMessage(`"${connection.name}" is already a favorite`);
                return;
            }
            this.connectionsProvider.addFavorite(connection.id);
            vscode.window.showInformationMessage(`Added "${connection.name}" to favorites`);
        }));
    }
    registerRemoveFavorite() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.removeFavorite", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            this.connectionsProvider.removeFavorite(connection.id);
            vscode.window.showInformationMessage(`Removed "${connection.name}" from favorites`);
        }));
    }
    /* ================== Table Import/Export ==================== */
    registerImportTables() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.importTables", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            this.webviewManager.show(connection, "import");
        }));
    }
    registerExportTables() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.exportTables", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            this.webviewManager.show(connection, "export");
        }));
    }
    registerCopyConnectionInfo() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.copyConnectionInfo", async (item) => {
            if (!item?.connection) {
                vscode.window.showErrorMessage("Invalid connection item");
                return;
            }
            const connection = item.connection;
            // Build connection info text as a json
            const info_json = {
                connection_name: connection.name,
                endpoint: `${connection.endpoint}:${connection.superServerPort}`,
                host: connection.endpoint,
                superserver_port: connection.superServerPort,
                webserver_port: connection.webServerPort,
                namespace: connection.namespace,
                user: connection.user,
                description: connection.description || null,
                status: connection.status,
                error_message: connection.errorMessage || null
            };
            const info = JSON.stringify(info_json, null, 2);
            // Copy to clipboard
            await vscode.env.clipboard.writeText(info);
            vscode.window.showInformationMessage(`Copied connection info for "${connection.name}" to clipboard`);
        }));
    }
    registerCheckOdbcDrivers() {
        this.context.subscriptions.push(vscode.commands.registerCommand("irisIO.checkOdbcDrivers", async () => {
            try {
                // Create and show the settings webview
                const settingsWebview = OdbcSettingsWebView_1.OdbcSettingsWebview.getInstance(this.context, this.outputChannel);
                await settingsWebview.show();
            }
            catch (err) {
                vscode.window.showErrorMessage(`Error opening ODBC settings: ${err?.message || err}`);
            }
        }));
    }
}
exports.CommandHandlers = CommandHandlers;
//# sourceMappingURL=commandHandlers.js.map