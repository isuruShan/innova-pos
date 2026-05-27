/**
 * Migration management API routes
 * Super Admin only
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('@innovapos/shared-middleware');
const fs = require('fs').promises;
const path = require('path');

// Get list of available migrations
router.get('/', protect, authorize('superadmin'), async (req, res) => {
  try {
    const migrationsDir = path.join(__dirname, '../../../scripts/migrations');
    const files = await fs.readdir(migrationsDir);
    
    const migrations = files
      .filter(f => f.endsWith('.js'))
      .map(f => ({
        name: f.replace('.js', ''),
        filename: f,
        path: path.join(migrationsDir, f)
      }));
    
    res.json({
      success: true,
      migrations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute a specific migration
router.post('/execute/:migrationName', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { migrationName } = req.params;
    const migrationPath = path.join(
      __dirname,
      '../../../scripts/migrations',
      `${migrationName}.js`
    );
    
    // Check if migration file exists
    try {
      await fs.access(migrationPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Migration not found'
      });
    }
    
    // Load and run migration
    const migration = require(migrationPath);
    
    if (typeof migration.runMigration !== 'function') {
      return res.status(400).json({
        success: false,
        error: 'Invalid migration file - missing runMigration function'
      });
    }
    
    // Execute migration
    const result = await migration.runMigration();
    
    // Log migration execution
    console.log(`[Migration] ${migrationName} executed by ${req.user.email}:`, result);
    
    res.json(result);
  } catch (error) {
    console.error('Migration execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
