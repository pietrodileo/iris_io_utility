import * as vscode from "vscode";

export class SettingsManager {
  private static readonly CONNECTION_TYPE_KEY = "irisIO.defaultConnectionType";
  private static readonly ODBC_DRIVER_KEY = "irisIO.odbcDriver";

  static getDefaultConnectionType(context: vscode.ExtensionContext): "native" | "odbc" {
    return "odbc"; // Force ODBC as default
    // return context.workspaceState.get<"native" | "odbc">(this.CONNECTION_TYPE_KEY,"native");
  }

  static getOdbcDriver(context: vscode.ExtensionContext): string {
    return context.workspaceState.get<string>(this.ODBC_DRIVER_KEY,"");
  }
}
