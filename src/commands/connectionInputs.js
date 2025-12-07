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
exports.ConnectionInputs = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Handles user input for connection details
 */
class ConnectionInputs {
    /**
     * Prompt user for all connection details
     * @param existingConnection Optional existing connection to pre-fill values
     * @returns Connection data or undefined if cancelled
     */
    static async promptForConnection(existingConnection) {
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
            prompt: "Enter hostname or IP",
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
        const superServerPortString = await vscode.window.showInputBox({
            prompt: "Enter Superserver port",
            placeHolder: "52773",
            value: existingConnection?.superServerPort?.toString() || "52773",
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
        if (!superServerPortString) {
            return undefined;
        }
        const webServerPortString = await vscode.window.showInputBox({
            prompt: "Enter Web Server port",
            placeHolder: "1972",
            value: existingConnection?.webServerPort?.toString() || "1972",
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
        if (!webServerPortString) {
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
            // No validation for description since it's optional
        });
        return {
            name: name.trim(),
            endpoint: endpoint.trim(),
            superServerPort: parseInt(superServerPortString),
            webServerPort: parseInt(webServerPortString),
            namespace: namespace.trim(),
            user: user.trim(),
            password: password, // Don't trim password - might have intentional spaces
            description: description?.trim() || "",
        };
    }
}
exports.ConnectionInputs = ConnectionInputs;
//# sourceMappingURL=connectionInputs.js.map