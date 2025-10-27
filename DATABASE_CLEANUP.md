# Database Cleanup Tools

This directory contains tools to safely clear experiment data from the Gazalyzer database while preserving all relationships between users, pictures, and other data.

## 🛡️ Safety Features

- **Preserves Relationships**: Pictures and users are never deleted
- **Automatic Updates**: User experiment counts are automatically reset
- **Confirmation Required**: Dangerous operations require explicit confirmation
- **Detailed Logging**: All operations provide detailed feedback

## 🚀 Quick Start

### Option 1: Command Line Script

1. **Set your Convex URL**:
   ```bash
   export CONVEX_URL="https://your-convex-url.convex.cloud"
   ```

2. **Check database statistics**:
   ```bash
   node clear-database.js stats
   ```

3. **Clear empty experiments** (recommended first step):
   ```bash
   node clear-database.js clear-empty
   ```

### Option 2: Admin Panel (React Component)

Add the `AdminPanel` component to your React app for a web-based interface.

## 📊 Available Commands

### `stats`
Shows comprehensive database statistics:
- Total experiments, pictures, users
- Experiments by type and status
- Number of empty experiments

```bash
node clear-database.js stats
```

### `clear-empty`
Removes experiments with empty gaze data (failed calibrations):
- Experiments with 0 gaze points
- Experiments where all gaze points are at (0,0)
- Safe operation - only removes failed experiments

```bash
node clear-database.js clear-empty
```

### `clear-picture [pictureId]`
Removes all experiments for a specific picture:
- Useful for cleaning up test data
- Preserves the picture itself

```bash
node clear-database.js clear-picture j1234567890abcdef
```

### `clear-user [userId]`
Removes all experiments for a specific user:
- Resets user's experiment count to 0
- Preserves user account and pictures

```bash
node clear-database.js clear-user u1234567890abcdef
```

### `clear-all-confirmed`
⚠️ **DANGER**: Removes ALL experiments from the database:
- Requires typing "DELETE_ALL_EXPERIMENTS" to confirm
- Resets all user experiment counts
- Preserves pictures and users

```bash
node clear-database.js clear-all-confirmed
```

### `cleanup-duplicates [pictureId]`
Removes duplicate experiments for a picture:
- Keeps only the most recent experiment per type/user
- Useful for cleaning up test runs

```bash
node clear-database.js cleanup-duplicates j1234567890abcdef
```

## 🔧 Convex Functions Added

The following functions have been added to `convex/experiments.ts`:

- `getDatabaseStats()` - Get comprehensive database statistics
- `clearEmptyExperiments()` - Remove experiments with empty gaze data
- `clearPictureExperiments(pictureId)` - Clear experiments for a specific picture
- `clearUserExperiments(userId)` - Clear experiments for a specific user
- `clearAllExperiments(confirm)` - Clear all experiments (requires confirmation)
- `cleanupDuplicateExperiments(pictureId)` - Remove duplicate experiments

## 📋 Recommended Cleanup Workflow

1. **Check current state**:
   ```bash
   node clear-database.js stats
   ```

2. **Clear empty experiments** (safest first step):
   ```bash
   node clear-database.js clear-empty
   ```

3. **Clean up specific test data** (if needed):
   ```bash
   node clear-database.js clear-picture [pictureId]
   ```

4. **Verify results**:
   ```bash
   node clear-database.js stats
   ```

## ⚠️ Important Notes

- **Backup First**: Consider backing up your database before major cleanup operations
- **Test Environment**: Test these tools in a development environment first
- **Empty Experiments**: These are experiments where WebGazer failed to collect gaze data
- **User Counts**: User experiment counts are automatically updated after cleanup
- **Pictures Preserved**: All uploaded pictures remain in the database

## 🐛 Troubleshooting

### "ConvexHttpClient is not defined"
Make sure you have the Convex client installed:
```bash
npm install convex
```

### "CONVEX_URL not set"
Set your Convex deployment URL:
```bash
export CONVEX_URL="https://your-convex-url.convex.cloud"
```

### Permission Errors
Ensure your Convex deployment has the necessary permissions for the cleanup functions.

## 📞 Support

If you encounter issues with the cleanup tools, check:
1. Convex deployment logs
2. Browser console for errors
3. Network connectivity to Convex
4. Function permissions in your Convex dashboard


