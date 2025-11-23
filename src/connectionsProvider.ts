import * as vscode from "vscode";

export interface Connection {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  namespace: string;
  user: string;
  password: string;
  description?: string;
  status?: "idle" | "connecting" | "connected" | "error";
  errorMessage?: string;
}

export class ConnectionsProvider implements vscode.TreeDataProvider<ConnectionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ConnectionItem | undefined | null | void
  > = new vscode.EventEmitter<ConnectionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ConnectionItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private connections: Connection[] = [];
  private readonly STORAGE_KEY = "irisIO.connections";

  constructor(private context: vscode.ExtensionContext) {
    this.loadConnections();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConnectionItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.connection?.name || element.label,
      vscode.TreeItemCollapsibleState.None
    );

    if (element.connection) {
      const conn = element.connection;

      item.description = `${conn.endpoint}:${conn.port}`;

      // assign contextValue dynamically
      item.contextValue = conn.status ?? "idle";

      switch (conn.status) {
        case "connected":
          item.iconPath = new vscode.ThemeIcon(
            "database",
            new vscode.ThemeColor("charts.green")
          );
          break;
        case "connecting":
          item.iconPath = new vscode.ThemeIcon("loading");
          break;
        case "error":
          item.iconPath = new vscode.ThemeIcon(
            "error",
            new vscode.ThemeColor("charts.red")
          );
          break;
        default:
          item.iconPath = new vscode.ThemeIcon("database");
          break;
      }

      // Set tooltip to show detailed info about the connection when hovering
      item.tooltip = new vscode.MarkdownString(
        `**Connection Name: ${conn.name}**\n\n` +
          `**Endpoint:** ${conn.endpoint}:${conn.port}\n\n` +
          (conn.namespace ? `**Namespace:** ${conn.namespace}\n\n` : "") +
          (conn.user ? `**User:** ${conn.user}\n\n` : "") +
          (conn.description
            ? `**Description:** ${conn.description}\n\n`
            : "") +
          `**Status:** ${conn.status ?? "idle"}`
      );

      // Enable markdown formatting
      item.tooltip.supportHtml = false;
      item.tooltip.isTrusted = false;

    }

    return item;
  }

  getChildren(element?: ConnectionItem): Thenable<ConnectionItem[]> {
    if (element) {
      // Individual connections have no children
      return Promise.resolve([]);
    } else {
      // Root level - return all connections directly
      if (this.connections.length === 0) {
        // Return empty array to trigger the welcome view
        return Promise.resolve([]);
      }

      return Promise.resolve(
        this.connections.map(
          (conn) =>
            new ConnectionItem(
              conn.name,
              `${conn.endpoint}:${conn.port}`,
              vscode.TreeItemCollapsibleState.None,
              conn.status ?? "idle", // ✅ contextValue now matches status
              conn
            )
        )
      );
    }
  }

  // Load connections from workspace state
  private loadConnections(): void {
    const stored = this.context.workspaceState.get<Connection[]>(
      this.STORAGE_KEY
    );
    if (stored) {
      // Reset all connections to 'idle' status when loading
      this.connections = stored.map((conn) => ({
        ...conn,
        status: "idle",
        errorMessage: undefined,
      }));
    }
  }

  // Save connections to workspace state
  private saveConnections(): void {
    this.context.workspaceState.update(this.STORAGE_KEY, this.connections);
    this.refresh();
  }

  // Add a new connection
  addConnection(connection: Connection): void {
    this.connections.push(connection);
    this.saveConnections();
  }

  // Update an existing connection
  updateConnection(updatedConnection: Connection): void {
    const index = this.connections.findIndex(
      (c) => c.id === updatedConnection.id
    );
    if (index !== -1) {
      // Create a new object to ensure proper change detection
      this.connections[index] = { ...updatedConnection };
      this.saveConnections();
    }
  }

  // Delete a connection
  deleteConnection(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    this.saveConnections();
  }
}

class ConnectionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly connection?: Connection
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}
