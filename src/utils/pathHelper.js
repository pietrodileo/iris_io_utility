"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathHelper = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class PathHelper {
    static isDevelopment = null;
    /**
     * Detect if running in development mode
     */
    static checkDevelopment(context) {
        if (this.isDevelopment !== null) {
            return this.isDevelopment;
        }
        // Check if src folder exists (development mode)
        const srcPath = path.join(context.extensionPath, "src");
        this.isDevelopment = fs.existsSync(srcPath);
        return this.isDevelopment;
    }
    /**
     * Get the correct base path for resources (src in dev, out in production)
     */
    static getResourcePath(context, ...segments) {
        const basePath = this.checkDevelopment(context) ? "src" : "dist";
        return path.join(context.extensionPath, basePath, ...segments);
    }
    /**
     * Read a webview HTML file
     */
    static readWebviewFile(context, ...pathSegments) {
        const filePath = this.getResourcePath(context, ...pathSegments);
        return fs.readFileSync(filePath, "utf8");
    }
}
exports.PathHelper = PathHelper;
//# sourceMappingURL=pathHelper.js.map