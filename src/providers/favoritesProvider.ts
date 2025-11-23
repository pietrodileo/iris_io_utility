import * as vscode from "vscode";
import { Connection } from "../models/baseConnection";
import { ConnectionsProvider } from "./connectionsProvider";
import { BaseProvider } from "../models/baseProvider";
import { BaseConnectionItem } from "../models/baseConnectionItem";

/**
 * Tree item for favorite connections
 */
class FavoriteItem extends BaseConnectionItem {
  constructor(connection: Connection) {
    const status = connection.status || "idle";
    super(connection, status);
  }
}

/**
 * Provides tree view for favorite connections
 */
export class FavoritesProvider extends BaseProvider<FavoriteItem> {
  constructor(private connectionsProvider: ConnectionsProvider) {
    super();

    // Listen to changes in the connections provider
    connectionsProvider.onDidChangeTreeData(() => {
      this.refresh();
    });
  }

  getChildren(element?: FavoriteItem): Thenable<FavoriteItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const favoriteConnections =
      this.connectionsProvider.getFavoriteConnections();

    if (favoriteConnections.length === 0) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      favoriteConnections.map((conn) => new FavoriteItem(conn))
    );
  }
}
