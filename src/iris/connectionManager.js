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
exports.ConnectionManager = void 0;
const vscode = __importStar(require("vscode"));
const irisConnector_1 = require("./irisConnector");
const odbcDriverChecker_1 = require("../iris/models/connection/odbcDriverChecker");
const settingsManager_1 = require("../webviews/settingsManager");
/**
 * Manages active IRIS connections
 */
class ConnectionManager {
    context;
    activeConnections = new Map();
    outputChannel;
    constructor(context, outputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.context = context;
    }
    /**
     * Check if a connection is active
     */
    isConnected(connectionId) {
        return this.activeConnections.has(connectionId);
    }
    /**
     * Get an active connector
     */
    getConnector(connectionId) {
        return this.activeConnections.get(connectionId);
    }
    /**
     * Connect to IRIS with automatic testing
     */
    async connect(connection) {
        // Check if already connected
        if (this.isConnected(connection.id)) {
            vscode.window.showInformationMessage(`Already connected to "${connection.name}"`);
            return false;
        }
        this.log(`[ConnectionManager] Connecting to: ${connection.name}`);
        this.log(`[ConnectionManager]   Host: ${connection.endpoint}`);
        this.log(`[ConnectionManager]   Superserver Port: ${connection.superServerPort}`);
        this.log(`[ConnectionManager]   Web Server Port: ${connection.webServerPort}`);
        this.log(`[ConnectionManager]   Namespace: ${connection.namespace}`);
        this.log(`[ConnectionManager]   User: ${connection.user}`);
        try {
            // Get connection type from settings
            let connectionType = settingsManager_1.SettingsManager.getDefaultConnectionType(this.context);
            // if connection type is ODBC, try to connect. If the attempt fails, use native connection
            let connector;
            this.log(`[ConnectionManager] Attempting to connect...`);
            connector = await this.createConnector(connection, connectionType);
            // ** Old implementation, deprecated **
            // const driverChecker = new OdbcDriverChecker(this.outputChannel);
            // const odbcAvailable = await driverChecker.checkOdbcDrivers();
            // let connectionType: ConnectionType = "native"; // default to native
            // if (odbcAvailable) {
            //   this.log(`[ConnectionManager] ODBC drivers available`);
            //   connectionType = "odbc";
            // } else {
            //   this.log(
            //     `[ConnectionManager] ODBC drivers not available. Proceeding with native connection...`
            //   );
            // }
            // try {
            //   this.log(`[ConnectionManager] Attempting to connect...`);
            //   connector = await this.createConnector(connection, connectionType);
            // } catch (error: any) {
            //   if (connectionType === "odbc") {
            //     this.log(`[ConnectionManager] ODBC connection failed: ${error.message}. Trying native connection...`);
            //     connectionType = "native";
            //     connector = await this.createConnector(connection, "native");
            //   } else {
            //   throw error;
            //   }
            // }
            if (!connector) {
                this.log(`[ConnectionManager] Connection failed`);
                throw new Error("Connection failed");
            }
            // Set connection type
            if (connectionType === "odbc") {
                connection.isOdbc = true;
            }
            this.activeConnections.set(connection.id, connector);
            this.log(`[ConnectionManager] Successfully connected with ${connectionType}!`);
            return true;
        }
        catch (error) {
            this.log(`[ConnectionManager] Error: ${error.message || "Unknown error"}`);
            this.log(`[ConnectionManager] Stack trace: ${error.stack || "No stack trace"}`);
            throw error;
        }
    }
    /*
      This method tries to connect to IRIS with the specified connection type (odbc or native).
      If odbc is selected, it will try to connect with odbc first, and if that fails, it will try to connect with native.
    */
    async createConnector(connection, connectionType) {
        try {
            const config = {
                host: connection.endpoint,
                superServerPort: connection.superServerPort,
                webServerPort: connection.webServerPort,
                ns: connection.namespace,
                user: connection.user,
                pwd: connection.password,
                connectionType: connectionType,
            };
            if (connectionType === "odbc") {
                this.log(`[ConnectionManager] Testing if ODBC drivers are available...`);
                // --- Perform ODBC check ---
                const driverChecker = new odbcDriverChecker_1.OdbcDriverChecker(this.outputChannel);
                const odbcAvailable = await driverChecker.checkOdbcDrivers();
                if (!odbcAvailable) {
                    this.log(`[ConnectionManager] ODBC drivers not available`);
                    throw new Error("ODBC drivers not available");
                }
            }
            this.log(`[ConnectionManager] Config: ${JSON.stringify({ ...config, pwd: "***", })}`);
            // if connection type is ODBC, try to connect. If the attempt fails, use native connection
            const connector = new irisConnector_1.IrisConnector(config, this.outputChannel, this.context);
            this.log(`[ConnectionManager] Attempting to connect with connection type: ${connectionType}...`);
            await connector.connect();
            this.log(`[ConnectionManager] Connection established successfully`);
            return connector;
        }
        catch (error) {
            this.log(`[ConnectionManager] ${connectionType.toUpperCase()} connection failed: ${error?.message}`);
            throw error;
        }
    }
    /**
     * Disconnect from IRIS
     */
    disconnect(connectionId) {
        const connector = this.activeConnections.get(connectionId);
        if (connector) {
            connector.close();
            this.activeConnections.delete(connectionId);
            this.log(`[ConnectionManager] Disconnected from connection ID: ${connectionId}`);
        }
    }
    /**
     * Close all connections
     */
    disconnectAll() {
        this.activeConnections.forEach((connector) => connector.close());
        this.activeConnections.clear();
        this.log("All connections closed");
    }
    /**
     * Log message with timestamp
     */
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    /**
     * Log separator
     */
    logSeparator() {
        this.outputChannel.appendLine(`\n${"=".repeat(60)}`);
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=connectionManager.js.map