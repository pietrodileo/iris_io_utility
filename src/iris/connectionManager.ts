import * as vscode from "vscode";
import { IrisConnector } from "./irisConnector";
import { IrisConnectionConfig } from "./models/connection/irisConnectionConfig";
import { Connection } from "../models/baseConnection";
import type { ConnectionType } from "./models/connection/irisConnectionConfig";
import { OdbcDriverChecker } from "../iris/models/connection/odbcDriverChecker";

/**
 * Manages active IRIS connections
 */
export class ConnectionManager {
  private activeConnections = new Map<string, IrisConnector>();
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Check if a connection is active
   */
  isConnected(connectionId: string): boolean {
    return this.activeConnections.has(connectionId);
  }

  /**
   * Get an active connector
   */
  getConnector(connectionId: string): IrisConnector | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Connect to IRIS with automatic testing
   */
  async connect(connection: Connection): Promise<boolean> {
    // Check if already connected
    if (this.isConnected(connection.id)) {
      vscode.window.showInformationMessage(
        `Already connected to "${connection.name}"`
      );
      return false;
    }

    this.log(`[ConnectionManager] Connecting to: ${connection.name}`);
    this.log(`[ConnectionManager]   Host: ${connection.endpoint}`);
    this.log(
      `[ConnectionManager]   Superserver Port: ${connection.superServerPort}`
    );
    this.log(
      `[ConnectionManager]   Web Server Port: ${connection.webServerPort}`
    );
    this.log(`[ConnectionManager]   Namespace: ${connection.namespace}`);
    this.log(`[ConnectionManager]   User: ${connection.user}`);

    try {
      this.log(`[ConnectionManager] Testing if ODBC drivers are available...`);
      // --- Perform ODBC check ---
      const driverChecker = new OdbcDriverChecker(this.outputChannel);
      const odbcAvailable = await driverChecker.checkOdbcDrivers();
      let connectionType: ConnectionType = "native"; // default to native
      if (odbcAvailable) {
        this.log(`[ConnectionManager] ODBC drivers available`);
        connectionType = "odbc";
      } else {
        this.log(
          `[ConnectionManager] ODBC drivers not available. Proceeding with native connection...`
        );
      }

      // if connection type is ODBC, try to connect. If the attempt fails, use native connection
      let connector: IrisConnector | undefined;
      try {
        this.log(`[ConnectionManager] Attempting to connect...`);
        connector = await this.tryConnectionWithRetry(connection, connectionType);
      } catch (error: any) {
        if (connectionType === "odbc") {
          this.log(`[ConnectionManager] ODBC connection failed: ${error.message}. Trying native connection...`);
          connectionType = "native";
          connector = await this.tryConnectionWithRetry(connection, "native");
        } else {
        throw error; 
        }
      }
      
      if (!connector) {
        this.log(`[ConnectionManager] Connection failed`);
        throw new Error("Connection failed");
      }

      // Set connection type
      if (connectionType === "odbc") {
        connection.isOdbc = true;
      }
      this.activeConnections.set(connection.id, connector);
      this.log(`[ConnectionManager] Successfully connected!`);
      return true;

    } catch (error: any) {
      this.log(
        `[ConnectionManager] Error: ${error.message || "Unknown error"}`
      );
      this.log(
        `[ConnectionManager] Stack trace: ${error.stack || "No stack trace"}`
      );
      throw error;
    }
  }

  /* 
    This method tries to connect to IRIS with the specified connection type (odbc or native).
    If odbc is selected, it will try to connect with odbc first, and if that fails, it will try to connect with native.
  */
  private async tryConnectionWithRetry(
    connection: Connection,
    connectionType: ConnectionType
  ): Promise<IrisConnector> {
    try {
      const config: IrisConnectionConfig = {
        host: connection.endpoint,
        superServerPort: connection.superServerPort,
        webServerPort: connection.webServerPort,
        ns: connection.namespace,
        user: connection.user,
        pwd: connection.password,
        connectionType: connectionType,
      };
      this.log(`[ConnectionManager] Config: ${JSON.stringify({...config,pwd: "***",})}`);
      // if connection type is ODBC, try to connect. If the attempt fails, use native connection
      const connector = new IrisConnector(config, this.outputChannel);
      this.log(`[ConnectionManager] Attempting to connect with connection type: ${connectionType}...`);
      await connector.connect();
      this.log(`[ConnectionManager] Connection established successfully`);    
      return connector;
    } catch (error: any) {
      this.log(`[ConnectionManager] ${connectionType.toUpperCase()} connection failed: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from IRIS
   */
  disconnect(connectionId: string): void {
    const connector = this.activeConnections.get(connectionId);
    if (connector) {
      connector.close();
      this.activeConnections.delete(connectionId);
      this.log(
        `[ConnectionManager] Disconnected from connection ID: ${connectionId}`
      );
    }
  }

  /**
   * Close all connections
   */
  disconnectAll(): void {
    this.activeConnections.forEach((connector) => connector.close());
    this.activeConnections.clear();
    this.log("All connections closed");
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Log separator
   */
  logSeparator(): void {
    this.outputChannel.appendLine(`\n${"=".repeat(60)}`);
  }
}
