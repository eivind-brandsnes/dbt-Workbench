# GitHub Issues for Bugs Found in dbt-Workbench

This document contains all the bugs found during the analysis of the dbt-Workbench repository. Each issue can be created manually on GitHub using the provided content.

---

## Issue 1: Duplicate exception handler in package_manager.py

**Title:** Bug: Duplicate exception handler in package_manager.py

**Labels:** bug, code-quality

**Description:**
The file `backend/app/services/package_manager.py` contains duplicate exception handlers at lines 43-48. The second `except Exception as e` block is unreachable code and will never execute.

**Location:**
File: `backend/app/services/package_manager.py`
Lines: 43-48

**Code:**
```python
except Exception as e:
    logger.error(f"Failed to install package {package_name}: {e}")
    raise
except Exception as e:
    logger.error(f"Failed to install package {package_name}: {e}")
    raise
```

**Impact:**
- Dead code that will never execute
- Confusing for developers reading the code
- Potential maintenance issue if someone tries to modify error handling

**Expected Behavior:**
Only one exception handler should exist for the try block.

**Proposed Fix:**
Remove the duplicate exception handler block.

**Severity:** Low - Code quality issue, doesn't affect functionality

---

## Issue 2: Duplicate import in main.py

**Title:** Bug: Duplicate import of plugins router in main.py

**Labels:** bug, code-quality

**Description:**
The file `backend/app/main.py` contains a duplicate import of the `plugins` router at lines 27 and 28. The router is imported twice, which is unnecessary.

**Location:**
File: `backend/app/main.py`
Lines: 27-28

**Code:**
```python
from app.api.routes import plugins
from app.api.routes import plugins
```

**Impact:**
- Unnecessary duplicate import
- Confusing for developers reading the code
- Minor performance impact (negligible)

**Expected Behavior:**
Each module should be imported only once.

**Proposed Fix:**
Remove the duplicate import line.

**Severity:** Low - Code quality issue, doesn't affect functionality

---

## Issue 3: Potential race condition in scheduler_manager.py

**Title:** Bug: Potential race condition in scheduler_manager.py _start_attempt_async

**Labels:** bug, concurrency

**Description:**
The `_start_attempt_async` function in `backend/app/core/scheduler_manager.py` creates a database session, queries for a scheduled run, and then starts an async task. There's a potential race condition where the scheduled run could be deleted or modified between the query and the task execution.

**Location:**
File: `backend/app/core/scheduler_manager.py`
Lines: 117-131

**Code:**
```python
async def _start_attempt_async(scheduled_run_id: int) -> None:
    db = SessionLocal()
    try:
        db_run = (
            db.query(db_models.ScheduledRun)
            .filter(db_models.ScheduledRun.id == scheduled_run_id)
            .first()
        )
        if not db_run:
            return
        attempt = await scheduler_service.start_attempt_for_scheduled_run(db, db_run)
        if attempt and attempt.run_id:
            asyncio.create_task(executor.execute_run(attempt.run_id))
    finally:
        db.close()
```

**Impact:**
- If the scheduled run is deleted between the query and task execution, the executor may try to execute a non-existent run
- Could lead to inconsistent state in the database

**Expected Behavior:**
The scheduled run should be locked or validated at the time of execution.

**Proposed Fix:**
Use database row locking or add additional validation before executing the run.

**Severity:** Medium - Could cause inconsistent state in rare scenarios

---

## Issue 4: Missing error handling in git_service.py _ensure_repo

**Title:** Bug: Missing error handling in git_service.py _ensure_repo

**Labels:** bug, error-handling

**Description:**
The `_ensure_repo` function in `backend/app/services/git_service.py` raises HTTPException for various error conditions but doesn't handle all potential exceptions from GitPython operations. If an unexpected Git error occurs, it will propagate as an unhandled exception.

**Location:**
File: `backend/app/services/git_service.py`
Lines: 223-236

**Code:**
```python
def _ensure_repo(path: str) -> Repo:
    path_obj = Path(path)
    if not path_obj.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "git_not_configured", "message": "Repository connection not configured."},
        )
    try:
        return Repo(path_obj)
    except InvalidGitRepositoryError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "not_a_repository", "message": f"{path} is not a git repository."},
        ) from exc
```

**Impact:**
- Unhandled exceptions from GitPython could cause 500 errors
- Poor error messages for users
- Potential information leakage in error messages

**Expected Behavior:**
All GitPython exceptions should be caught and converted to appropriate HTTP responses.

**Proposed Fix:**
Add a catch-all exception handler for GitPython operations.

**Severity:** Medium - Could cause poor user experience

---

## Issue 5: Memory leak potential in artifact_watcher.py

**Title:** Bug: Potential memory leak in artifact_watcher.py version storage

**Labels:** bug, memory

**Description:**
The `ArtifactWatcher` class in `backend/app/services/artifact_watcher.py` stores versioned artifacts in memory with a configurable max_versions limit. However, the `_versions` dictionary stores full JSON content for each version, which could consume significant memory for large artifacts.

**Location:**
File: `backend/app/services/artifact_watcher.py`
Lines: 36-43, 106-112

**Code:**
```python
self._versions: Dict[str, List[ArtifactVersion]] = {
    filename: [] for filename in self.monitored_files
}

# In _load_artifact:
self._versions[filename].append(new_version)

# Trim old versions if needed
if len(self._versions[filename]) > self.max_versions:
    self._versions[filename] = self._versions[filename][-self.max_versions:]
```

**Impact:**
- For large dbt projects, manifest.json can be several MB
- Storing 10 versions could consume 100+ MB of memory
- No cleanup mechanism for old versions beyond the limit

**Expected Behavior:**
Memory usage should be bounded and predictable.

**Proposed Fix:**
Consider storing only checksums and metadata in memory, with full content loaded from disk when needed.

**Severity:** Medium - Could cause memory issues in large projects

---

## Issue 6: Missing null check in catalog_service.py _freshness

**Title:** Bug: Missing null check in catalog_service.py _freshness method

**Labels:** bug, null-safety

**Description:**
The `_freshness` method in `backend/app/services/catalog_service.py` doesn't properly handle null values for `max_loaded_at` before attempting to parse it as a datetime. This could cause a ValueError.

**Location:**
File: `backend/app/services/catalog_service.py`
Lines: 198-241

**Code:**
```python
def _freshness(self, catalog_node: Dict[str, Any]) -> Optional[catalog_schemas.FreshnessInfo]:
    freshness_meta = catalog_node.get("freshness") or {}
    max_loaded_at = freshness_meta.get("max_loaded_at") or catalog_node.get("max_loaded_at")
    # ...
    if max_loaded_at:
        try:
            max_loaded_time = datetime.fromisoformat(str(max_loaded_at))
        except ValueError:
            max_loaded_time = None
```

**Impact:**
- If `max_loaded_at` is an invalid datetime string, it will be set to None
- The error is caught but logged, which is correct
- However, the code doesn't distinguish between "no data" and "invalid data"

**Expected Behavior:**
Invalid datetime strings should be handled gracefully with appropriate logging.

**Proposed Fix:**
The current implementation is actually correct - it catches ValueError and sets max_loaded_time to None. This is not a bug.

**Severity:** N/A - Not a bug, code handles the error correctly

---

## Issue 7: Inconsistent error handling in sql_workspace_service.py

**Title:** Bug: Inconsistent error handling in sql_workspace_service.py execute_query

**Labels:** bug, error-handling

**Description:**
The `execute_query` method in `backend/app/services/sql_workspace_service.py` has inconsistent error handling. It catches `QueryCancelledError` and `QueryTimeoutError` but these custom exception classes are not defined in the file.

**Location:**
File: `backend/app/services/sql_workspace_service.py`
Lines: 424-447

**Code:**
```python
except QueryCancelledError:
    # ... handle cancellation
except QueryTimeoutError as exc:
    # ... handle timeout
```

**Impact:**
- If these exceptions are raised, they won't be caught properly
- The code will fail with NameError instead of handling the error condition

**Expected Behavior:**
Custom exception classes should be defined or standard exceptions should be used.

**Proposed Fix:**
Define the custom exception classes at the top of the file or use standard exceptions.

**Severity:** High - Will cause runtime errors when queries are cancelled or timeout

---

## Issue 8: Missing type annotations in frontend services

**Title:** Bug: Missing type annotations in frontend versionService.ts

**Labels:** bug, typescript

**Description:**
The `VersionService` class in `frontend/src/services/versionService.ts` has missing type annotations for several methods and properties. This reduces type safety and makes the code harder to maintain.

**Location:**
File: `frontend/src/services/versionService.ts`
Lines: 60, 88, 120

**Code:**
```typescript
removeUpdateListener(callback: (hasUpdates: boolean, response: VersionCheckResponse) => void): void {
    const index = this.listeners.indexOf(callback)  // Missing type annotation
    if (index > -1) {
      this.listeners.splice(index,1)
    }
  }

  // In checkForUpdates:
  const response = await api.get<VersionCheckResponse>('/artifacts/versions/check', {  // Missing type annotation
    params: {
      manifest_version: this.currentVersions['manifest.json'],
      catalog_version: this.currentVersions['catalog.json'],
      run_results_version: this.currentVersions['run_results.json']
    }
  })
```

**Impact:**
- Reduced type safety
- Harder to catch bugs at compile time
- Poor developer experience

**Expected Behavior:**
All variables and return values should have proper type annotations.

**Proposed Fix:**
Add proper type annotations for all variables and method return types.

**Severity:** Low - Code quality issue, doesn't affect runtime

---

## Issue 9: Potential XSS vulnerability in Lineage.tsx

**Title:** Bug: Potential XSS vulnerability in Lineage.tsx highlightMatch function

**Labels:** bug, security

**Description:**
The `highlightMatch` function in `frontend/src/pages/Lineage.tsx` uses `dangerouslySetInnerHTML` indirectly through JSX to render highlighted text. If the query or name contains malicious HTML/JavaScript, it could lead to XSS attacks.

**Location:**
File: `frontend/src/pages/Lineage.tsx`
Lines: 12-30

**Code:**
```typescript
const highlightMatch = (name: string, query: string) => {
  if (!query.trim()) return name
  const lower = name.toLowerCase()
  const needle = query.trim().toLowerCase()
  const index = lower.indexOf(needle)
  if (index === -1) return name

  const before = name.slice(0, index)
  const match = name.slice(index, index + needle.length)
  const after = name.slice(index + needle.length)

  return (
    <>
      {before}
      <mark className="bg-accent/30 text-accent font-semibold rounded px-0.5">{match}</mark>
      {after}
    </>
  )
}
```

**Impact:**
- If user-controlled input is used for highlighting, malicious scripts could be injected
- Could lead to data theft or session hijacking

**Expected Behavior:**
User input should be properly escaped before rendering.

**Proposed Fix:**
Use a proper HTML escaping library or React's built-in escaping.

**Severity:** High - Security vulnerability

---

## Issue 10: Missing error handling in AuthContext.tsx

**Title:** Bug: Missing error handling in AuthContext.tsx switchWorkspace

**Labels:** bug, error-handling

**Description:**
The `switchWorkspace` function in `frontend/src/context/AuthContext.tsx` doesn't properly handle errors when switching workspaces. If the API call fails, the error is silently ignored.

**Location:**
File: `frontend/src/context/AuthContext.tsx`
Lines: 161-196

**Code:**
```typescript
const switchWorkspace = async (workspaceId: number) => {
    // Always refresh the list so dropdowns stay accurate and pages can react
    if (!state.isAuthEnabled) {
      const available = await WorkspaceService.listWorkspaces()
      const selected = available.find(w => w.id === workspaceId)
      if (!selected) {
        throw new Error('Workspace not found')
      }
      storeWorkspaceId(selected.id)
      setState(prev => ({
        ...prev,
        activeWorkspace: selected,
        workspaces: available,
      }))
    } else {
      const res = await api.post<LoginResponse>('/auth/switch-workspace', null, {
        params: { workspace_id: workspaceId },
      })
      storeWorkspaceId(workspaceId)
      applyLogin(res.data)
      try {
        const available = await WorkspaceService.listWorkspaces()
        const selected = available.find(w => w.id === workspaceId)
        setState(prev => ({
          ...prev,
          activeWorkspace: selected ?? prev.activeWorkspace,
          workspaces: available,
        }))
      } catch {
        // Non-fatal; state already updated from switch response
      }
    }
```

**Impact:**
- If workspace switch fails, user won't know why
- State could be left in an inconsistent state
- Poor user experience

**Expected Behavior:**
Errors should be caught and displayed to the user.

**Proposed Fix:**
Add proper error handling with user feedback.

**Severity:** Medium - Poor user experience

---

## Issue 11: Missing cleanup in RunCommand.tsx

**Title:** Bug: Missing cleanup in RunCommand.tsx waitForRunCompletion

**Labels:** bug, cleanup

**Description:**
The `waitForRunCompletion` function in `frontend/src/components/RunCommand.tsx` doesn't clean up the polling interval if the component unmounts. This could lead to memory leaks and unnecessary API calls.

**Location:**
File: `frontend/src/components/RunCommand.tsx`
Lines: 61-88

**Code:**
```typescript
const waitForRunCompletion = async (runId: string, initialStatus?: RunStatus) => {
    let status: RunStatus | undefined = initialStatus;
    const isTerminal = (state?: RunStatus) =>
      state === 'succeeded' || state === 'failed' || state === 'cancelled';

    while (!isTerminal(status)) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!isMountedRef.current) {
        return;
      }
      try {
        const updated = await ExecutionService.getRunStatus(runId);
        status = updated.status;
      } catch (err) {
        if (isMountedRef.current) {
          setError('Failed to monitor run status');
          setIsLoading(false);
          setPendingCommand(null);
        }
        return;
      }
    }

    if (isMountedRef.current) {
      setIsLoading(false);
      setPendingCommand(null);
    }
  };
```

**Impact:**
- If component unmounts while polling, the loop continues
- Unnecessary API calls continue after component is gone
- Potential memory leak

**Expected Behavior:**
Polling should stop when component unmounts.

**Proposed Fix:**
The code actually checks `isMountedRef.current` and returns early if false, so this is handled correctly. This is not a bug.

**Severity:** N/A - Not a bug, code handles cleanup correctly

---

## Issue 12: Inconsistent datetime handling in catalog_service.py

**Title:** Bug: Inconsistent datetime handling in catalog_service.py

**Labels:** bug, datetime

**Description:**
The `catalog_service.py` file uses both `datetime.now(timezone.utc)` and `datetime.utcnow()` inconsistently. This can lead to timezone-related bugs.

**Location:**
File: `backend/app/services/catalog_service.py`
Lines: 99, 225, 226

**Code:**
```python
# Line 99:
existing.updated_at = datetime.now(timezone.utc)

# Line 225-226:
now = datetime.now(timezone.utc)
# vs in sql_workspace_service.py line 358, 381:
now = datetime.utcnow()
```

**Impact:**
- Inconsistent timezone handling across the codebase
- Potential bugs when comparing datetimes
- Confusing for developers

**Expected Behavior:**
All datetime operations should use timezone-aware UTC datetimes consistently.

**Proposed Fix:**
Standardize on `datetime.now(timezone.utc)` throughout the codebase.

**Severity:** Medium - Could cause timezone-related bugs

---

## Issue 13: Missing validation in workspaceStorage.ts

**Title:** Bug: Missing validation in workspaceStorage.ts loadWorkspaceId

**Labels:** bug, validation

**Description:**
The `loadWorkspaceId` function in `frontend/src/storage/workspaceStorage.ts` doesn't validate that the parsed workspace ID is a positive integer. This could lead to invalid workspace IDs being used.

**Location:**
File: `frontend/src/storage/workspaceStorage.ts`
Lines: 15-24

**Code:**
```typescript
export function loadWorkspaceId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}
```

**Impact:**
- Negative or zero workspace IDs could be used
- Could lead to API errors or unexpected behavior
- Poor user experience

**Expected Behavior:**
Workspace ID should be validated to be a positive integer.

**Proposed Fix:**
Add validation to ensure workspace ID is a positive integer.

**Severity:** Low - Could cause API errors

---

## Issue 14: Missing error handling in versionService.ts checkForUpdates

**Title:** Bug: Missing error handling in versionService.ts checkForUpdates

**Labels:** bug, error-handling

**Description:**
The `checkForUpdates` method in `frontend/src/services/versionService.ts` catches errors but doesn't notify listeners about the failure. Listeners won't know if the version check failed.

**Location:**
File: `frontend/src/services/versionService.ts`
Lines: 69-97

**Code:**
```typescript
private async checkForUpdates(): Promise<void> {
    try {
      const response = await api.get<VersionCheckResponse>('/artifacts/versions/check', {
        params: {
          manifest_version: this.currentVersions['manifest.json'],
          catalog_version: this.currentVersions['catalog.json'],
          run_results_version: this.currentVersions['run_results.json']
        }
      })

      const versionData = response.data

      // Update current versions if there are updates
      if (versionData.any_updates) {
        this.currentVersions = { ...versionData.current_versions }
      }

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(versionData.any_updates, versionData)
        } catch (error) {
          console.error('Error in version update listener:', error)
        }
      })
    } catch (error) {
      console.error('Failed to check for version updates:', error)
      // Listeners are NOT notified of the failure
    }
  }
```

**Impact:**
- Listeners won't know if version check failed
- UI may not update correctly
- Poor user experience

**Expected Behavior:**
Listeners should be notified of failures as well as successes.

**Proposed Fix:**
Notify listeners with an error state when version check fails.

**Severity:** Medium - Poor user experience

---

## Issue 15: Potential SQL injection in sql_workspace_service.py

**Title:** Bug: Potential SQL injection in sql_workspace_service.py _is_destructive

**Labels:** bug, security

**Description:**
The `_is_destructive` method in `backend/app/services/sql_workspace_service.py` uses simple string matching to detect destructive SQL statements. This approach is fragile and could be bypassed.

**Location:**
File: `backend/app/services/sql_workspace_service.py`
Lines: 128-140

**Code:**
```python
def _is_destructive(self, sql: str) -> bool:
    normalized = " ".join(sql.strip().lower().split())
    destructive_keywords = (
        "drop ",
        "alter ",
        "truncate ",
        "create ",
        "rename ",
        "grant ",
        "revoke ",
        "delete ",
    )
    return any(k in normalized for k in destructive_keywords)
```

**Impact:**
- Can be bypassed with SQL comments or case variations
- False positives for legitimate queries containing these keywords
- Not a true security issue since queries are parameterized, but still problematic

**Expected Behavior:**
Destructive query detection should be more robust.

**Proposed Fix:**
Use a proper SQL parser to detect destructive statements.

**Severity:** Low - Not a direct security issue but could cause false positives/negatives

---

## Issue 16: Missing cleanup in artifact_watcher.py

**Title:** Bug: Missing cleanup in artifact_watcher.py stop_watching

**Labels:** bug, cleanup

**Description:**
The `stop_watching` method in `backend/app/services/artifact_watcher.py` doesn't clear the version cache when stopping. This could lead to stale data being used if the watcher is restarted.

**Location:**
File: `backend/app/services/artifact_watcher.py`
Lines: 149-155

**Code:**
```python
def stop_watching(self):
    """Stop the file system watcher."""
    if self._observer is not None:
        self._observer.stop()
        self._observer.join()
        self._observer = None
        logger.info("Stopped artifact file watcher")
```

**Impact:**
- Stale version data may persist after restart
- Could lead to incorrect version information
- Memory not freed

**Expected Behavior:**
Version cache should be cleared when watcher stops.

**Proposed Fix:**
Clear the `_versions` and `_current_versions` dictionaries when stopping.

**Severity:** Low - Could cause stale data issues

---

## Issue 17: Missing validation in AuthContext.tsx login

**Title:** Bug: Missing validation in AuthContext.tsx login

**Labels:** bug, validation

**Description:**
The `login` function in `frontend/src/context/AuthContext.tsx` doesn't validate the response from the login API before applying it. If the API returns invalid data, it could cause issues.

**Location:**
File: `frontend/src/context/AuthContext.tsx`
Lines: 144-147

**Code:**
```typescript
const login = async (username: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { username, password })
    applyLogin(res.data)
  }
```

**Impact:**
- Invalid API responses could cause runtime errors
- Poor error handling
- Security risk if malicious data is accepted

**Expected Behavior:**
API response should be validated before being applied.

**Proposed Fix:**
Add validation for the login response structure.

**Severity:** Medium - Could cause runtime errors

---

## Issue 18: Inconsistent error handling in Models.tsx

**Title:** Bug: Inconsistent error handling in Models.tsx loadModels

**Labels:** bug, error-handling

**Description:**
The `loadModels` function in `frontend/src/pages/Models.tsx` catches errors but doesn't provide any user feedback. Users won't know if model loading fails.

**Location:**
File: `frontend/src/pages/Models.tsx`
Lines: 13-15

**Code:**
```typescript
const loadModels = useCallback(() => {
    api.get<ModelSummary[]>('/models').then((res) => setModels(res.data)).catch(() => setModels([]))
  }, [])
```

**Impact:**
- Users won't know if model loading fails
- Empty state could be confusing
- Poor user experience

**Expected Behavior:**
Errors should be caught and displayed to the user.

**Proposed Fix:**
Add error state and display error messages to users.

**Severity:** Low - Poor user experience

---

## Issue 19: Missing null check in lineage_service.py _limit_depth

**Title:** Bug: Missing null check in lineage_service.py _limit_depth

**Labels:** bug, null-safety

**Description:**
The `_limit_depth` method in `backend/app/services/lineage_service.py` doesn't properly handle the case where `reverse.get(node.id)` returns an empty list. This could cause issues with the indegree calculation.

**Location:**
File: `backend/app/services/lineage_service.py`
Lines: 121-147

**Code:**
```python
def _limit_depth(self, nodes: List[dbt_schemas.LineageNode], edges: List[dbt_schemas.LineageEdge], max_depth: Optional[int]) -> Tuple[List[dbt_schemas.LineageNode], List[dbt_schemas.LineageEdge]]:
    if not max_depth or max_depth < 1:
        return nodes, edges

    adjacency: Dict[str, List[str]] = defaultdict(list)
    reverse: Dict[str, List[str]] = defaultdict(list)
    for edge in edges:
        adjacency[edge.source].append(edge.target)
        reverse[edge.target].append(edge.source)

    indegree_zero = [node.id for node in nodes if not reverse.get(node.id) or [n.id for n in nodes]]
```

**Impact:**
- The condition `not reverse.get(node.id)` will be False if the list is empty
- Could lead to incorrect graph traversal
- Potential bugs in lineage visualization

**Expected Behavior:**
Empty lists should be treated the same as missing keys.

**Proposed Fix:**
Change the condition to `not reverse.get(node.id)` to `not reverse.get(node.id)` (this is actually correct - empty list is falsy). Wait, let me re-read...

Actually, looking at line 131 more carefully:
```python
indegree_zero = [node.id for node in nodes if not reverse.get(node.id) or [n.id for n in nodes]]
```

This is a bug! The condition `not reverse.get(node.id)` will be False for an empty list `[]`, but the code then falls back to `[n.id for n in nodes]` which is wrong. It should be:
```python
indegree_zero = [node.id for node in nodes if not reverse.get(node.id)]
```

**Severity:** Medium - Could cause incorrect lineage visualization

---

## Issue 20: Missing error handling in FileTree.tsx

**Title:** Bug: Missing error handling in FileTree.tsx readExpandedFromStorage

**Labels:** bug, error-handling

**Description:**
The `readExpandedFromStorage` function in `frontend/src/components/FileTree.tsx` catches errors when parsing JSON but doesn't handle the case where the parsed data is not an array.

**Location:**
File: `frontend/src/components/FileTree.tsx`
Lines: 51-64

**Code:**
```typescript
const readExpandedFromStorage = (key: string) => {
    if (typeof window === 'undefined') return new Set<string>()
    const raw = sessionStorage.getItem(`file-tree-expanded:${key}`)
    if (!raw) return new Set<string>()
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed)
      }
    } catch {
      return new Set<string>()
    }
    return new Set<string>()
  }
```

**Impact:**
- If storage contains invalid data, it returns an empty set
- This is actually correct behavior
- No bug here

**Severity:** N/A - Not a bug, code handles errors correctly

---

## Summary

Total bugs found: 17 (after removing false positives)

### Severity Breakdown:
- High: 2 (Security vulnerabilities)
- Medium: 8 (Could cause functional issues)
- Low: 7 (Code quality issues)

### Category Breakdown:
- Security: 2
- Error Handling: 5
- Code Quality: 4
- Concurrency: 1
- Memory: 1
- Validation: 2
- Datetime: 1
- Null Safety: 1

### Files with Most Bugs:
1. `backend/app/services/package_manager.py` - 1 bug
2. `backend/app/main.py` - 1 bug
3. `backend/app/core/scheduler_manager.py` - 1 bug
4. `backend/app/services/git_service.py` - 1 bug
5. `backend/app/services/artifact_watcher.py` - 2 bugs
6. `backend/app/services/sql_workspace_service.py` - 2 bugs
7. `backend/app/services/catalog_service.py` - 1 bug
8. `frontend/src/services/versionService.ts` - 2 bugs
9. `frontend/src/context/AuthContext.tsx` - 2 bugs
10. `frontend/src/pages/Lineage.tsx` - 1 bug
11. `frontend/src/components/RunCommand.tsx` - 0 bugs (false positive)
12. `frontend/src/pages/Models.tsx` - 1 bug
13. `frontend/src/storage/workspaceStorage.ts` - 1 bug
14. `frontend/src/components/FileTree.tsx` - 0 bugs (false positive)
15. `backend/app/services/lineage_service.py` - 1 bug
