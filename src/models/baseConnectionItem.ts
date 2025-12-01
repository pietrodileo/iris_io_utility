import * as vscode from "vscode";
import { Connection } from "./baseConnection";

/**
 * Base class for connection tree items
 * Handles icon rendering, tooltips, and common tree item properties
 */
export abstract class BaseConnectionItem extends vscode.TreeItem {
  constructor(
    public readonly connection: Connection,
    public readonly contextValue: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None
  ) {
    super(connection.name, collapsibleState);

    // Give a description upon super server and web server
    let port = connection.webServerPort;
    if (connection.isOdbc) {
      port = connection.superServerPort;
    }
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
  protected getIconForStatus(status?: string): vscode.ThemeIcon {
    switch (status) {
      case "connected":
        return new vscode.ThemeIcon(
          "pass",
          new vscode.ThemeColor("charts.green")
        );
      case "connecting":
        return new vscode.ThemeIcon("sync");
      case "error":
        return new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red")
        );
      default:
        return new vscode.ThemeIcon("database");
    }
  }

  /**
   * Build tooltip with connection details
   * Can be overridden by subclasses to customize
   */
  protected buildTooltip(conn: Connection): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();

    // Add title with optional decoration
    let port = conn.webServerPort;
    if (conn.isOdbc) {
      tooltip.appendMarkdown(`**ODBC Connection**\n\n`);
      port = conn.superServerPort;
    } else {
      tooltip.appendMarkdown(`**Native Connection**\n\n`);
    }
    tooltip.appendMarkdown(`**Endpoint:** ${conn.endpoint}:${port}\n\n`);

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
