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
exports.OdbcDriverChecker = void 0;
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
class OdbcDriverChecker {
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel = outputChannel;
    }
    async checkOdbcDrivers() {
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
            vscode.window.showWarningMessage("Unsupported platform for ODBC driver detection");
            return false;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error checking ODBC drivers: ${err?.message || err}`);
            return false;
        }
    }
    // ----------------------------------------------------------
    // WINDOWS (Updated)
    // ----------------------------------------------------------
    async checkOdbcWindows() {
        return new Promise((resolve) => {
            // Query the specific registry key where driver names are listed
            (0, child_process_1.exec)(`reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers"`, (err, stdout) => {
                if (err || !stdout) {
                    this.log("[OdbcDriverChecker] Could not query ODBC drivers from registry.");
                    resolve(false);
                    return;
                }
                this.log("[OdbcDriverChecker] Found installed ODBC drivers:");
                const lines = stdout.split("\n");
                const driverNames = [];
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
                    this.log("[OdbcDriverChecker] No ODBC drivers found in the registry.");
                }
                // Perform the original check to see if an InterSystems driver exists
                const found = driverNames.some((name) => name.toLowerCase().includes("intersystems") ||
                    name.toLowerCase().includes("iris"));
                resolve(found);
            });
        });
    }
    // ----------------------------------------------------------
    // macOS (Updated)
    // ----------------------------------------------------------
    async checkOdbcMac() {
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
    async checkOdbcLinux() {
        const file = "/etc/odbcinst.ini";
        if (!fs.existsSync(file)) {
            this.log(`[OdbcDriverChecker] ODBC config file not found: ${file}`);
            return false;
        }
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        const driverNames = [];
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
        const found = driverNames.some((name) => name.toLowerCase().includes("intersystems") ||
            name.toLowerCase().includes("iris odbc"));
        return found;
    }
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    async listInstalledDrivers() {
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
        }
        catch (e) {
            this.log(`[OdbcDriverChecker] Error listing drivers: ${e.message}`);
            return [];
        }
    }
    async listDriversWindows() {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(`reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers"`, (err, stdout) => {
                if (err || !stdout) {
                    this.log("[OdbcDriverChecker] Could not query driver registry.");
                    resolve([]);
                    return;
                }
                const drivers = [];
                const lines = stdout.split("\n");
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    const idx = trimmedLine.indexOf("REG_SZ");
                    if (idx > 0) {
                        const name = trimmedLine.substring(0, idx).trim();
                        if (name.length > 0) {
                            drivers.push(name);
                        }
                    }
                }
                this.log(`[OdbcDriverChecker] Drivers detected on Windows:`);
                drivers.forEach((d) => this.log(`  - ${d}`));
                resolve(drivers);
            });
        });
    }
    async listDriversMac() {
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
    async listDriversLinux() {
        const file = "/etc/odbcinst.ini";
        if (!fs.existsSync(file)) {
            this.log(`[OdbcDriverChecker] ${file} does not exist.`);
            return [];
        }
        const contents = fs.readFileSync(file, "utf8");
        const drivers = [];
        for (const line of contents.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const name = trimmed.substring(1, trimmed.length - 1).trim();
                if (name) {
                    drivers.push(name);
                }
            }
        }
        this.log(`[OdbcDriverChecker] Drivers detected on Linux:`);
        drivers.forEach((d) => this.log(`  - ${d}`));
        return drivers;
    }
}
exports.OdbcDriverChecker = OdbcDriverChecker;
//# sourceMappingURL=odbcDriverChecker.js.map