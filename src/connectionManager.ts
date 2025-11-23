import * as vscode from "vscode";
import { IrisConnector } from "./iris/irisConnector";
import { Connection } from "./connectionsProvider";

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

    this.log(`Connecting to: ${connection.name}`);
    this.log(`  Host: ${connection.endpoint}`);
    this.log(`  Port: ${connection.port}`);
    this.log(`  Namespace: ${connection.namespace}`);
    this.log(`  User: ${connection.user}`);

    try {
      const connector = new IrisConnector();

      this.log(`Attempting to connect...`);
      const config = {
        host: connection.endpoint,
        port: connection.port,
        ns: connection.namespace,
        user: connection.user,
        pwd: connection.password,
      };
      this.log(`Config: ${JSON.stringify({ ...config, pwd: "***" })}`);

      await connector.connect(config);
      this.log(`✓ Connection established successfully`);

      this.log(`Testing connection...`);
      const testResult = await connector.test();
      this.log(`Test result: ${testResult}`);

      if (testResult) {
        this.activeConnections.set(connection.id, connector);
        this.log(`✅ Successfully connected!`);
        return true;
      } else {
        connector.close();
        this.log(`❌ Connection test failed`);
        return false;
      }
    } catch (error: any) {
      this.log(`❌ Error: ${error.message || "Unknown error"}`);
      this.log(`Stack trace: ${error.stack || "No stack trace"}`);
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
      this.log(`Disconnected from connection ID: ${connectionId}`);
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
