const irisnative = require("@intersystems/intersystems-iris-native");

export class IrisSqlConnection {
  private conn: any;
  private iris: any;

  constructor(options: any) {
    this.conn = irisnative.createConnection(options);
    this.iris = this.conn.createIris();
  }

  async query(sql: string, params: any[] = []) {
    const stmt = new SqlStatement(this.iris, sql);
    return stmt.execute(params);
  }

  close() {
    if (this.conn) {
      this.conn.close();
    }
  }
}

export class SqlStatement {
  private stmt: any;
  private iris: any;
  private sql: string;

  constructor(iris: any, sql: string) {
    this.iris = iris;
    this.sql = sql;

    this.stmt = iris.classMethodValue("%SQL.Statement", "%New", 1);
    const status = this.stmt.invokeString("%Prepare", sql);

    if (status !== "1") {
      const msg = iris.classMethodValue(
        "%SYSTEM.Status",
        "GetOneErrorText",
        status
      );
      throw new Error(msg);
    }
  }

  execute(params: any[] = []): SqlResultSet {
    const rs = this.stmt.invokeObject("%Execute", ...params);
    return new SqlResultSet(rs);
  }
}

export class SqlResultSet {
  rows: any[] = [];
  sqlcode: number = 0;
  message: string = "";
  private rs: any;

  constructor(rs: any) {
    this.rs = rs;
    this.sqlcode = rs.getNumber("%SQLCODE");
    this.message = rs.getString("%Message");

    if (this.sqlcode === 0) {
      this.fetchRows();
    }
  }

  private fetchRows() {
    while (this.rs.invokeBoolean("%Next")) {
      const row: Record<string, any> = {};
      const colCount = this.rs.getNumber("%ColumnCount");

      for (let i = 1; i <= colCount; i++) {
        const name = this.rs.invokeString("%GetColumnName", i);
        const value = this.rs.invokeString("%Get", name);
        row[name] = value;
      }

      this.rows.push(row);
    }
  }
}

async function main() {
  const config = {
    host: "localhost",
    port: parseInt("9091"),
    ns: "USER",
    user: "_SYSTEM",
    pwd: "iris",
  };

  const db = new IrisSqlConnection(config);
  const result = await db.query("SELECT 1 as TestValue, 'Hello IRIS' as Message");
  console.log(result.rows);
  db.close();
}

main();