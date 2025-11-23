const irisnative = require("@intersystems/intersystems-iris-native");
import type { IrisConnectionConfig } from "./models/irisConnectionConfig";

/* Class to manage connection to InterSystems IRIS */
export class IrisConnector {
  private connection: any;
  private iris: any;

  async connect(config: IrisConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(
          "[IrisConnector] Creating connection with config:",
          JSON.stringify({ ...config, pwd: "***" })
        );
        this.connection = irisnative.createConnection(config);
        console.log("[IrisConnector] Connection created successfully");

        console.log("[IrisConnector] Creating IRIS instance...");
        this.iris = this.connection.createIris();
        console.log("[IrisConnector] IRIS instance created successfully");

        resolve();
      } catch (err: any) {
        console.error("[IrisConnector] Connection failed:", err.message);
        console.error("[IrisConnector] Error details:", err);
        reject(err);
      }
    });
  }

  isConnected(): boolean {
    const connected = this.iris !== null && this.iris !== undefined;
    console.log("[IrisConnector] isConnected:", connected);
    return connected;
  }

  async test(): Promise<boolean> {
    try {
      console.log("[IrisConnector] Starting connection test...");
      if (!this.isConnected()) {
        console.log("[IrisConnector] Not connected, test failed");
        return false;
      }
      return true;
    } catch (error: any) {
      console.error("[IrisConnector] Test failed with error:", error.message);
      console.error("[IrisConnector] Error details:", error);
      return false;
    }
  }

  getIris() {
    return this.iris;
  }

  close(): void {
    console.log("[IrisConnector] Closing connection...");
    if (this.connection) {
      try {
        this.connection.close();
        console.log("[IrisConnector] Connection closed successfully");
      } catch (error: any) {
        console.error(
          "[IrisConnector] Error closing connection:",
          error.message
        );
      }
      this.connection = null;
      this.iris = null;
    }
  }
}
