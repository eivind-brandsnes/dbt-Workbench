import React, { useState, useEffect, useRef } from 'react';
import { RunDetail, LogMessage, PackagesCheckResponse } from '../types';
import { ExecutionService } from '../services/executionService';
import { StatusBadge } from './StatusBadge';

interface DepsModalProps {
  packagesCheck: PackagesCheckResponse;
  projectPath?: string;
  onInstallComplete: () => void;
  onCancel: () => void;
}

export const DepsModal: React.FC<DepsModalProps> = ({
  packagesCheck,
  projectPath,
  onInstallComplete,
  onCancel,
}) => {
  const [installing, setInstalling] = useState(false);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);

    try {
      const result = await ExecutionService.installPackages(projectPath);
      setRunDetail(result);

      // Set up log streaming
      const eventSource = ExecutionService.createLogStream(result.run_id);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (event.type === 'log') {
          try {
            const logMessage: LogMessage = JSON.parse(event.data);
            setLogs(prev => [...prev, logMessage.message]);
          } catch (err) {
            console.error('Failed to parse log message:', err);
          }
        }
      };

      // Poll for completion
      const statusInterval = setInterval(async () => {
        try {
          const status = await ExecutionService.getRunStatus(result.run_id);
          setRunDetail(prev => prev ? { ...prev, ...status } : null);

          if (['succeeded', 'failed', 'cancelled'].includes(status.status)) {
            clearInterval(statusInterval);
            eventSource.close();

            if (status.status === 'succeeded') {
              setInstalling(false);
            } else {
              setInstalling(false);
              setError(status.error_message || 'Installation failed');
            }
          }
        } catch (err) {
          console.error('Failed to update status:', err);
        }
      }, 2000);

      return () => {
        clearInterval(statusInterval);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start installation');
      setInstalling(false);
    }
  };

  const primaryButtonClassName = "inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-50";
  const secondaryButtonClassName = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Missing dbt Packages
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {packagesCheck.missing_packages.length} of {packagesCheck.packages_required.length} required packages are not installed
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            disabled={installing}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!installing && !runDetail && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Missing Packages</h3>
                <ul className="space-y-2">
                  {packagesCheck.missing_packages.map((pkg) => (
                    <li key={pkg} className="flex items-center gap-2 text-sm">
                      <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-slate-700 dark:text-slate-300">{pkg}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Installed Packages</h3>
                <ul className="space-y-2">
                  {packagesCheck.packages_installed.map((pkg) => (
                    <li key={pkg} className="flex items-center gap-2 text-sm">
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-slate-700 dark:text-slate-300">{pkg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onCancel}
                className={secondaryButtonClassName}
                disabled={installing}
              >
                Cancel
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                className={primaryButtonClassName}
              >
                Install Packages
              </button>
            </div>
          </>
        )}

        {installing && runDetail && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <StatusBadge status={runDetail.status} />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Installing dbt packages...
              </span>
            </div>

            <div className="mt-4 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Installation Logs</h3>
                  <label className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="mr-1"
                    />
                    Auto-scroll
                  </label>
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm flex-1 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-gray-500">Waiting for logs...</p>
                  ) : (
                    logs.map((line, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>

            {runDetail.error_message && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {runDetail.error_message}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3">
              {runDetail.status === 'succeeded' && (
                <button
                  onClick={onInstallComplete}
                  className={primaryButtonClassName}
                >
                  Continue
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
