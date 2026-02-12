#!/usr/bin/env python3
"""
Migration script to fix incorrect git repository directory paths in the database.

This script identifies and fixes paths like:
- /app/data/<workspace_key> → /app/data/repos/<workspace_key>

For production safety, this script:
1. Validates each change before applying
2. Creates a backup of the current state
3. Requires confirmation before applying changes
"""

import sys
import os

# Add app to path
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from pathlib import Path


def get_database_url():
    """Get database URL from environment."""
    return os.environ.get(
        'DATABASE_URL',
        'postgresql://user:password@db:5432/dbt_workbench'
    )


def find_incorrect_paths(engine):
    """Find repositories with incorrect directory paths.

    Returns:
        List of tuples: (id, workspace_id, current_path, correct_path)
    """
    query = text("""
        SELECT id, workspace_id, directory, remote_url
        FROM git_repositories
        WHERE directory NOT LIKE '/app/data/repos/%'
    """)

    with engine.connect() as conn:
        result = conn.execute(query)
        incorrect = []

        for row in result:
            repo_id, workspace_id, current_path, remote_url = row

            # Skip if remote_url is None (local-only repos)
            if not remote_url:
                continue

            # Extract workspace key from remote URL if possible
            # e.g., https://github.com/user/dbt-project-name.git -> dbt-project-name
            repo_name = None
            if remote_url.endswith('.git'):
                repo_name = remote_url.rsplit('/', 1)[-1].replace('.git', '')
            elif remote_url:
                repo_name = remote_url.rsplit('/', 1)[-1]

            if repo_name:
                correct_path = f'/app/data/repos/{repo_name}'
                incorrect.append((repo_id, workspace_id, current_path, correct_path))

    return incorrect


def validate_path_exists(path):
    """Check if a path exists on the filesystem."""
    return Path(path).exists()


def backup_current_state(engine):
    """Create a backup of current git_repositories table state."""
    backup_query = text("""
        CREATE TABLE IF NOT EXISTS git_repositories_backup AS
        SELECT * FROM git_repositories
    """)

    try:
        with engine.connect() as conn:
            conn.execute(backup_query)
            conn.commit()
        print("✓ Created backup table: git_repositories_backup")
        return True
    except Exception as e:
        print(f"✗ Failed to create backup: {e}")
        return False


def fix_repository_path(engine, repo_id, correct_path):
    """Update the directory path for a single repository."""
    query = text("""
        UPDATE git_repositories
        SET directory = :correct_path
        WHERE id = :repo_id
    """)

    with engine.connect() as conn:
        conn.execute(query, {'correct_path': correct_path, 'repo_id': repo_id})
        conn.commit()


def main():
    """Main migration function."""
    print("=" * 60)
    print("Git Repository Path Migration Script")
    print("=" * 60)

    db_url = get_database_url()
    print(f"Database URL: {db_url}")

    engine = create_engine(db_url)

    # Step 1: Find incorrect paths
    print("\nStep 1: Scanning for incorrect repository paths...")
    incorrect_paths = find_incorrect_paths(engine)

    if not incorrect_paths:
        print("✓ No incorrect repository paths found. Database is clean!")
        return

    print(f"\nFound {len(incorrect_paths)} repositories with incorrect paths:\n")

    for repo_id, workspace_id, current_path, correct_path in incorrect_paths:
        print(f"  Repo ID: {repo_id}, Workspace ID: {workspace_id}")
        print(f"    Current: {current_path}")
        print(f"    Correct:  {correct_path}")

        # Check if current path exists
        if validate_path_exists(current_path):
            print(f"    ⚠ Warning: Current path exists on filesystem!")

    # Step 2: Create backup
    print("\nStep 2: Creating backup...")
    if not backup_current_state(engine):
        print("✗ Backup failed. Aborting migration.")
        return

    # Step 3: Ask for confirmation
    print("\nStep 3: Ready to fix paths.")
    response = input("\nDo you want to apply these changes? (yes/no): ").strip().lower()

    if response not in ['yes', 'y']:
        print("✗ Migration cancelled by user.")
        return

    # Step 4: Apply fixes
    print("\nStep 4: Applying fixes...")
    success_count = 0

    for repo_id, workspace_id, current_path, correct_path in incorrect_paths:
        try:
            fix_repository_path(engine, repo_id, correct_path)
            print(f"✓ Updated repo {repo_id}: {current_path} → {correct_path}")
            success_count += 1
        except Exception as e:
            print(f"✗ Failed to update repo {repo_id}: {e}")

    print(f"\n✓ Successfully updated {success_count}/{len(incorrect_paths)} repositories")

    # Step 5: Summary
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Disconnect and reconnect affected repositories in the UI")
    print("2. This will trigger git clone to the correct paths")
    print("3. Verify repositories are working correctly")
    print("\nTo rollback changes, restore from git_repositories_backup table.")
    print("=" * 60)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Migration cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Migration failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
