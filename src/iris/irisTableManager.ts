import type { IrisColumnTypes } from "./irisTypeInference";
import { IrisConnector } from "./irisConnector";

export class IrisTableManager {
  constructor(private connector: IrisConnector) {}

  async createTable(
    tableName: string,
    columnTypes: IrisColumnTypes
  ): Promise<void> {
    if (!this.connector.isConnected()) {
      throw new Error("Not connected to IRIS");
    }

    const iris = this.connector.getIris();
    const cols = Object.entries(columnTypes)
      .map(([name, type]) => `${name} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE ${tableName} (${cols})`;

    iris.classMethodValue("%SYSTEM.SQL", "Execute", sql);
  }
}
