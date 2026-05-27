import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Play, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';

/**
 * Database Migrations Management Page
 * Super Admin Only
 * 
 * Allows execution of database migration scripts with UI feedback
 */
export default function MigrationsPage() {
  const queryClient = useQueryClient();
  const [executionResult, setExecutionResult] = useState(null);

  // Fetch available migrations
  const { data: migrationsData, isLoading } = useQuery({
    queryKey: ['migrations'],
    queryFn: async () => {
      const res = await fetch('/api/migrations');
      if (!res.ok) throw new Error('Failed to load migrations');
      return res.json();
    }
  });

  // Execute migration mutation
  const executeMigration = useMutation({
    mutationFn: async (migrationName) => {
      const res = await fetch(`/api/migrations/execute/${migrationName}`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: (data, migrationName) => {
      setExecutionResult({ migrationName, ...data });
      queryClient.invalidateQueries(['migrations']);
    },
    onError: (error, migrationName) => {
      setExecutionResult({
        migrationName,
        success: false,
        error: error.message
      });
    }
  });

  const handleRunMigration = (migrationName) => {
    if (confirm(`Are you sure you want to run migration: ${migrationName}?\n\nThis will modify the database.`)) {
      setExecutionResult(null);
      executeMigration.mutate(migrationName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const migrations = migrationsData?.migrations || [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">Database Migrations</h1>
        </div>
        <p className="text-gray-600">
          Manage and execute database migration scripts. Use with caution - these modify your database.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-orange-900">Super Admin Only</h3>
            <p className="text-sm text-orange-700 mt-1">
              Migrations modify your database schema and data. Always backup your database before running migrations
              in production. Test migrations in development first.
            </p>
          </div>
        </div>
      </div>

      {/* Execution Result */}
      {executionResult && (
        <div className={`border rounded-lg p-4 mb-6 ${
          executionResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {executionResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${
                executionResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {executionResult.success ? 'Migration Successful' : 'Migration Failed'}
              </h3>
              <p className={`text-sm mt-1 ${
                executionResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                <strong>Migration:</strong> {executionResult.migrationName}
              </p>
              {executionResult.message && (
                <p className={`text-sm mt-1 ${
                  executionResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {executionResult.message}
                </p>
              )}
              {executionResult.error && (
                <p className="text-sm mt-1 text-red-700 font-mono bg-red-100 p-2 rounded mt-2">
                  {executionResult.error}
                </p>
              )}
              {executionResult.tenantsUpdated !== undefined && (
                <div className="mt-2 text-sm text-green-700">
                  <div>✅ Tenants updated: {executionResult.tenantsUpdated}</div>
                  {executionResult.errors > 0 && (
                    <div>❌ Errors: {executionResult.errors}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Migrations List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Available Migrations ({migrations.length})</h2>
        </div>

        {migrations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No migrations available
          </div>
        ) : (
          <div className="divide-y">
            {migrations.map((migration) => (
              <div key={migration.name} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{migration.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 font-mono">
                      {migration.filename}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRunMigration(migration.name)}
                    disabled={executeMigration.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {executeMigration.isPending && executeMigration.variables === migration.name ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Migration
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Migration Guidelines</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Migrations are <strong>idempotent</strong> - safe to run multiple times</li>
          <li>• Always <strong>backup your database</strong> before running in production</li>
          <li>• Test migrations in <strong>development environment</strong> first</li>
          <li>• Monitor server logs during and after migration execution</li>
          <li>• Contact support if a migration fails or produces unexpected results</li>
        </ul>
      </div>
    </div>
  );
}
