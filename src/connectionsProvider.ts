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

export class ConnectionsProvider
  implements vscode.TreeDataProvider<ConnectionItem>
{
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
    return element;
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
              "connection",
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
      this.connections = stored;
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
      this.connections[index] = updatedConnection;
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

    // Set tooltip for connections to show description
    if (contextValue === "connection" && connection) {
      this.tooltip = connection.description
        ? `${connection.name}\n${connection.endpoint}:${connection.port}\n\n${connection.description}`
        : `${connection.name}\n${connection.endpoint}:${connection.port}`;

      // Database icon for connections
      this.iconPath = new vscode.ThemeIcon(getIcon(connection.status));
    }
  }
}
function getIcon(status?: string): string {
  switch (status) {
    case "connecting":
      return "sync~spin"; // spinning
    case "connected":
      return "check";
    case "error":
      return "error";
    default:
      return "database";
  }
}
