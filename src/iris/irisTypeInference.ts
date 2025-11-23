export type IrisColumnTypes = Record<string, string>;

/**
 * Distinguish DATE vs DATETIME
 * Rules:
 *  - DD/MM/YYYY or YYYY-MM-DD → DATE
 *  - contains time (HH:mm[:ss]) → DATETIME
 */

export function inferIrisTypes(
  rows: any[][],
  columns: string[]
): IrisColumnTypes {
  const result: IrisColumnTypes = {};
  const maxVarchar = 255;

  columns.forEach((rawCol, idx) => {
    const col = normalizeColumnName(rawCol);
    const values = rows
      .map((r) => r[idx])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) {
      result[col] = `VARCHAR(${maxVarchar})`;
      return;
    }

    if (values.every(isInteger)) {
      result[col] = "INT";
    } else if (values.every(isNumber)) {
      result[col] = "DOUBLE";
    } else if (values.every(isDateOnly)) {
      result[col] = "DATE";
    } else if (values.every(isDateTime)) {
      result[col] = "DATETIME";
    } else if (values.every((v) => typeof v === "boolean")) {
      result[col] = "BIT";
    } else if (values.every((v) => typeof v === "string")) {
      const longest = Math.max(...values.map((v) => v.length));
      result[col] = `VARCHAR(${Math.min(longest, maxVarchar)})`;
    } else {
      result[col] = `VARCHAR(${maxVarchar})`;
    }
  });

  return result;
}

function normalizeColumnName(name: string): string {
  return name.trim().replace(/\s+/g, "_").replace(/\./g, "_");
}

function isInteger(v: any): boolean {
  return Number.isInteger(v);
}

function isNumber(v: any): boolean {
  return typeof v === "number" && !Number.isNaN(v);
}

function isDateOnly(v: any): boolean {
  if (v instanceof Date) {return false;} // real Date considered datetime here
  if (typeof v !== "string") {return false;}
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v);
}

function isDateTime(v: any): boolean {
  if (v instanceof Date) {return true;}
  if (typeof v !== "string") {return false;}
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/.test(v);
}
