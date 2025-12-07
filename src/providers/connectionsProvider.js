"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionsProvider = void 0;
const baseProvider_1 = require("../models/baseProvider");
const baseConnectionItem_1 = require("../models/baseConnectionItem");
/**
 * Tree item for regular connections
 */
class ConnectionItem extends baseConnectionItem_1.BaseConnectionItem {
    constructor(connection, isFavorite) {
        const status = connection.status || "idle";
        // context value is checked from package.json when clauses are evaluated
        const contextValue = isFavorite ? `${status}|favorite` : status;
        super(connection, contextValue);
    }
}
/**
 * Provides tree view for all connections
 */
class ConnectionsProvider extends baseProvider_1.BaseProvider {
    context;
    connections = [];
    STORAGE_KEY = "irisIO.connections";
    favorites = new Set();
    FAVORITES_KEY = "irisIO.favorites";
    constructor(context) {
        super();
        this.context = context;
        this.loadConnections();
        this.loadFavorites();
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        if (this.connections.length === 0) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.connections.map((conn) => this.createConnectionItem(conn)));
    }
    /**
     * Create a ConnectionItem with proper configuration
     */
    createConnectionItem(conn) {
        const isFavorite = this.favorites.has(conn.id);
        return new ConnectionItem(conn, isFavorite);
    }
    // ==================== Connection Management ====================
    addConnection(connection) {
        this.connections.push(connection);
        this.saveConnections();
    }
    updateConnection(updatedConnection) {
        const index = this.connections.findIndex((c) => c.id === updatedConnection.id);
        if (index !== -1) {
            this.connections[index] = { ...updatedConnection };
            this.saveConnections();
        }
    }
    deleteConnection(id) {
        this.connections = this.connections.filter((c) => c.id !== id);
        this.favorites.delete(id);
        this.saveConnections();
        this.saveFavorites();
    }
    getConnection(id) {
        return this.connections.find((c) => c.id === id);
    }
    getAllConnections() {
        return [...this.connections];
    }
    // ==================== Favorites Management ====================
    isFavorite(id) {
        return this.favorites.has(id);
    }
    addFavorite(id) {
        this.favorites.add(id);
        this.saveFavorites();
    }
    removeFavorite(id) {
        this.favorites.delete(id);
        this.saveFavorites();
    }
    toggleFavorite(id) {
        if (this.isFavorite(id)) {
            this.removeFavorite(id);
        }
        else {
            this.addFavorite(id);
        }
    }
    getFavoriteConnections() {
        return this.connections.filter((conn) => this.favorites.has(conn.id));
    }
    getFavoriteIds() {
        return Array.from(this.favorites);
    }
    // ==================== Persistence ====================
    loadConnections() {
        const stored = this.context.workspaceState.get(this.STORAGE_KEY);
        if (stored) {
            this.connections = stored.map((conn) => ({
                ...conn,
                status: "idle",
                errorMessage: undefined,
            }));
        }
    }
    saveConnections() {
        this.context.workspaceState.update(this.STORAGE_KEY, this.connections);
        this.refresh();
    }
    loadFavorites() {
        const stored = this.context.workspaceState.get(this.FAVORITES_KEY);
        if (stored) {
            this.favorites = new Set(stored);
        }
    }
    saveFavorites() {
        this.context.workspaceState.update(this.FAVORITES_KEY, Array.from(this.favorites));
        this.refresh();
    }
}
exports.ConnectionsProvider = ConnectionsProvider;
//# sourceMappingURL=connectionsProvider.js.map