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
exports.IrisOdbcConnector = void 0;
const vscode = __importStar(require("vscode"));
const odbc = require("odbc");
class IrisOdbcConnector {
    config;
    connection;
    output;
    constructor(config, outputChannel) {
        this.config = config;
        this.output = outputChannel;
    }
    async connect() {
        try {
            await this.ensureDriverInstalled();
            const connectionString = `DSN=${this.config.odbcDsn};UID=${this.config.user};PWD=${this.config.pwd}`;
            this.output.appendLine("[ODBC] Connecting with DSN: " + this.config.odbcDsn);
            this.connection = await odbc.connect(connectionString);
            this.output.appendLine("[ODBC] Connected successfully");
        }
        catch (err) {
            vscode.window.showErrorMessage(`ODBC connection failed: ${err.message}`);
            throw err;
        }
    }
    async ensureDriverInstalled() {
        const drivers = await odbc.drivers();
        const irisDriver = drivers.find((d) => d.includes("InterSystems ODBC"));
        if (!irisDriver) {
            const answer = await vscode.window.showWarningMessage("InterSystems ODBC driver not found. Would you like to download and install it?", "Download", "Cancel");
            if (answer === "Download") {
                vscode.commands.executeCommand("irisIO.installOdbcDrivers");
            }
            else {
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
    async query(sql, params = []) {
        if (!this.connection) {
            throw new Error("Not connected.");
        }
        return this.connection.query(sql, params);
    }
    async execute(sql, params = []) {
        if (!this.connection) {
            throw new Error("Not connected.");
        }
        return this.connection.query(sql, params);
    }
}
exports.IrisOdbcConnector = IrisOdbcConnector;
//# sourceMappingURL=irisODBCconnector.js.map