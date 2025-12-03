import * as vscode from "vscode";
import { OdbcDriverChecker } from "../iris/models/connection/odbcDriverChecker";
import * as path from "path";
import * as fs from "fs";

export class OdbcSettingsWebview {
  private panel: vscode.WebviewPanel | undefined;
  private outputChannel: vscode.OutputChannel;
  private context: vscode.ExtensionContext;
  private readonly CONNECTION_TYPE_KEY = "irisIO.defaultConnectionType";
  private readonly ODBC_DRIVER_KEY = "irisIO.odbcDriver";

  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
  }

  public async show(): Promise<void> {
    // Get current connection type from workspaceState
    const currentConnectionType = this.context.workspaceState.get<string>(
      this.CONNECTION_TYPE_KEY,
      "native"
    );

    this.log(
      `[OdbcSettingsWebview] Opening settings with connection type: ${currentConnectionType}`
    );

    // If panel already exists, reveal it and refresh content
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      // Refresh the HTML content with current settings
      this.panel.webview.html = this.getHtmlContent(currentConnectionType);
      this.log(
        `[OdbcSettingsWebview] Refreshed existing panel with connection type: ${currentConnectionType}`
      );
      return;
    }

    // Create new webview panel
    this.panel = vscode.window.createWebviewPanel(
      "irisOdbcSettings",
      "IRIS Connection Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Set initial HTML content
    this.panel.webview.html = this.getHtmlContent(currentConnectionType);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up when panel is closed
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case "checkDrivers":
        await this.handleCheckDrivers();
        break;
      case "downloadDrivers":
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://intersystems-community.github.io/iris-driver-distribution/"
          )
        );
        break;
      case "setOdbcDriver":
        await this.setOdbcDriver(message.data);
        break;
      case "setDefaultConnectionType":
        await this.setDefaultConnectionType(message.data);
        break;
    }
  }

  private async handleCheckDrivers(): Promise<void> {
    try {
      this.postMessage("loading", true);

      this.log("[OdbcSettingsWebview] Checking ODBC drivers...");
      const driverChecker = new OdbcDriverChecker(this.outputChannel);
      const driversAvailable = await driverChecker.checkOdbcDrivers();
      this.log(
        `[OdbcSettingsWebview] ODBC drivers available: ${driversAvailable}`
      );
      const availableDrivers = await driverChecker.listInstalledDrivers();
      this.log(
        `[OdbcSettingsWebview] Available drivers: ${JSON.stringify(
          availableDrivers
        )}`
      );

      const selectedDriver = this.context.workspaceState.get<string>(
        this.ODBC_DRIVER_KEY,
        ""
      );

      this.postMessage("drivers-checked", {
        driversAvailable,
        availableDrivers,
        selectedDriver,
      });

      this.postMessage("loading", false);
    } catch (error: any) {
      this.postMessage("error", `Failed to check drivers: ${error.message}`);
      this.postMessage("loading", false);
    }
  }

  private async setOdbcDriver(driverName: string): Promise<void> {
    try {
      this.log(`[OdbcSettingsWebview] Setting ODBC driver to: ${driverName}`);

      await this.context.workspaceState.update(
        this.ODBC_DRIVER_KEY,
        driverName
      );

      this.log(
        `[OdbcSettingsWebview] Successfully saved ODBC driver: ${driverName}`
      );
      vscode.window.showInformationMessage(`ODBC driver set to: ${driverName}`);

      this.postMessage("odbc-driver-saved", driverName);
    } catch (error: any) {
      this.log(
        `[OdbcSettingsWebview] Error saving ODBC driver: ${error.message}`
      );
      vscode.window.showErrorMessage(
        `Failed to save ODBC driver: ${error.message}`
      );
      this.postMessage("error", `Failed to save ODBC driver: ${error.message}`);
    }
  }

  private async setDefaultConnectionType(
    type: "native" | "odbc"
  ): Promise<void> {
    try {
      this.log(
        `[OdbcSettingsWebview] Setting default connection type to: ${type}`
      );

      await this.context.workspaceState.update(this.CONNECTION_TYPE_KEY, type);

      this.log(
        `[OdbcSettingsWebview] Successfully saved connection type: ${type}`
      );

      // Show success message
      vscode.window.showInformationMessage(
        `Default connection type set to: ${type.toUpperCase()}`
      );

    } catch (error: any) {
      this.log(
        `[OdbcSettingsWebview] Error saving connection type: ${error.message}`
      );
      vscode.window.showErrorMessage(
        `Failed to save connection type: ${error.message}`
      );
      this.postMessage(
        "error",
        `Failed to save connection type: ${error.message}`
      );
    }
  }

  private postMessage(type: string, data: any): void {
    if (this.panel) {
      this.panel.webview.postMessage({ type, data });
    }
  }

  private getBodyContent(): string {
    const htmlPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "settings",
      "settings.html"
    );
    const cssPath = path.join(
      this.context.extensionPath,
      "src",
      "webviews",
      "settings",
      "settings.css"
    );

    const html = fs.readFileSync(htmlPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    return `
      <style>${css}</style>
      ${html}
    `;
  }

  private getCustomScript(currentConnectionType: string): string {
    return `
      const vscode = acquireVsCodeApi();
      const currentConnectionType = '${currentConnectionType}';

      function sendMessage(type, data) {
        vscode.postMessage({ type, data });
      }

      // Initialize connection type selection on load
      function initializeConnectionType() {
        document.querySelectorAll('.radio-option').forEach(option => {
          const type = option.getAttribute('data-type');
          const radio = option.querySelector('input[type="radio"]');
          
          if (type === currentConnectionType) {
            option.classList.add('selected');
            radio.checked = true;
          }
        });
      }

      // Check drivers button
      document.getElementById('check-drivers-btn').addEventListener('click', () => {
        sendMessage('checkDrivers', null);
      });

      // Download drivers button
      document.getElementById('download-drivers-btn').addEventListener('click', () => {
        sendMessage('downloadDrivers', null);
      });

      // Radio options for connection type - just update UI, don't save yet
      document.querySelectorAll('.radio-option').forEach(option => {
        option.addEventListener('click', function() {
          const type = this.getAttribute('data-type');
          updateConnectionTypeUI(type);
        });
      });

      // Save connection type button
      document.getElementById('save-connection-type-btn').addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="connectionType"]:checked');
        if (selectedRadio) {
          sendMessage('setDefaultConnectionType', selectedRadio.value);
        }
      });

      function updateConnectionTypeUI(type) {
        // Update UI only
        document.querySelectorAll('.radio-option').forEach(option => {
          option.classList.remove('selected');
        });
        document.querySelector(\`label[data-type="\${type}"]\`).classList.add('selected');
        
        // Update radio button
        document.querySelector(\`input[value="\${type}"]\`).checked = true;
      }

      function selectConnectionType(type) {
        // Update UI and save
        updateConnectionTypeUI(type);
        
        // Send message to extension
        sendMessage('setDefaultConnectionType', type);
      }

      function updateDriverStatus(driversAvailable, availableDrivers, selectedDriver) {
        const statusDiv = document.getElementById('driverStatus');
        const messageDiv = document.getElementById('driverMessage');
        const driversBox = document.getElementById('availableDriversBox');

        // Show status div
        statusDiv.style.display = 'flex';

        if (driversAvailable) {
          statusDiv.innerHTML = \`
            <div class="status-icon success">✓</div>
            <span><strong>ODBC drivers are installed</strong></span>
          \`;
          messageDiv.innerHTML = \`
            <p>InterSystems IRIS ODBC drivers are available on this system. You can use ODBC connections for better performance.</p>
          \`;

          if (availableDrivers && availableDrivers.length > 0) {
            driversBox.style.display = 'block';
            driversBox.innerHTML = \`
              <div class="info-box">
                <strong>Select ODBC Driver:</strong>
                <select id="odbc-driver-select" class="driver-select">
                  \${availableDrivers.map(driver => \`
                    <option value="\${driver}" \${driver === selectedDriver ? 'selected' : ''}>\${driver}</option>
                  \`).join('')}
                </select>
              </div>
            \`;

            // Attach change handler to select
            const driverSelect = document.getElementById('odbc-driver-select');
            if (driverSelect) {
              driverSelect.addEventListener('change', function() {
                sendMessage('setOdbcDriver', this.value);
              });
            }
          }
        } else {
          statusDiv.innerHTML = \`
            <div class="status-icon error">✗</div>
            <span><strong>ODBC drivers are NOT installed</strong></span>
          \`;
          messageDiv.innerHTML = \`
            <p>InterSystems IRIS ODBC drivers were not detected. You can download and install them to enable ODBC connections.</p>
          \`;
          driversBox.style.display = 'none';
        }
      }

      // Message handler
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
          case 'drivers-checked':
            updateDriverStatus(
              message.data.driversAvailable, 
              message.data.availableDrivers,
              message.data.selectedDriver
            );
            break;
          case 'loading':
            const checkBtn = document.getElementById('check-drivers-btn');
            if (checkBtn) {
              checkBtn.disabled = message.data;
              checkBtn.textContent = message.data ? 'Checking...' : 'Check ODBC Drivers';
            }
            break;
          case 'error':
            alert(message.data);
            break;
        }
      });

      // Initialize on page load
      initializeConnectionType();
    `;
  }

  private getHtmlContent(currentConnectionType: string): string {
    const bodyContent = this.getBodyContent();
    const customScript = this.getCustomScript(currentConnectionType);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IRIS Connection Settings</title>
</head>
<body>
    ${bodyContent}
    <script>
      ${customScript}
    </script>
</body>
</html>`;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
