import * as vscode from "vscode";
import { Connection } from "./baseConnection";
import { IrisConnector } from "../iris/irisConnector";
import { ConnectionManager } from "../iris/connectionManager";

type WebviewMode = "import" | "export";

/**
 * Abstract base class for webview panels
 * Provides common functionality for import/export webviews
 */
export abstract class BaseWebview {
  protected panel: vscode.WebviewPanel | undefined;
  protected disposables: vscode.Disposable[] = [];
  private _isDisposed = false; // track disposal
  protected mode: WebviewMode | undefined;
  public outputChannel: vscode.OutputChannel;
  protected connection: Connection;
  protected connector: IrisConnector;

  constructor(
    protected context: vscode.ExtensionContext,
    connection: Connection,
    connectionManager: ConnectionManager,
    mode: WebviewMode,
    outputChannel: vscode.OutputChannel
  ) {
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
  public show(): void {
    // unique panel key per connection+mode
    const key = this.getViewType(this.connection, this.mode);

    // If panel exists and not disposed, just reveal it
    if (this.panel && !this._isDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Otherwise create a new panel
    this.panel = vscode.window.createWebviewPanel(
      key,
      this.getTitle(),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "out"),
        ],
      }
    );

    this._isDisposed = false;

    this.panel.webview.html = this.getHtmlContent();
    this.setupMessageHandlers();

    // Hook disposal to cleanup
    this.panel.onDidDispose(
      () => {
        this.dispose();
        this._onDidDispose?.();
      },
      null,
      this.disposables
    );
  }

  /**
   * Get unique view type identifier for a connection and mode
   */
  protected getViewType(
    connection: Connection,
    mode: "import" | "export" | undefined
  ): string {
    if (!mode) {
      return "";
    }
    return `iris-${mode}-${connection.id}`; // unique viewType per connection+mode
  }

  /**
   * Get panel title
   */
  protected abstract getTitle(): string;

  /**
   * Generate HTML content for the webview
   */
  protected getHtmlContent(): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
        this.panel!.webview.cspSource
      } 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
   * Get HTML body content - must be implemented by subclasses
   */
  protected abstract getBodyContent(): string;

  /**
   * Get JavaScript code for the webview
   */
  protected getScript(): string {
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
   * Get custom JavaScript for subclasses
   */
  protected abstract getCustomScript(): string;

  /**
   * Setup message handlers for communication
   */
  protected setupMessageHandlers(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  /**
   * Handle messages from webview - must be implemented by subclasses
   */
  protected abstract handleMessage(message: any): Promise<void>;

  /**
   * Send message to webview
   */
  protected postMessage(type: string, data: any): void {
    this.panel?.webview.postMessage({ type, data });
  }

  /**
   * Generate a nonce for CSP
   */
  protected getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[-:T]/g,"").slice(0,15); // yyyymmddhhmmss
  }

  /** Expose onDidDispose callback for manager */
  private _onDidDispose?: () => void;
  public onDidDispose(callback: () => void) {
    this._onDidDispose = callback;
  }

  /** Dispose panel and disposables */
  public dispose(): void {
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
  public isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Log message with timestamp
   */
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}