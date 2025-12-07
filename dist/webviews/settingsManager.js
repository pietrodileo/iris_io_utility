"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsManager = void 0;
class SettingsManager {
    static CONNECTION_TYPE_KEY = "irisIO.defaultConnectionType";
    static ODBC_DRIVER_KEY = "irisIO.odbcDriver";
    static getDefaultConnectionType(context) {
        return "odbc"; // Force ODBC as default
        // return context.workspaceState.get<"native" | "odbc">(this.CONNECTION_TYPE_KEY,"native");
    }
    static getOdbcDriver(context) {
        return context.workspaceState.get(this.ODBC_DRIVER_KEY, "");
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settingsManager.js.map