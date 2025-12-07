"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewManager = void 0;
const exportWebView_1 = require("./exportWebView");
const importWebView_1 = require("./importWebView");
/* Manages webview panels for different connections and modes */
class WebviewManager {
    context;
    panels = new Map();
    connectionManager;
    outputChannel;
    constructor(context, connectionManager, outputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.connectionManager = connectionManager;
    }
    /**
     * Show a webview for a connection and mode
     */
    show(connection, mode) {
        const key = `iris-${mode}-${connection.id}`;
        this.log(`[WebviewManager] Showing webview with mode '${mode}' for connection item: ${key}`);
        // Get existing panel if it exists
        let webview = this.panels.get(key);
        // If the panel exists but its internal WebviewPanel is disposed, remove it
        if (webview?.isDisposed?.()) {
            this.panels.delete(key);
            webview = undefined;
        }
        // If no existing panel, create a new one
        if (!webview) {
            webview =
                mode === "import"
                    ? new importWebView_1.ImportWebview(this.context, connection, this.connectionManager, this.outputChannel)
                    : new exportWebView_1.ExportWebview(this.context, connection, this.connectionManager, this.outputChannel);
            this.panels.set(key, webview);
            // Remove from map on dispose
            webview.onDidDispose(() => {
                this.panels.delete(key);
            });
        }
        // Show the panel (reveal if already exists)
        webview.show();
    }
    /**
     * Close all panels (optional helper)
     */
    disposeAll() {
        for (const webview of this.panels.values()) {
            webview.dispose();
        }
        this.panels.clear();
    }
    /**
     * Log message with timestamp
     */
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.WebviewManager = WebviewManager;
//# sourceMappingURL=webViewManager.js.map