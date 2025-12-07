"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrisInference = void 0;
const fs = require("fs");
const papaparse_1 = __importDefault(require("papaparse"));
class IrisInference {
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Analyze a file and infer column types
     */
    async analyzeFile(filePath, fileFormat, file_delimiter = ",") {
        this.log(`[IrisConnector] Analyzing file: ${filePath} (${fileFormat})`);
        let columns = [];
        try {
            if (fileFormat === "csv" || fileFormat === "txt") {
                columns = await this.analyzeCsvFile(filePath, file_delimiter);
            }
            else if (fileFormat === "json") {
                columns = await this.analyzeJsonFile(filePath);
            }
            else if (fileFormat === "xlsx" || fileFormat === "xls") {
                columns = await this.analyzeExcelFile(filePath);
            }
            else {
                throw new Error(`Unsupported file format: ${fileFormat}`);
            }
            this.log(`[IrisConnector] Analysis complete: ${columns.length} columns found`);
            return { columns };
        }
        catch (error) {
            this.log(`[IrisConnector] Analysis failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Analyze a CSV file and infer column types
    */
    async analyzeCsvFile(filePath, file_delimiter) {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            const parsed = papaparse_1.default.parse(content, {
                header: true,
                delimiter: file_delimiter,
                skipEmptyLines: true,
                dynamicTyping: false
            });
            if (parsed.errors.length > 0) {
                throw new Error("CSV parsing failed: " + parsed.errors[0].message);
            }
            const rows = parsed.data;
            if (rows.length === 0) {
                throw new Error("CSV has headers but no data rows");
            }
            // Extract headers from Papa Parse metadata
            const headers = parsed.meta.fields || [];
            // Sample up to 100 rows for type inference
            const sampleRows = rows.slice(0, 100);
            const result = headers.map((originalName) => {
                const sanitizedName = this.sanitizeColumnName(originalName);
                const values = sampleRows
                    .map((row) => row[originalName])
                    .filter((v) => v !== null && String(v).trim() !== "");
                return {
                    name: sanitizedName,
                    originalName,
                    inferredType: this.inferColumnType(values),
                    sampleValue: values.length > 0 ? values[0] : "NULL"
                };
            });
            return result;
        }
        catch (error) {
            throw new Error(`Failed to analyze CSV file: ${error.message}`);
        }
    }
    async analyzeJsonFile(filePath) {
        const content = fs.readFileSync(filePath, "utf8");
        const json = JSON.parse(content);
        // Handle both array and single object
        const sample = Array.isArray(json) ? json[0] : json;
        if (!sample || typeof sample !== "object") {
            throw new Error("Invalid JSON structure: expected object or array of objects");
        }
        return Object.entries(sample).map(([key, value]) => ({
            name: this.sanitizeColumnName(key),
            originalName: key,
            inferredType: this.inferTypeFromValue(value),
            sampleValue: String(value).substring(0, 50),
        }));
    }
    async analyzeExcelFile(filePath) {
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
            const sample = data[0];
            const sampleRows = data.slice(0, 100);
            return Object.keys(sample).map((key) => {
                const values = sampleRows
                    .map((row) => row[key])
                    .filter((v) => v !== "");
                return {
                    name: this.sanitizeColumnName(key),
                    originalName: key,
                    inferredType: this.inferColumnType(values.map(String)),
                    sampleValue: String(values[0] || "NULL").substring(0, 50),
                };
            });
        }
        catch (error) {
            if (error.code === "MODULE_NOT_FOUND") {
                throw new Error('Excel support requires "xlsx" package. Please install it: npm install xlsx');
            }
            throw error;
        }
    }
    /**
     * Sanitize column name for SQL compatibility
     */
    sanitizeColumnName(name) {
        return name
            .trim()
            .replace(/[^A-Za-z0-9_]/g, "_")
            .replace(/^(\d)/, "_$1")
            .substring(0, 128);
    }
    /**
     * Infer SQL type from sample values
     */
    inferColumnType(values) {
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
        // strict boolean (0/1)
        if (nonEmpty.every((v) => /^(0|1)$/i.test(v))) {
            return "BIT";
        }
        // yes/no or true/false → treat as text
        if (nonEmpty.every((v) => /^(yes|no|true|false)$/i.test(v))) {
            return "VARCHAR(10)";
        }
        // Check string length
        const maxLength = Math.max(...nonEmpty.map((v) => v.length));
        if (maxLength > 4000) {
            return "CLOB";
        }
        else if (maxLength > 255) {
            return "VARCHAR(4000)";
        }
        return "VARCHAR(255)";
    }
    /**
     * Infer type from a JSON value
     */
    inferTypeFromValue(value) {
        if (value === null || value === undefined) {
            return "VARCHAR(255)";
        }
        if (typeof value === "number") {
            return Number.isInteger(value) ? "INTEGER" : "DOUBLE";
        }
        if (typeof value === "boolean") {
            return "BIT"; // "BOOLEAN";
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
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.IrisInference = IrisInference;
//# sourceMappingURL=inference.js.map