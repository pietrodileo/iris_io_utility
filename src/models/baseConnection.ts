/**
 * Represents the data required to create or update a connection
*/
export interface ConnectionData {
  name: string;
  endpoint: string;
  port: number;
  namespace: string;
  user: string;
  password: string;
  description?: string;
}

/**
 * Represents a connection item in the connections tree view
 * Inherits from ConnectionData
 * Includes optional status and error message fields
 */
export interface Connection extends ConnectionData {
  id: string;
  status?: "idle" | "connecting" | "connected" | "error";
  errorMessage?: string;
}