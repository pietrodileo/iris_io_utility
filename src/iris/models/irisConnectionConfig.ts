/*  Interface representing the configuration needed to connect to an IRIS database */
export interface IrisConnectionConfig {
  host: string;
  port: number;
  ns: string;
  user: string;
  pwd: string;
}
