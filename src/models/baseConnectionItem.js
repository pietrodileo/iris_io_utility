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
exports.BaseConnectionItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Base class for connection tree items
 * Handles icon rendering, tooltips, and common tree item properties
 */
class BaseConnectionItem extends vscode.TreeItem {
    connection;
    contextValue;
    constructor(connection, contextValue, collapsibleState = vscode
        .TreeItemCollapsibleState.None) {
        super(connection.name, collapsibleState);
        this.connection = connection;
        this.contextValue = contextValue;
        // Give a description upon super server and web server
        let port = connection.superServerPort;
        this.description = `${connection.endpoint}:${port}/${connection.namespace}`;
        this.iconPath = this.getIconForStatus(connection.status);
        this.tooltip = this.buildTooltip(connection);
        // // Add command for connected items
        // if (connection.status === "connected") {
        //   this.command = {
        //     command: "irisIO.openConnection",
        //     title: "Open Connection",
        //     arguments: [connection],
        //   };
        // }
    }
    /**
     * Get icon based on connection status
     */
    getIconForStatus(status) {
        switch (status) {
            case "connected":
                return new vscode.ThemeIcon("pass", new vscode.ThemeColor("charts.green"));
            case "connecting":
                return new vscode.ThemeIcon("sync");
            case "error":
                return new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"));
            default:
                return new vscode.ThemeIcon("database");
        }
    }
    /**
     * Build tooltip with connection details
     * Can be overridden by subclasses to customize
     */
    buildTooltip(conn) {
        const tooltip = new vscode.MarkdownString();
        // Add title with optional decoration
        let port = conn.superServerPort;
        if (conn.isOdbc) {
            tooltip.appendMarkdown(`**ODBC Connection**\n\n`);
        }
        else {
            tooltip.appendMarkdown(`**Native Connection**\n\n`);
        }
        tooltip.appendMarkdown(`**Endpoint:** ${conn.endpoint}:${port}\n\n`);
        tooltip.appendMarkdown(`**Host** ${conn.endpoint}\n\n`);
        tooltip.appendMarkdown(`**Super Server Port** ${conn.superServerPort}\n\n`);
        tooltip.appendMarkdown(`**Web Server Port** ${conn.webServerPort}\n\n`);
        if (conn.namespace) {
            tooltip.appendMarkdown(`**Namespace:** ${conn.namespace}\n\n`);
        }
        if (conn.user) {
            tooltip.appendMarkdown(`**User:** ${conn.user}\n\n`);
        }
        if (conn.description) {
            tooltip.appendMarkdown(`**Description:** ${conn.description}\n\n`);
        }
        tooltip.appendMarkdown(`**Status:** ${conn.status || "idle"}`);
        if (conn.status === "error" && conn.errorMessage) {
            tooltip.appendMarkdown(`\n\n**Error:** ${conn.errorMessage}`);
        }
        tooltip.isTrusted = false;
        tooltip.supportHtml = false;
        return tooltip;
    }
}
exports.BaseConnectionItem = BaseConnectionItem;
//# sourceMappingURL=baseConnectionItem.js.map