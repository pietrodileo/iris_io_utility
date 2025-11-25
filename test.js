"use strict";
/**
 * Test file for IrisConnector
 *
 * Run with: ts-node test.ts
 * Or compile and run: tsc test.ts && node test.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
const irisConnector_1 = require("./irisConnector");
async function runTests() {
    console.log("=".repeat(60));
    console.log("IRIS Connector Test Suite");
    console.log("=".repeat(60));
    // Configuration - adjust these values to match your IRIS instance
    const config = {
        host: "127.0.0.1",
        port: 1972,
        ns: "USER",
        usr: "_SYSTEM",
        pwd: "SYS",
    };
    const connector = new irisConnector_1.IrisConnector(config);
    try {
        // Test 1: Connection
        console.log("\n[TEST 1] Testing connection...");
        await connector.connect();
        console.log("✓ Connection successful");
        console.log(`  Connected to: ${connector.toString()}`);
        // Test 2: Check connection status
        console.log("\n[TEST 2] Checking connection status...");
        const isConnected = connector.isConnected();
        console.log(`✓ Connection status: ${isConnected ? "CONNECTED" : "DISCONNECTED"}`);
        // Test 3: Simple SQL query
        console.log("\n[TEST 3] Testing simple SQL query...");
        const testSql = "SELECT 1 as TestValue, 'Hello IRIS' as Message";
        console.log(`  Executing: ${testSql}`);
        const result = connector.iris.classMethodValue("%SYSTEM.SQL", "Execute", testSql);
        console.log("✓ Query executed");
        console.log("  Result object:", JSON.stringify(result, null, 2));
        console.log("  Result type:", typeof result);
        console.log("  Result keys:", Object.keys(result || {}));
        // Test 4: Get IRIS version info
        console.log("\n[TEST 4] Getting IRIS version...");
        try {
            const versionResult = connector.iris.classMethodValue("%SYSTEM.Version", "GetVersion");
            console.log("✓ Version:", versionResult);
        }
        catch (error) {
            console.log("✗ Version check failed:", error.message);
        }
        // Test 5: Query schemas
        console.log("\n[TEST 5] Querying available schemas...");
        const schemasSql = "SELECT DISTINCT TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA";
        console.log(`  Executing: ${schemasSql}`);
        try {
            const schemasResult = connector.iris.classMethodValue("%SYSTEM.SQL", "Execute", schemasSql);
            console.log("✓ Schemas query executed");
            console.log("  Result:", JSON.stringify(schemasResult, null, 2));
            // Try different methods to access result data
            console.log("\n  Attempting to access result data:");
            // Method 1: Check if result has a Next method
            if (typeof schemasResult.next === "function") {
                console.log("  - Result has .next() method");
            }
            // Method 2: Check if result has data property
            if (schemasResult.data) {
                console.log("  - Result has .data property:", schemasResult.data);
            }
            // Method 3: Check if result is iterable
            if (schemasResult[Symbol.iterator]) {
                console.log("  - Result is iterable");
            }
            // Method 4: Try to invoke methods
            try {
                const hasNext = schemasResult.invoke_method?.({ method: "%Next" });
                console.log("  - %Next() returned:", hasNext);
            }
            catch (e) {
                console.log("  - %Next() not available:", e.message);
            }
        }
        catch (error) {
            console.log("✗ Schemas query failed:", error.message);
            console.log("  Error stack:", error.stack);
        }
        // Test 6: Query a specific table
        console.log("\n[TEST 6] Querying INFORMATION_SCHEMA.TABLES...");
        const tablesSql = "SELECT TOP 5 TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'";
        console.log(`  Executing: ${tablesSql}`);
        try {
            const tablesResult = connector.iris.classMethodValue("%SYSTEM.SQL", "Execute", tablesSql);
            console.log("✓ Tables query executed");
            console.log("  Result:", JSON.stringify(tablesResult, null, 2));
        }
        catch (error) {
            console.log("✗ Tables query failed:", error.message);
        }
        // Test 7: Try using connector's query method
        console.log("\n[TEST 7] Testing connector.query() method...");
        try {
            const schemas = await connector.getSchemas();
            console.log("✓ Schemas retrieved:", schemas);
        }
        catch (error) {
            console.log("✗ getSchemas() failed:", error.message);
            console.log("  Error stack:", error.stack);
        }
        // Test 8: Access globals (if needed)
        console.log("\n[TEST 8] Testing global access...");
        try {
            // Try to set and get a global variable
            connector.iris.set("Hello from Node.js", "TestGlobal", "test");
            const value = connector.iris.get("TestGlobal", "test");
            console.log("✓ Global variable test:");
            console.log(`  Set: "Hello from Node.js"`);
            console.log(`  Get: "${value}"`);
            // Clean up
            connector.iris.kill("TestGlobal", "test");
        }
        catch (error) {
            console.log("✗ Global access failed:", error.message);
        }
    }
    catch (error) {
        console.error("\n✗ Test suite failed:");
        console.error("  Error:", error.message);
        console.error("  Stack:", error.stack);
    }
    finally {
        // Cleanup
        console.log("\n[CLEANUP] Closing connection...");
        connector.close();
        console.log("✓ Connection closed");
    }
    console.log("\n" + "=".repeat(60));
    console.log("Test Suite Complete");
    console.log("=".repeat(60));
}
// Run the tests
runTests().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=test.js.map