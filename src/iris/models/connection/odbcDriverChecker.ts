import * as os from "os";
import * as fs from "fs";
import * as vscode from "vscode";
import { exec } from "child_process";

export class OdbcDriverChecker {
  constructor(private outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }
  public async checkOdbcDrivers(): Promise<boolean> {
    this.log(`[OdbcDriverChecker] Checking ODBC drivers...`);
    const platform = os.platform();
    this.log(`[OdbcDriverChecker] Platform: ${platform}`);
    try {
      if (platform === "win32") {
        return await this.checkOdbcWindows();
      }
      if (platform === "darwin") {
        return await this.checkOdbcMac();
      }
      if (platform === "linux") {
        return await this.checkOdbcLinux();
      }

      vscode.window.showWarningMessage(
        "Unsupported platform for ODBC driver detection"
      );
      return false;
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Error checking ODBC drivers: ${err?.message || err}`
      );
      return false;
    }
  }

  // ----------------------------------------------------------
  // WINDOWS
  // ----------------------------------------------------------
  private async checkOdbcWindows(): Promise<boolean> {
    return new Promise((resolve) => {
      exec(
        `reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI" /s`,
        (err, stdout) => {
          if (err || !stdout) {
            resolve(false);
            return;
          }
          const found =
            stdout.toLowerCase().includes("intersystems") ||
            stdout.toLowerCase().includes("iris");

          resolve(found);
        }
      );
    });
  }

  // ----------------------------------------------------------
  // macOS
  // ----------------------------------------------------------
  private async checkOdbcMac(): Promise<boolean> {
    const dir = "/Library/ODBC";
    if (!fs.existsSync(dir)) {return false;}

    const files = fs.readdirSync(dir);
    return files.some((f) => f.toLowerCase().includes("intersystems"));
  }

  // ----------------------------------------------------------
  // Linux
  // ----------------------------------------------------------
  private async checkOdbcLinux(): Promise<boolean> {
    const file = "/etc/odbcinst.ini";
    if (!fs.existsSync(file)) {return false;}

    const content = fs.readFileSync(file, "utf8").toLowerCase();
    return content.includes("intersystems") || content.includes("iris odbc");
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
