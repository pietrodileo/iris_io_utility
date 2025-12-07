"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoritesProvider = void 0;
const baseProvider_1 = require("../models/baseProvider");
const baseConnectionItem_1 = require("../models/baseConnectionItem");
/**
 * Tree item for favorite connections
 */
class FavoriteItem extends baseConnectionItem_1.BaseConnectionItem {
    constructor(connection) {
        const status = connection.status || "idle";
        super(connection, status);
    }
}
/**
 * Provides tree view for favorite connections
 */
class FavoritesProvider extends baseProvider_1.BaseProvider {
    connectionsProvider;
    constructor(connectionsProvider) {
        super();
        this.connectionsProvider = connectionsProvider;
        // Listen to changes in the connections provider
        connectionsProvider.onDidChangeTreeData(() => {
            this.refresh();
        });
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        const favoriteConnections = this.connectionsProvider.getFavoriteConnections();
        if (favoriteConnections.length === 0) {
            return Promise.resolve([]);
        }
        return Promise.resolve(favoriteConnections.map((conn) => new FavoriteItem(conn)));
    }
}
exports.FavoritesProvider = FavoritesProvider;
//# sourceMappingURL=favoritesProvider.js.map