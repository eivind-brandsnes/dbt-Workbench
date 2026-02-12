
import asyncio
import pytest
from datetime import datetime, timezone
from pathlib import Path
from app.schemas.execution import DbtCommand, RunDetail, RunStatus
from app.services.dbt_executor import DbtExecutor

def test_get_dbt_command_docs_generate():
    executor = DbtExecutor()
    cmd = executor._get_dbt_command(DbtCommand.DOCS_GENERATE, {})
    # Should be ['dbt', 'docs', 'generate', ...others]
    assert cmd[:3] == ['dbt', 'docs', 'generate']

def test_get_dbt_command_run():
    executor = DbtExecutor()
    cmd = executor._get_dbt_command(DbtCommand.RUN, {})
    assert cmd[:2] == ['dbt', 'run']

def test_dbt_commmand_profile():
    executor = DbtExecutor()
    cmd = executor._get_dbt_command(DbtCommand.RUN, {"profile": "my_profile"})
    assert "--profile" in cmd
    idx = cmd.index("--profile")
    assert cmd[idx+1] == "my_profile"


def test_stream_logs_emits_error_when_no_output():
    executor = DbtExecutor()
    run_id = "test-run-error"
    executor.run_history[run_id] = RunDetail(
        run_id=run_id,
        command=DbtCommand.RUN,
        status=RunStatus.FAILED,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        duration_seconds=0.0,
        description="",
        error_message="boom",
        parameters={},
        log_lines=[],
    )

    async def _collect_logs():
        messages = []
        async for log in executor.stream_logs(run_id):
            messages.append(log)
        return messages

    messages = asyncio.run(_collect_logs())

    assert any("boom" in log.message for log in messages)
    assert messages[-1].line_number == 1


def test_stream_logs_adds_terminal_message_without_error():
    executor = DbtExecutor()
    run_id = "test-run-success"
    executor.run_history[run_id] = RunDetail(
        run_id=run_id,
        command=DbtCommand.RUN,
        status=RunStatus.SUCCEEDED,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        duration_seconds=0.0,
        description="",
        error_message=None,
        parameters={},
        log_lines=[],
    )

    async def _collect_logs():
        messages = []
        async for log in executor.stream_logs(run_id):
            messages.append(log)
        return messages

    messages = asyncio.run(_collect_logs())

    assert any("status succeeded" in log.message for log in messages)
    assert messages[-1].level == "INFO"


def test_extract_package_name_git():
    executor = DbtExecutor()

    # Test git package
    pkg = {'git': 'dbt-labs/dbt-utils'}
    name = executor._extract_package_name(pkg, 'git')
    assert name == 'dbt-utils'

    # Test URL
    pkg = {'git': 'https://github.com/dbt-labs/dbt-utils.git'}
    name = executor._extract_package_name(pkg, 'git')
    assert name == 'dbt-utils'

def test_extract_package_name_local():
    executor = DbtExecutor()
    pkg = {'local': '../my-package'}
    name = executor._extract_package_name(pkg, 'local')
    assert name == 'my-package'

def test_extract_package_name_hub():
    executor = DbtExecutor()
    pkg = {'package': 'dbt-labs/dbt_utils'}
    name = executor._extract_package_name(pkg, 'package')
    assert name == 'dbt_utils'

def test_check_missing_packages_no_packages_yml(tmp_path):
    executor = DbtExecutor()
    result = executor.check_missing_packages(str(tmp_path))
    assert result.has_missing is False
    assert result.packages_yml_exists is False

def test_check_missing_packages_with_missing(tmp_path):
    executor = DbtExecutor()

    # Create packages.yml
    packages_yml = tmp_path / "packages.yml"
    packages_yml.write_text("""
packages:
  - git: https://github.com/dbt-labs/dbt-utils.git
    revision: "0.9.0"
  - package: calogica/dbt_expectations
    version: 0.9.0
""")

    # Create dbt_packages dir with only one package
    dbt_packages = tmp_path / "dbt_packages"
    dbt_packages.mkdir()
    (dbt_packages / "dbt_utils").mkdir()

    result = executor.check_missing_packages(str(tmp_path))
    assert result.has_missing is True
    assert 'dbt-utils' in result.packages_required
    assert 'dbt_expectations' in result.packages_required
    assert 'dbt_expectations' in result.missing_packages
    assert 'dbt-utils' not in result.missing_packages

def test_check_missing_packages_all_installed(tmp_path):
    executor = DbtExecutor()

    packages_yml = tmp_path / "packages.yml"
    packages_yml.write_text("""
packages:
  - git: https://github.com/dbt-labs/dbt-utils.git
""")

    dbt_packages = tmp_path / "dbt_packages"
    dbt_packages.mkdir()
    (dbt_packages / "dbt-utils").mkdir()

    result = executor.check_missing_packages(str(tmp_path))
    assert result.has_missing is False
    assert len(result.missing_packages) == 0
    assert 'dbt-utils' in result.packages_required
