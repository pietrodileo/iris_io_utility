import * as vscode from "vscode";
import { BaseConnectionItem } from "../models/baseConnectionItem";

/**
 * Abstract base class for tree data providers
 * Provides common functionality for managing tree views
 */
export abstract class BaseProvider<T extends BaseConnectionItem>
  implements vscode.TreeDataProvider<T>
{
  protected _onDidChangeTreeData: vscode.EventEmitter<
    T | undefined | null | void
  > = new vscode.EventEmitter<T | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<T | undefined | null | void> =
    this._onDidChangeTreeData.event;

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the tree item representation
   */
  getTreeItem(element: T): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of an element
   * Must be implemented by subclasses
   */
  abstract getChildren(element?: T): Thenable<T[]>;
}
