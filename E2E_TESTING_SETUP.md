# Playwright E2E Testing Framework Setup

This document describes the complete E2E testing framework setup for the dbt-Workbench project.

## Overview

The E2E testing framework provides:
- **Local execution**: One-command test runner with Docker Compose integration
- **CI/CD integration**: GitHub Actions workflow for automated testing
- **Artifact collection**: HTML reports, traces, screenshots, and JUnit XML
- **Clean repository**: No test artifacts committed to git

## Quick Start

### Run E2E Tests Locally

```bash
cd frontend
npm run test:e2e:docker
```

This command will:
1. Start the Docker Compose stack (frontend, backend, postgres)
2. Wait for services to be ready
3. Run all Playwright tests
4. Tear down the stack

### Run Tests Without Docker

If services are already running:

```bash
cd frontend
npm run test:e2e
```

### Other Useful Commands

```bash
# Install Playwright browsers
npm run e2e:install

# Run tests with UI mode
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug
```

## Project Structure

```
dbt-Workbench/
├── .github/workflows/
│   └── e2e-playwright.yml          # GitHub Actions workflow
├── frontend/
│   ├── playwright.config.ts         # Playwright configuration
│   ├── package.json                # Test scripts
│   ├── tests/e2e/                 # E2E test files
│   │   ├── dashboard.spec.ts       # Dashboard smoke tests
│   │   ├── models.spec.ts         # Models page tests
│   │   ├── lineage.spec.ts        # Lineage graph tests
│   │   ├── version-control.spec.ts # Version control tests
│   │   ├── plugins.spec.ts        # Plugins page tests
│   │   ├── run-history.spec.ts    # Run history tests
│   │   └── sidebar.spec.ts        # Sidebar behavior tests
│   └── test-results/              # Test outputs (gitignored)
├── scripts/
│   └── e2e.mjs                   # Docker Compose integration script
└── .gitignore                    # Excludes test artifacts
```

## Configuration

### Playwright Config (`frontend/playwright.config.ts`)

Key settings:
- **Base URL**: Configurable via `E2E_BASE_URL` environment variable (default: `http://localhost:3000`)
- **Retries**: 2 in CI, 0 locally
- **Workers**: 1 in CI, undefined locally
- **Reporters**: List, HTML, and JUnit (CI only)
- **Output Directory**: `frontend/test-results/`
- **Trace**: On first retry
- **Screenshots**: Only on failure
- **Video**: Retain on failure

### Environment Variables

- `E2E_BASE_URL`: Base URL for tests (default: `http://localhost:3000`)
- `CI`: Set to `true` in CI environments for CI-specific settings

## Test Suite

### Smoke Tests

Critical page smoke tests ensure core functionality:

1. **Dashboard** (`dashboard.spec.ts`)
   - Verifies page loads with heading
   - Checks system health status

2. **Models** (`models.spec.ts`)
   - Verifies models list loads
   - Confirms at least one model is displayed

3. **Lineage** (`lineage.spec.ts`)
   - Verifies lineage page loads
   - Checks graph container is visible

4. **Version Control** (`version-control.spec.ts`)
   - Verifies version control page loads
   - Checks repository information is displayed

### Existing Tests

- **Plugins** (`plugins.spec.ts`): Tests plugins page functionality
- **Run History** (`run-history.spec.ts`): Tests run history page
- **Sidebar** (`sidebar.spec.ts`): Tests sidebar behavior

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/e2e-playwright.yml`)

Triggers:
- Pull requests to `main` and `develop` branches
- Pushes to `main` branch

Steps:
1. Checkout code
2. Setup Node.js 20 with npm cache
3. Install frontend dependencies
4. Install Playwright browsers
5. Run E2E tests with Docker
6. Upload artifacts (even on failure):
   - Playwright HTML report
   - Test results
   - JUnit XML report
7. Publish test results to GitHub
8. Safety net: Ensure Docker Compose is down

## Testability Hooks

The following components have `data-testid` attributes for reliable test selection:

- **Main content area**: `data-testid="main-content"` (in `App.tsx`)
- **Sidebar**: `data-testid="sidebar"` (in `Sidebar.tsx`)
- **Lineage graph container**: `data-testid="lineage-graph-container"` (in `Lineage.tsx`)
- **Models list container**: `data-testid="models-list-container"` (in `Models.tsx`)

## Docker Integration

### E2E Runner Script (`scripts/e2e.mjs`)

The Node.js script orchestrates the full testing flow:

1. **Start Docker Compose**: `docker compose up -d --build`
2. **Wait for Services**:
   - Backend health endpoint: `http://localhost:8000/health`
   - Frontend: `http://localhost:3000`
   - Maximum wait time: 2 minutes
3. **Run Tests**: Executes Playwright with `E2E_BASE_URL=http://localhost:3000`
4. **Always Teardown**: `docker compose down -v` (even if tests fail)

## Git Configuration

### Ignored Files (`.gitignore`)

```
# Playwright E2E test artifacts
test-results/
playwright-report/
frontend/test-results/
frontend/playwright-report/
frontend/playwright.log
*.png
!assets/*.png
!assets/**/*.png
```

### Removed Tracked Files

The following files were removed from git tracking:
- `frontend/playwright.log`
- `frontend/run-history.png`
- `test-results/.last-run.json`

## Best Practices

### Writing Tests

1. **Use role-based selectors** when possible:
   ```typescript
   await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
   ```

2. **Use data-testid** for elements without clear roles:
   ```typescript
   await expect(page.getByTestId('lineage-graph-container')).toBeVisible();
   ```

3. **Avoid fixed timeouts** - use assertions instead:
   ```typescript
   // Bad
   await page.waitForTimeout(1000);
   
   // Good
   await expect(page.getByText('Loading')).not.toBeVisible();
   ```

4. **Use testInfo for screenshots** (if needed):
   ```typescript
   await page.screenshot({ path: testInfo.outputPath('screenshot.png') });
   ```

### Test Organization

- Group related tests with `test.describe()`
- Use descriptive test names
- Keep tests focused and independent
- Use page object pattern for complex interactions

## Troubleshooting

### Tests Fail Locally

1. Ensure Docker is running: `docker ps`
2. Check service logs: `docker compose logs`
3. Verify ports are available: `lsof -i :3000` and `lsof -i :8000`
4. Try running tests in debug mode: `npm run test:e2e:debug`

### Tests Fail in CI

1. Check GitHub Actions logs
2. Download artifacts for detailed reports
3. Review HTML report for visual debugging
4. Check traces for step-by-step execution

### Docker Compose Issues

1. Clean up: `docker compose down -v`
2. Rebuild: `docker compose up -d --build`
3. Check disk space: `docker system df`

## Future Enhancements

Potential improvements to consider:

1. **Additional browsers**: Add Firefox and WebKit projects if needed
2. **Visual regression**: Add visual comparison tests
3. **API mocking**: Mock API responses for faster tests
4. **Parallel execution**: Increase worker count for faster CI runs
5. **Test coverage**: Add more comprehensive test scenarios
6. **Performance tests**: Add page load performance metrics

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
