import * as vscode from "vscode";
import { Connection } from "../models/baseConnection";
import { BaseProvider } from "../models/baseProvider";
import { BaseConnectionItem } from "../models/baseConnectionItem";

/**
 * Tree item for regular connections
 */
class ConnectionItem extends BaseConnectionItem {
  constructor(connection: Connection, isFavorite: boolean) {
    const status = connection.status || "idle";
    // context value is checked from package.json when clauses are evaluated
    const contextValue = isFavorite ? `${status}|favorite` : status; 
    super(connection, contextValue);
  }

}

/**
 * Provides tree view for all connections
 */
export class ConnectionsProvider extends BaseProvider<ConnectionItem> {
  private connections: Connection[] = [];
  private readonly STORAGE_KEY = "irisIO.connections";
  private favorites: Set<string> = new Set();
  private readonly FAVORITES_KEY = "irisIO.favorites";

  constructor(private context: vscode.ExtensionContext) {
    super();
    this.loadConnections();
    this.loadFavorites();
  }

  getChildren(element?: ConnectionItem): Thenable<ConnectionItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (this.connections.length === 0) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.connections.map((conn) => this.createConnectionItem(conn))
    );
  }

  /**
   * Create a ConnectionItem with proper configuration
   */
  private createConnectionItem(conn: Connection): ConnectionItem {
    const isFavorite = this.favorites.has(conn.id);
    return new ConnectionItem(conn, isFavorite);
  }

  // ==================== Connection Management ====================

  addConnection(connection: Connection): void {
    this.connections.push(connection);
    this.saveConnections();
  }

  updateConnection(updatedConnection: Connection): void {
    const index = this.connections.findIndex(
      (c) => c.id === updatedConnection.id
    );
    if (index !== -1) {
      this.connections[index] = { ...updatedConnection };
      this.saveConnections();
    }
  }

  deleteConnection(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    this.favorites.delete(id);
    this.saveConnections();
    this.saveFavorites();
  }

  getConnection(id: string): Connection | undefined {
    return this.connections.find((c) => c.id === id);
  }

  getAllConnections(): Connection[] {
    return [...this.connections];
  }

  // ==================== Favorites Management ====================

  isFavorite(id: string): boolean {
    return this.favorites.has(id);
  }

  addFavorite(id: string): void {
    this.favorites.add(id);
    this.saveFavorites();
  }

  removeFavorite(id: string): void {
    this.favorites.delete(id);
    this.saveFavorites();
  }

  toggleFavorite(id: string): void {
    if (this.isFavorite(id)) {
      this.removeFavorite(id);
    } else {
      this.addFavorite(id);
    }
  }

  getFavoriteConnections(): Connection[] {
    return this.connections.filter((conn) => this.favorites.has(conn.id));
  }

  getFavoriteIds(): string[] {
    return Array.from(this.favorites);
  }

  // ==================== Persistence ====================

  private loadConnections(): void {
    const stored = this.context.workspaceState.get<Connection[]>(
      this.STORAGE_KEY
    );
    if (stored) {
      this.connections = stored.map((conn) => ({
        ...conn,
        status: "idle",
        errorMessage: undefined,
      }));
    }
  }

  private saveConnections(): void {
    this.context.workspaceState.update(this.STORAGE_KEY, this.connections);
    this.refresh();
  }

  private loadFavorites(): void {
    const stored = this.context.workspaceState.get<string[]>(
      this.FAVORITES_KEY
    );
    if (stored) {
      this.favorites = new Set(stored);
    }
  }

  private saveFavorites(): void {
    this.context.workspaceState.update(
      this.FAVORITES_KEY,
      Array.from(this.favorites)
    );
    this.refresh();
  }
}
