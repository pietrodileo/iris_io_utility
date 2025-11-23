/**
 * Represents an IRIS database connection
 */
export interface Connection {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  namespace: string;
  user: string;
  password: string;
  description?: string;
  status?: "idle" | "connecting" | "connected" | "error";
  errorMessage?: string;
}
