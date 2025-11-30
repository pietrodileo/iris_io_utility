/*  Interface representing the configuration needed to connect to an IRIS database */
export interface IrisConnectionConfig {
  host: string;
  superServerPort: number;
  webServerPort: number;
  ns: string;
  user: string;
  pwd: string;
  connectionType: ConnectionType;
  odbcDsn?: string;
}

export type ConnectionType = "native" | "odbc" ;