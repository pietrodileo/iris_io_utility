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
  // WINDOWS (Updated)
  // ----------------------------------------------------------
  private async checkOdbcWindows(): Promise<boolean> {
    return new Promise((resolve) => {
      // Query the specific registry key where driver names are listed
      exec(
        `reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers"`,
        (err, stdout) => {
          if (err || !stdout) {
            this.log(
              "[OdbcDriverChecker] Could not query ODBC drivers from registry."
            );
            resolve(false);
            return;
          }

          this.log("[OdbcDriverChecker] Found installed ODBC drivers:");
          const lines = stdout.split("\n");
          const driverNames: string[] = [];

          // Parse the output to find driver names
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("HKEY_")) {
              const regSzIndex = trimmedLine.indexOf("REG_SZ");
              if (regSzIndex > 0) {
                const driverName = trimmedLine.substring(0, regSzIndex).trim();
                driverNames.push(driverName);
                // Log each found driver
                // this.log(`  - ${driverName}`);
              }
            }
          }

          if (driverNames.length === 0) {
            this.log(
              "[OdbcDriverChecker] No ODBC drivers found in the registry."
            );
          }

          // Perform the original check to see if an InterSystems driver exists
          const found = driverNames.some(
            (name) =>
              name.toLowerCase().includes("intersystems") ||
              name.toLowerCase().includes("iris")
          );

          resolve(found);
        }
      );
    });
  }

  // ----------------------------------------------------------
  // macOS (Updated)
  // ----------------------------------------------------------
  private async checkOdbcMac(): Promise<boolean> {
    const dir = "/Library/ODBC";
    if (!fs.existsSync(dir)) {
      this.log(`[OdbcDriverChecker] ODBC directory not found: ${dir}`);
      return false;
    }

    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      this.log(`[OdbcDriverChecker] No files found in ODBC directory: ${dir}`);
      return false;
    }

    this.log(`[OdbcDriverChecker] Found files/folders in ${dir}:`);
    files.forEach((f) => this.log(`  - ${f}`));

    const found = files.some((f) => f.toLowerCase().includes("intersystems"));
    return found;
  }

  // ----------------------------------------------------------
  // Linux (Updated)
  // ----------------------------------------------------------
  private async checkOdbcLinux(): Promise<boolean> {
    const file = "/etc/odbcinst.ini";
    if (!fs.existsSync(file)) {
      this.log(`[OdbcDriverChecker] ODBC config file not found: ${file}`);
      return false;
    }

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    const driverNames: string[] = [];

    this.log(`[OdbcDriverChecker] Parsing drivers from ${file}:`);
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Driver names are in sections like [Driver Name]
      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        const driverName = trimmedLine
          .substring(1, trimmedLine.length - 1)
          .trim();
        driverNames.push(driverName);
        this.log(`  - ${driverName}`);
      }
    }

    if (driverNames.length === 0) {
      this.log(`[OdbcDriverChecker] No ODBC drivers found in ${file}.`);
    }

    const found = driverNames.some(
      (name) =>
        name.toLowerCase().includes("intersystems") ||
        name.toLowerCase().includes("iris odbc")
    );

    return found;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  public async listInstalledDrivers(): Promise<string[]> {
    const platform = os.platform();

    try {
      if (platform === "win32") {
        return await this.listDriversWindows();
      }
      if (platform === "darwin") {
        return await this.listDriversMac();
      }
      if (platform === "linux") {
        return await this.listDriversLinux();
      }

      this.log(`[OdbcDriverChecker] Unsupported platform for driver listing.`);
      return [];
    } catch (e: any) {
      this.log(`[OdbcDriverChecker] Error listing drivers: ${e.message}`);
      return [];
    }
  }

  private async listDriversWindows(): Promise<string[]> {
    return new Promise((resolve) => {
      exec(
        `reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers"`,
        (err, stdout) => {
          if (err || !stdout) {
            this.log("[OdbcDriverChecker] Could not query driver registry.");
            resolve([]);
            return;
          }

          const drivers: string[] = [];
          const lines = stdout.split("\n");

          for (const line of lines) {
            const trimmedLine = line.trim();
            const idx = trimmedLine.indexOf("REG_SZ");

            if (idx > 0) {
              const name = trimmedLine.substring(0, idx).trim();
              if (name.length > 0) {drivers.push(name);}
            }
          }

          this.log(`[OdbcDriverChecker] Drivers detected on Windows:`);
          drivers.forEach((d) => this.log(`  - ${d}`));

          resolve(drivers);
        }
      );
    });
  }

  private async listDriversMac(): Promise<string[]> {
    const dir = "/Library/ODBC";

    if (!fs.existsSync(dir)) {
      this.log(`[OdbcDriverChecker] No ODBC directory found at ${dir}`);
      return [];
    }

    const files = fs.readdirSync(dir);
    const drivers = files.filter((f) => f.endsWith(".ini"));

    this.log(`[OdbcDriverChecker] Drivers detected on macOS:`);
    drivers.forEach((d) => this.log(`  - ${d}`));

    return drivers;
  }

  private async listDriversLinux(): Promise<string[]> {
    const file = "/etc/odbcinst.ini";

    if (!fs.existsSync(file)) {
      this.log(`[OdbcDriverChecker] ${file} does not exist.`);
      return [];
    }

    const contents = fs.readFileSync(file, "utf8");
    const drivers: string[] = [];

    for (const line of contents.split("\n")) {
      const trimmed = line.trim();

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const name = trimmed.substring(1, trimmed.length - 1).trim();
        if (name) {drivers.push(name);}
      }
    }

    this.log(`[OdbcDriverChecker] Drivers detected on Linux:`);
    drivers.forEach((d) => this.log(`  - ${d}`));

    return drivers;
  }
}
