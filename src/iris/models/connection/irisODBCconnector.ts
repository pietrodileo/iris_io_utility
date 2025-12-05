import * as vscode from "vscode";
import type { IrisConnectionConfig } from "./irisConnectionConfig";

const odbc = require("odbc");

export class IrisOdbcConnector {
  private connection: any;
  private output: vscode.OutputChannel;

  constructor(
    private config: IrisConnectionConfig,
    outputChannel: vscode.OutputChannel
  ) {
    this.output = outputChannel;
  }

  async connect(): Promise<void> {
    try {
      await this.ensureDriverInstalled();

      const connectionString = `DSN=${this.config.odbcDsn};UID=${this.config.user};PWD=${this.config.pwd}`;

      this.output.appendLine(
        "[ODBC] Connecting with DSN: " + this.config.odbcDsn
      );
      this.connection = await odbc.connect(connectionString);
      this.output.appendLine("[ODBC] Connected successfully");
    } catch (err: any) {
      vscode.window.showErrorMessage(`ODBC connection failed: ${err.message}`);
      throw err;
    }
  }

  async ensureDriverInstalled(): Promise<void> {
    const drivers = await odbc.drivers();
    const irisDriver = drivers.find((d: string) =>
      d.includes("InterSystems ODBC")
    );

    if (!irisDriver) {
      const answer = await vscode.window.showWarningMessage(
        "InterSystems ODBC driver not found. Would you like to download and install it?",
        "Download",
        "Cancel"
      );

      if (answer === "Download") {
        vscode.commands.executeCommand("irisIO.installOdbcDrivers");
      } else {
        throw new Error("ODBC driver not installed.");
      }
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.close();
      this.output.appendLine("[ODBC] Connection closed.");
    }
  }

  async query(sql: string, params: any[] = []) {
    if (!this.connection) {throw new Error("Not connected.");}
    return this.connection.query(sql, params);
  }

  async execute(sql: string, params: any[] = []) {
    if (!this.connection) {throw new Error("Not connected.");}
    return this.connection.query(sql, params);
  }
}
