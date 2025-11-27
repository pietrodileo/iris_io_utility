import * as vscode from "vscode";

export interface ColumnAnalysis {
  name: string;
  originalName: string;
  inferredType: string;
  sampleValue: string;
}

export abstract class IrisInference {
  protected outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Analyze a file and infer column types
   */
  async analyzeFile(
    filePath: string,
    fileFormat: string
  ): Promise<{ columns: ColumnAnalysis[] }> {
    this.log(`[IrisConnector] Analyzing file: ${filePath} (${fileFormat})`);

    const fs = require("fs");
    let columns: ColumnAnalysis[] = [];

    try {
      if (fileFormat === "csv" || fileFormat === "txt") {
        columns = await this.analyzeCsvFile(filePath);
      } else if (fileFormat === "json") {
        columns = await this.analyzeJsonFile(filePath);
      } else if (fileFormat === "xlsx" || fileFormat === "xls") {
        columns = await this.analyzeExcelFile(filePath);
      } else {
        throw new Error(`Unsupported file format: ${fileFormat}`);
      }

      this.log(
        `[IrisConnector] Analysis complete: ${columns.length} columns found`
      );
      return { columns };
    } catch (error: any) {
      this.log(`[IrisConnector] Analysis failed: ${error.message}`);
      throw error;
    }
  }

  async analyzeCsvFile(filePath: string): Promise<ColumnAnalysis[]> {
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");

    // Split by lines and filter empty
    const lines = content
      .split(/\r?\n/)
      .filter((line: string) => line.trim() !== "");

    if (lines.length === 0) {
      throw new Error("File is empty");
    }

    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const delimiter = firstLine.includes("\t")
      ? "\t"
      : firstLine.includes(";")
      ? ";"
      : ",";

    // Parse headers
    const headers = this.parseCsvLine(lines[0], delimiter);

    // Get sample rows (up to 100 for analysis)
    const sampleSize = Math.min(100, lines.length - 1);
    const sampleRows = lines
      .slice(1, sampleSize + 1)
      .map((line: string) => this.parseCsvLine(line, delimiter));

    // Analyze each column
    return headers.map((header, index) => {
      const originalName = header;
      const sanitizedName = this.sanitizeColumnName(header);
      const values = sampleRows
        .map((row: any[]) => row[index])
        .filter((v: string) => v && v.trim() !== "");

      return {
        name: sanitizedName,
        originalName,
        inferredType: this.inferColumnType(values),
        sampleValue: values[0] || "NULL",
      };
    });
  }

  private async analyzeJsonFile(filePath: string): Promise<ColumnAnalysis[]> {
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    // Handle both array and single object
    const sample = Array.isArray(json) ? json[0] : json;

    if (!sample || typeof sample !== "object") {
      throw new Error(
        "Invalid JSON structure: expected object or array of objects"
      );
    }

    return Object.entries(sample).map(([key, value]) => ({
      name: this.sanitizeColumnName(key),
      originalName: key,
      inferredType: this.inferTypeFromValue(value),
      sampleValue: String(value).substring(0, 50),
    }));
  }

  private async analyzeExcelFile(filePath: string): Promise<ColumnAnalysis[]> {
    // This requires xlsx library: npm install xlsx
    try {
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (data.length === 0) {
        throw new Error("Excel file is empty");
      }

      const sample = data[0] as Record<string, any>;
      const sampleRows = data.slice(0, 100);

      return Object.keys(sample).map((key) => {
        const values = sampleRows
          .map((row: { [x: string]: any }) => row[key])
          .filter((v: string) => v !== "");

        return {
          name: this.sanitizeColumnName(key),
          originalName: key,
          inferredType: this.inferColumnType(values.map(String)),
          sampleValue: String(values[0] || "NULL").substring(0, 50),
        };
      });
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error(
          'Excel support requires "xlsx" package. Please install it: npm install xlsx'
        );
      }
      throw error;
    }
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  /**
   * Sanitize column name for SQL compatibility
   */
  private sanitizeColumnName(name: string): string {
    return name
      .trim()
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^(\d)/, "_$1")
      .substring(0, 128);
  }

  /**
   * Infer SQL type from sample values
   */
  private inferColumnType(values: string[]): string {
    if (values.length === 0) {
      return "VARCHAR(255)";
    }

    const nonEmpty = values.filter((v) => v && v.trim() !== "");
    if (nonEmpty.length === 0) {
      return "VARCHAR(255)";
    }

    // Check for integer
    if (nonEmpty.every((v) => /^-?\d+$/.test(v))) {
      const max = Math.max(...nonEmpty.map((v) => Math.abs(parseInt(v))));
      return max > 2147483647 ? "BIGINT" : "INTEGER";
    }

    // Check for decimal/numeric
    if (nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) {
      return "DOUBLE";
    }

    // Check for date
    if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) {
      // Check if includes time
      if (nonEmpty.some((v) => /\d{2}:\d{2}:\d{2}/.test(v))) {
        return "TIMESTAMP";
      }
      return "DATE";
    }

    // Check for boolean
    if (nonEmpty.every((v) => /^(true|false|0|1|yes|no)$/i.test(v))) {
      return "BOOLEAN";
    }

    // Check string length
    const maxLength = Math.max(...nonEmpty.map((v) => v.length));
    if (maxLength > 4000) {
      return "CLOB";
    } else if (maxLength > 255) {
      return "VARCHAR(4000)";
    }

    return "VARCHAR(255)";
  }

  /**
   * Infer type from a JSON value
   */
  private inferTypeFromValue(value: any): string {
    if (value === null || value === undefined) {
      return "VARCHAR(255)";
    }

    if (typeof value === "number") {
      return Number.isInteger(value) ? "INTEGER" : "DOUBLE";
    }

    if (typeof value === "boolean") {
      return "BOOLEAN";
    }

    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return /\d{2}:\d{2}:\d{2}/.test(value) ? "TIMESTAMP" : "DATE";
      }
      return value.length > 255 ? "VARCHAR(4000)" : "VARCHAR(255)";
    }

    if (typeof value === "object") {
      return "CLOB";
    } // Store as JSON string

    return "VARCHAR(255)";
  }

  // ---------- Logging to output channel ----------
  /**
   * Log message with timestamp
   */
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}