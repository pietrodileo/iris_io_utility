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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const connectionsProvider_1 = require("./providers/connectionsProvider");
const favoritesProvider_1 = require("./providers/favoritesProvider");
const connectionManager_1 = require("./iris/connectionManager");
const commandHandlers_1 = require("./commands/commandHandlers");
const webViewManager_1 = require("./webviews/webViewManager");
let connectionManager;
let webviewManager;
let outputChannel;
function activate(context) {
    try {
        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel("IRIS IO Utility");
        context.subscriptions.push(outputChannel);
        // Initialize connection manager
        connectionManager = new connectionManager_1.ConnectionManager(context, outputChannel);
        webviewManager = new webViewManager_1.WebviewManager(context, connectionManager, outputChannel);
        // Initialize connections provider
        const connectionsProvider = new connectionsProvider_1.ConnectionsProvider(context);
        vscode.window.registerTreeDataProvider("irisIOConnections", connectionsProvider);
        // Initialize favorites provider
        const favoritesProvider = new favoritesProvider_1.FavoritesProvider(connectionsProvider);
        vscode.window.registerTreeDataProvider("irisIOFavorites", favoritesProvider);
        // Register all commands
        const commandHandlers = new commandHandlers_1.CommandHandlers(context, connectionsProvider, connectionManager, outputChannel, webviewManager);
        commandHandlers.registerAll();
        vscode.window.showInformationMessage("IRIS IO Utility is now active!");
    }
    catch (error) {
        vscode.window.showErrorMessage(`IRIS IO Utility failed to activate: ${error}`);
        console.error("Activation error:", error);
    }
}
function deactivate() {
    // Close all active connections
    connectionManager?.disconnectAll();
}
//# sourceMappingURL=extension.js.map