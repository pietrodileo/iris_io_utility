# IRIS IO Utility

A powerful Visual Studio Code extension for seamless data import/export operations with InterSystems IRIS databases. This extension provides an intuitive interface to connect, manage, and transfer data between various file formats and IRIS namespaces.

> **Contest Submission**: This project was developed as a submission for the InterSystems "Bringing Ideas to Reality" Contest of December 2025.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Option 1: Using the Containerized IRIS Instance](#option-1-using-the-containerized-iris-instance)
  - [Option 2: Connecting to Your Own IRIS Instance](#option-2-connecting-to-your-own-iris-instance)
- [Connection Types](#connection-types)
  - [Native SDK Connection](#native-sdk-connection)
  - [ODBC Connection](#odbc-connection)
- [Using the Extension](#using-the-extension)
  - [Managing Connections](#managing-connections)
  - [Importing Data](#importing-data)
  - [Exporting Data](#exporting-data)
- [Configuration](#configuration)
- [Supported File Formats](#supported-file-formats)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## ✨ Features

- **Dual Connection Methods**
  - Native Node.js SDK connection (built-in, no drivers required)
  - ODBC connection (requires InterSystems IRIS drivers, offers better performance)

- **Smart Data Import and Export**
  - Automatic data type inference from file content
  - Converts inferred types to IRIS SQL-compliant data types
  - You can choose to create a new table automatically while importing data or to append or replace data in an existing table
  - Support for custom column types and indexes
  - Export any table from IRIS namespaces
  - Multiple format options: CSV, TXT, JSON, XLSX

- **Intuitive UI**
  - Dedicated sidebar view with connection management
  - Interactive webviews for import/export operations
  - Real-time connection status indicators
  - Favorites system for quick access to frequently used tables

- **Supported File Formats**
  - CSV (Comma-Separated Values)
  - TXT (With custom delimiter)
  - JSON
  - XLSX (Microsoft Excel)

## 📦 Prerequisites

- **Visual Studio Code** 1.80.0 or higher
- **Node.js** 14.0 or higher
- **InterSystems IRIS** instance (local, remote, or containerized)
- **ODBC Drivers** (optional, for ODBC connections)

## 🚀 Installation

### From VS Code Marketplace

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "IRIS IO Utility"
4. Click Install

### From VSIX File

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Go to Extensions view
4. Click the "..." menu → Install from VSIX
5. Select the downloaded file

## 🎯 Getting Started

### Option 1: Using the Containerized IRIS Instance

The project includes a pre-configured Docker Compose setup for testing purposes.

#### Step 1: Start the Container

```bash
# Navigate to the project directory
cd iris-io-utility

# Start the IRIS container
docker-compose up -d
```

The container will start an InterSystems IRIS instance with the following configuration:

- **Management Portal**: <http://localhost:9092/csp/sys/UtilHome.csp>
- **SuperServer Port**: 9092
- **Web Server Port**: 9091
- **Username**: _SYSTEM
- **Password**: SYS
- **Default Namespace**: USER

#### Step 2: Verify the Container

1. Open your browser and navigate to <http://localhost:9092/csp/sys/UtilHome.csp>
2. Login with:
   - Username: `_SYSTEM`
   - Password: `SYS`
3. You should see the IRIS Management Portal

#### Step 3: Create a Connection in VS Code

1. Open VS Code and click on the **IRIS IO Utility** icon in the sidebar
2. Click **"Add New Connection"** (+ icon)
3. Enter the following details:
   - **Connection Name**: `Local Docker IRIS`
   - **Host**: `localhost`
   - **SuperServer Port**: `9092`
   - **Web Server Port**: `9091`
   - **Namespace**: `USER`
   - **Username**: `_SYSTEM`
   - **Password**: `SYS`
    If you prefer, you can try to connect to another IRIS instance. The extension works both with local (SSH as well) and remote instances.
4. Open the settings page (gear icon) and select the **Connection Type**:
    - Select `Native SDK` (or `ODBC` if drivers are installed)

#### Step 4: Connect

1. Find your connection in the Connections view
2. Click the **Connect** icon (plug icon)
3. Wait for the connection status to change to "Connected" (green checkmark)

## 🔌 Connection Types

### Native SDK Connection

The **Native SDK** connection uses the InterSystems Node.js SDK and requires no additional drivers.

### ODBC Connection

The **ODBC** connection uses the InterSystems IRIS ODBC driver for enhanced performance.

#### Installing ODBC Drivers

1. Open the IRIS IO Utility sidebar
2. Click the **Settings** icon (gear icon) at the top
3. Click **"Check ODBC Drivers"**
4. If drivers are not detected, click **"Download ODBC Drivers"**
5. Follow the installation instructions for your platform:
   - **Windows**: Run the installer and follow the wizard
   - **macOS**: Mount the DMG and run the installer
   - **Linux**: Extract the archive and run the install script
6. After installation, return to the settings page and click **"Check ODBC Drivers"** again
7. Select your preferred driver from the dropdown
8. Click **"Save Driver Selection"**

## 📖 Using the Extension

### Managing Connections

#### Creating a Connection

1. Click the **"+ Add New Connection"** button in the sidebar
2. Fill in the connection details form
3. Choose between Native SDK or ODBC connection type
4. Click **"Save Connection"**

#### Editing a Connection

1. Find the connection in the list
2. Click the **Edit** icon (pencil)
3. Modify the connection details
4. Click **"Save Changes"**

#### Connecting/Disconnecting

1. Click the **Connect** icon (plug) to establish a connection
2. Click the **Disconnect** icon (unplug) to close the connection
3. Connection status is indicated by:
   - Idle (not connected)
   - Connected
   - Error
4. Right-click on a connection to copy its details as a JSON.

#### Favorites

1. Click the **Star** icon to add a connection to favorites
2. Access favorited connections from the "Favorites" view
3. Click the **Star** icon again to remove from favorites

### Importing Data

The Import feature allows you to load data from various file formats into IRIS tables.

#### Step 1: Open Import View

1. Connect to your IRIS instance
2. Click the **Import** icon (cloud with up arrow) on your connection
3. The Import webview will open

#### Step 2: Select File

1. Click **"Browse..."** to select your data file
2. Supported formats: CSV, TXT, JSON, XLSX
3. The file path will appear in the input field

#### Step 3: Choose Import Mode

**Option A: Create New Table**

1. Select the **"Import to New Table"** tab
2. Enter a schema name (e.g., `SQLUser`)
3. Enter a new table name
4. Click **"Analyze File"** to preview data types
5. Review and adjust column types if needed
6. Configure indexes (optional):
   - Check the "Index" box for columns you want to index
   - Select index type (INDEX, UNIQUE, BITMAP)
   - Optionally customize the index name
7. Click **"Import"**

**Option B: Import to Existing Table**

1. Select the **"Import to Existing Table"** tab
2. Select the target schema from the dropdown
3. Select the target table from the dropdown
4. Choose data action:
   - **Append**: Add new rows to existing data
   - **Replace**: Delete all existing rows and insert new data
5. Click **"Import"**

#### Step 4: Monitor Progress

- Progress notifications will appear in VS Code
- Check the Output panel (IRIS IO Utility channel) for detailed logs
- A success message will confirm when import is complete

#### Import Features

**Automatic Type Inference**

- The extension analyzes your data and suggests optimal SQL data types
- Detects: INTEGER, VARCHAR, DATE, TIMESTAMP, DECIMAL, BOOLEAN
- Sample values are shown for verification

**Custom Type Selection**

- Override inferred types by selecting from the dropdown
- Supports all IRIS SQL data types
- Changes are applied before table creation

**Index Creation**

- Create indexes during table creation
- Support for INDEX, UNIQUE, BITSLICE, BITMAP and COLUMNAR indexes
- Automatic index naming with customization option

### Exporting Data

The Export feature allows you to extract data from IRIS tables to various file formats.

#### Step 1: Open Export View

1. Connect to your IRIS instance
2. Click the **Export** icon (cloud with down arrow) on your connection
3. The Export webview will open

#### Step 2: Select Schema and Table

1. Enter a schema filter (optional) to narrow down schemas
2. Click **"Search Schemas"** or press Enter
3. Select the schema from the dropdown
4. Select the table you want to export

#### Step 3: Configure Export

1. Choose the output format:
   - **CSV**: Comma-separated values
   - **TXT**: Tab-separated (or custom delimiter)
   - **JSON**: JavaScript Object Notation
   - **XLSX**: Excel format

2. Specify export location:
   - Leave blank to use the current workspace folder
   - Or click **"Browse..."** to select a specific folder

3. (Optional) Enter a custom filename
   - If left blank, uses format: `{schema}_{table}_{timestamp}`

#### Step 4: Export

1. Click **"Export"**
2. Progress notification will appear
3. When complete, choose to:
   - **Open File**: View the exported data immediately
   - **Open Folder**: Open the containing folder
   - Or dismiss the notification

#### Export Features

**Format Options**

- **CSV**: Standard comma-separated format, Excel-compatible
- **TXT**: Tab-separated by default, customizable delimiter
- **JSON**: Pretty-printed, array of objects format
- **XLSX**: Native Excel format (preserves data types)

**Automatic Timestamps**

- All exports include timestamp in filename
- Format: `YYYYMMDD_HHMMSS`
- Prevents accidental overwrites

**Workspace Integration**

- Exports to workspace folder by default
- Custom folder selection available
- File operations logged to Output panel

## ⚙️ Configuration

### Extension Settings

Access settings via the gear icon in the IRIS IO Utility sidebar.

**Default Connection Type**

- Choose between Native SDK and ODBC
- Applies globally to new connections of any connection item (even if added previously)

**ODBC Driver Selection**

- View installed ODBC drivers
- Select preferred driver
- Test driver availability

### Workspace Settings

Connection data is stored per workspace in VS Code's workspace state:

- Connection configurations
- Favorites list
- Default connection type
- Selected ODBC driver

**Note**: Connections are workspace-specific and won't appear in other workspaces.

## 🔧 Troubleshooting

### Output Window

The extension is provided with a VSCode Output window called "IRIS IO Utility" where you can see logs.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Happy Data Managing! 🚀**