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
exports.BaseWebview = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Abstract base class for webview panels
 * Provides common functionality for import/export webviews
 */
class BaseWebview {
    context;
    panel;
    disposables = [];
    _isDisposed = false; // track disposal
    mode;
    outputChannel;
    connection;
    connector;
    constructor(context, connection, connectionManager, mode, outputChannel) {
        this.context = context;
        this.mode = mode;
        this.outputChannel = outputChannel;
        this.connection = connection;
        const existing = connectionManager.getConnector(connection.id);
        if (!existing) {
            throw new Error(`No connector found for connection id: ${connection.id}`);
        }
        this.connector = existing;
    }
    /**
     * Show the webview panel (reveal if exists, create if not or disposed)
     */
    show() {
        // unique panel key per connection+mode
        const key = this.getViewType(this.connection, this.mode);
        // If panel exists and not disposed, just reveal it
        if (this.panel && !this._isDisposed) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        // Otherwise create a new panel
        this.panel = vscode.window.createWebviewPanel(key, this.getTitle(), vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "out"),
            ],
        });
        this._isDisposed = false;
        this.panel.webview.html = this.getHtmlContent();
        this.setupMessageHandlers();
        // Hook disposal to cleanup
        this.panel.onDidDispose(() => {
            this.dispose();
            this._onDidDispose?.();
        }, null, this.disposables);
    }
    /**
     * Get unique view type identifier for a connection and mode
     */
    getViewType(connection, mode) {
        if (!mode) {
            return "";
        }
        return `iris-${mode}-${connection.id}`; // unique viewType per connection+mode
    }
    /**
     * Generate HTML content for the webview
     */
    getHtmlContent() {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <title>${this.getTitle()}</title>
    </head>
    <body>
      ${this.getBodyContent()}
      <script nonce="${nonce}">
        ${this.getScript()}
      </script>
    </body>
    </html>`;
    }
    /**
     * Get JavaScript code for the webview
     */
    getScript() {
        return `
      const vscode = acquireVsCodeApi();
      
      function sendMessage(type, data) {
        vscode.postMessage({ type, data });
      }
      
      function showLoading(show) {
        const loading = document.querySelector('.loading');
        if (loading) {
          loading.classList.toggle('active', show);
        }
      }
      
      function showError(message) {
        const existing = document.querySelector('.error-message');
        if (existing) {
          existing.remove();
        }
        
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        document.querySelector('.container').appendChild(error);
        
        setTimeout(() => error.remove(), 5000);
      }
      
      function showSuccess(message) {
        const existing = document.querySelector('.success-message');
        if (existing) {
          existing.remove();
        }
        
        const success = document.createElement('div');
        success.className = 'success-message';
        success.textContent = message;
        document.querySelector('.container').appendChild(success);
        
        setTimeout(() => success.remove(), 5000);
      }
      
      // Listen for messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        handleMessage(message);
      });
      
      // Subclasses will implement this
      function handleMessage(message) {
        switch (message.type) {
          case 'error':
            showError(message.data);
            showLoading(false);
            break;
          case 'success':
            showSuccess(message.data);
            showLoading(false);
            break;
          case 'loading':
            showLoading(message.data);
            break;
        }
      }
      
      ${this.getCustomScript()}
    `;
    }
    /**
     * Setup message handlers for communication
     */
    setupMessageHandlers() {
        if (!this.panel) {
            return;
        }
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        }, null, this.disposables);
    }
    /**
     * Send message to webview
     */
    postMessage(type, data) {
        this.panel?.webview.postMessage({ type, data });
    }
    /**
     * Generate a nonce for CSP
     */
    getNonce() {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    generateTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[-:T]/g, "").slice(0, 15); // yyyymmddhhmmss
    }
    /** Expose onDidDispose callback for manager */
    _onDidDispose;
    onDidDispose(callback) {
        this._onDidDispose = callback;
    }
    /** Dispose panel and disposables */
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this.panel?.dispose();
        this.panel = undefined;
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
        this._isDisposed = true;
    }
    /** Whether panel is disposed */
    isDisposed() {
        return this._isDisposed;
    }
    /**
     * Log message with timestamp
     */
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.BaseWebview = BaseWebview;
//# sourceMappingURL=baseWebView.js.map