# Chantier Planning Tool

This repository contains the extracted worker management components from the chantier planning tool.

## Extracted Files

The following files have been extracted from `chantier_planning_tool save presence online.zip`:

### Frontend Components

- **worker-management.js** - Core worker management functionality including:
  - Worker data management with MongoDB integration
  - Presence tracking and calendar management 
  - Monthly pay calculations
  - Worker CRUD operations
  - Group editing capabilities
  - Date range selection and filtering

- **worker-management.html** - Worker management interface with:
  - Calendar view for worker presence
  - Monthly summary displays
  - Employee management modals
  - Working days/hours configuration

- **styles.css** - Complete styling for the worker management interface

- **config.js** - Configuration settings and API endpoints

## Key Features

The worker-management.js file provides:

- **MongoDB Integration**: Full CRUD operations for worker data
- **Presence Management**: Track worker attendance and supplementary hours
- **Pay Calculations**: Monthly salary calculations with supplementary hour adjustments
- **Calendar Interface**: Interactive calendar for managing worker schedules
- **Group Operations**: Bulk editing capabilities for multiple workers
- **Data Persistence**: Automatic sync with backend MongoDB database

## API Endpoints

The system integrates with the following API endpoints:
- `/api/workers` - Worker CRUD operations
- `/api/presence` - Presence data management
- `/api/presence/all` - Bulk presence operations
- `/api/worker/rename` - Worker renaming operations
- `/api/presence/renameWorker` - Presence data worker name updates

## Usage

The worker management system is designed to work with a Python Flask backend (located in the backend directory of the original archive) and requires a MongoDB database for data persistence.

To use the frontend components:
1. Set up the backend API server
2. Configure the API endpoints in config.js
3. Open worker-management.html in a web browser
4. Ensure the backend server is running on the configured port (default: http://127.0.0.1:5000)