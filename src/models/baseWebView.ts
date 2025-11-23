import * as vscode from "vscode";
import { Connection } from "./baseConnection";

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

  constructor(
    protected context: vscode.ExtensionContext,
    protected connection: Connection,
    mode: WebviewMode
  ) {}

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
          vscode.Uri.joinPath(this.context.extensionUri, "media"),
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
    if (!mode) {return "";}
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
      <style>
        ${this.getStyles()}
      </style>
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
   * Get CSS styles for the webview
   */
  protected getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        padding: 20px;
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }
      
      .container {
        max-width: 800px;
        margin: 0 auto;
      }
      
      .header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      
      .header h1 {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      
      .connection-info {
        color: var(--vscode-descriptionForeground);
        font-size: 13px;
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      .form-group input,
      .form-group select {
        width: 100%;
        padding: 8px 12px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 2px;
        font-family: inherit;
        font-size: inherit;
      }
      
      .form-group input:focus,
      .form-group select:focus {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: -1px;
      }
      
      .button-group {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }
      
      button {
        padding: 8px 16px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 2px;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
      }
      
      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
      
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      
      button.secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      .file-input-wrapper {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .file-input-wrapper input {
        flex: 1;
      }
      
      .file-input-wrapper button {
        flex-shrink: 0;
      }
      
      .info-message {
        padding: 12px;
        margin-bottom: 16px;
        background: var(--vscode-textBlockQuote-background);
        border-left: 3px solid var(--vscode-textBlockQuote-border);
        border-radius: 2px;
      }
      
      .error-message {
        padding: 12px;
        margin-top: 16px;
        background: var(--vscode-inputValidation-errorBackground);
        border: 1px solid var(--vscode-inputValidation-errorBorder);
        color: var(--vscode-errorForeground);
        border-radius: 2px;
      }
      
      .success-message {
        padding: 12px;
        margin-top: 16px;
        background: var(--vscode-terminal-ansiGreen);
        color: var(--vscode-terminal-ansiBrightWhite);
        border-radius: 2px;
        opacity: 0.8;
      }
      
      .loading {
        display: none;
        margin-top: 16px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
      }
      
      .loading.active {
        display: block;
      }
    `;
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
}