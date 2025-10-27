#!/usr/bin/env node

/**
 * Database Cleanup Script for Gazalyzer
 * 
 * This script provides various options to clear experiment data while preserving
 * the relationships between users, pictures, and other data.
 * 
 * Usage:
 *   node clear-database.js [command] [options]
 * 
 * Commands:
 *   stats                    - Show database statistics
 *   clear-empty             - Clear experiments with empty gaze data
 *   clear-picture [id]      - Clear all experiments for a specific picture
 *   clear-user [id]         - Clear all experiments for a specific user
 *   clear-all               - Clear ALL experiments (requires confirmation)
 *   cleanup-duplicates [id] - Clean up duplicate experiments for a picture
 */

const { ConvexHttpClient } = require("convex/browser");

// Initialize Convex client
const client = new ConvexHttpClient(process.env.CONVEX_URL || "https://your-convex-url.convex.cloud");

async function runCommand() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'stats':
        await showStats();
        break;
      
      case 'clear-empty':
        await clearEmptyExperiments();
        break;
      
      case 'clear-picture':
        if (!arg) {
          console.error('❌ Picture ID required for clear-picture command');
          process.exit(1);
        }
        await clearPictureExperiments(arg);
        break;
      
      case 'clear-user':
        if (!arg) {
          console.error('❌ User ID required for clear-user command');
          process.exit(1);
        }
        await clearUserExperiments(arg);
        break;
      
      case 'clear-all':
        await clearAllExperiments();
        break;
      
      case 'cleanup-duplicates':
        if (!arg) {
          console.error('❌ Picture ID required for cleanup-duplicates command');
          process.exit(1);
        }
        await cleanupDuplicateExperiments(arg);
        break;
      
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function showStats() {
  console.log('📊 Database Statistics:');
  console.log('========================');
  
  const stats = await client.query("experiments:getDatabaseStats", {});
  
  console.log(`Total Experiments: ${stats.totalExperiments}`);
  console.log(`Total Pictures: ${stats.totalPictures}`);
  console.log(`Total Users: ${stats.totalUsers}`);
  console.log(`Empty Experiments: ${stats.emptyExperiments}`);
  
  console.log('\nExperiments by Type:');
  Object.entries(stats.experimentsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nExperiments by Status:');
  Object.entries(stats.experimentsByStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

async function clearEmptyExperiments() {
  console.log('🧹 Clearing experiments with empty gaze data...');
  
  const result = await client.mutation("experiments:clearEmptyExperiments", {});
  
  console.log(`✅ ${result.message}`);
  console.log(`   Deleted ${result.deletedCount} experiments`);
}

async function clearPictureExperiments(pictureId) {
  console.log(`🧹 Clearing all experiments for picture: ${pictureId}`);
  
  const result = await client.mutation("experiments:clearPictureExperiments", {
    pictureId: pictureId
  });
  
  console.log(`✅ ${result.message}`);
  console.log(`   Deleted ${result.deletedCount} experiments`);
}

async function clearUserExperiments(userId) {
  console.log(`🧹 Clearing all experiments for user: ${userId}`);
  
  const result = await client.mutation("experiments:clearUserExperiments", {
    userId: userId
  });
  
  console.log(`✅ ${result.message}`);
  console.log(`   Deleted ${result.deletedCount} experiments`);
}

async function clearAllExperiments() {
  console.log('⚠️  WARNING: This will delete ALL experiments from the database!');
  console.log('   Pictures and users will be preserved, but all experiment data will be lost.');
  
  // In a real implementation, you might want to add a confirmation prompt
  console.log('   To confirm, run: node clear-database.js clear-all-confirmed');
  
  if (process.argv[2] !== 'clear-all-confirmed') {
    console.log('   Use "clear-all-confirmed" as the command to actually perform the deletion.');
    return;
  }
  
  console.log('🗑️  Clearing ALL experiments...');
  
  const result = await client.mutation("experiments:clearAllExperiments", {
    confirm: "DELETE_ALL_EXPERIMENTS"
  });
  
  console.log(`✅ ${result.message}`);
  console.log(`   Deleted ${result.deletedCount} experiments`);
}

async function cleanupDuplicateExperiments(pictureId) {
  console.log(`🧹 Cleaning up duplicate experiments for picture: ${pictureId}`);
  
  const result = await client.mutation("experiments:cleanupDuplicateExperiments", {
    pictureId: pictureId
  });
  
  console.log(`✅ ${result.message}`);
  if (result.deletedCount > 0) {
    console.log(`   Deleted ${result.deletedCount} duplicate experiments`);
    console.log(`   Kept experiment: ${result.keptExperimentId}`);
  }
}

function showHelp() {
  console.log(`
🗃️  Gazalyzer Database Cleanup Tool
====================================

Usage: node clear-database.js [command] [options]

Commands:
  stats                    Show database statistics
  clear-empty             Clear experiments with empty gaze data
  clear-picture [id]      Clear all experiments for a specific picture
  clear-user [id]         Clear all experiments for a specific user
  clear-all               Clear ALL experiments (requires confirmation)
  cleanup-duplicates [id] Clean up duplicate experiments for a picture

Examples:
  node clear-database.js stats
  node clear-database.js clear-empty
  node clear-database.js clear-picture j1234567890abcdef
  node clear-database.js clear-user u1234567890abcdef
  node clear-database.js clear-all-confirmed

Environment Variables:
  CONVEX_URL              Your Convex deployment URL (required)

Safety Notes:
  - All commands preserve pictures and users
  - Only experiment data is deleted
  - User experiment counts are automatically updated
  - Use 'stats' command first to see what will be affected
`);
}

// Run the command
runCommand();


