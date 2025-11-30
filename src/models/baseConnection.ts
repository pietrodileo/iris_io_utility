/**
 * Represents the data required to create or update a connection
*/
export interface ConnectionData {
  name: string;
  endpoint: string;
  superServerPort: number;
  webServerPort: number;
  namespace: string;
  user: string;
  password: string;
  description?: string;
  isOdbc?: boolean;
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