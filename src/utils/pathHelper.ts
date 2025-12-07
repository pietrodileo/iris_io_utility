import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class PathHelper {
  private static isDevelopment: boolean | null = null;

  /**
   * Detect if running in development mode
   */
  private static checkDevelopment(context: vscode.ExtensionContext): boolean {
    if (this.isDevelopment !== null) {
      return this.isDevelopment;
    }

    // Check if src folder exists (development mode)
    const srcPath = path.join(context.extensionPath, "src");
    this.isDevelopment = fs.existsSync(srcPath);

    return this.isDevelopment;
  }

  /**
   * Get the correct base path for resources (src in dev, out in production)
   */
  public static getResourcePath(
    context: vscode.ExtensionContext,
    ...segments: string[]
  ): string {
    const basePath = this.checkDevelopment(context) ? "src" : "dist";
    return path.join(context.extensionPath, basePath, ...segments);
  }

  /**
   * Read a webview HTML file
   */
  public static readWebviewFile(
    context: vscode.ExtensionContext,
    ...pathSegments: string[]
  ): string {
    const filePath = this.getResourcePath(context, ...pathSegments);
    return fs.readFileSync(filePath, "utf8");
  }
}
