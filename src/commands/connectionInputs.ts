import * as vscode from "vscode";
import type { ConnectionData } from "../models/baseConnection";

/**
 * Handles user input for connection details
 */
export class ConnectionInputs {
  /**
   * Prompt user for all connection details
   * @param existingConnection Optional existing connection to pre-fill values
   * @returns Connection data or undefined if cancelled
   */
  static async promptForConnection(
    existingConnection?: Partial<ConnectionData>
  ): Promise<ConnectionData | undefined> {
    const name = await vscode.window.showInputBox({
      prompt: "Enter connection name",
      placeHolder: "My IRIS Connection",
      value: existingConnection?.name,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Connection name cannot be empty";
        }
        if (value.trim().length < 2) {
          return "Connection name must be at least 2 characters";
        }
        return null;
      },
    });

    if (!name) {
      return undefined;
    }

    const endpoint = await vscode.window.showInputBox({
      prompt: "Enter endpoint",
      placeHolder: "localhost or 192.168.1.100",
      value: existingConnection?.endpoint || "localhost",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Endpoint cannot be empty";
        }
        // Basic validation for hostname/IP
        const trimmed = value.trim();
        if (trimmed.length < 1) {
          return "Please enter a valid hostname or IP address";
        }
        return null;
      },
    });

    if (!endpoint) {
      return undefined;
    }

    const portString = await vscode.window.showInputBox({
      prompt: "Enter port",
      placeHolder: "52773",
      value: existingConnection?.port?.toString() || "52773",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Port cannot be empty";
        }
        const portNum = parseInt(value);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          return "Please enter a valid port number (1-65535)";
        }
        return null;
      },
    });

    if (!portString) {
      return undefined;
    }

    const namespace = await vscode.window.showInputBox({
      prompt: "Enter namespace",
      placeHolder: "USER",
      value: existingConnection?.namespace || "USER",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Namespace cannot be empty";
        }
        if (value.trim().length < 1) {
          return "Please enter a valid namespace";
        }
        return null;
      },
    });

    if (!namespace) {
      return undefined;
    }

    const user = await vscode.window.showInputBox({
      prompt: "Enter username",
      placeHolder: "_SYSTEM",
      value: existingConnection?.user || "_SYSTEM",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Username cannot be empty";
        }
        return null;
      },
    });

    if (!user) {
      return undefined;
    }

    const password = await vscode.window.showInputBox({
      prompt: "Enter password",
      password: true,
      placeHolder: "Enter your password",
      value: existingConnection?.password,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Password cannot be empty";
        }
        return null;
      },
    });

    if (!password) {
      return undefined;
    }

    const description = await vscode.window.showInputBox({
      prompt: "Enter description (optional)",
      placeHolder: "Development database",
      value: existingConnection?.description,
      ignoreFocusOut: true,
      // No validation for description as it's optional
    });

    return {
      name: name.trim(),
      endpoint: endpoint.trim(),
      port: parseInt(portString),
      namespace: namespace.trim(),
      user: user.trim(),
      password: password, // Don't trim password - might have intentional spaces
      description: description?.trim() || "",
    };
  }
}
