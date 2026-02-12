from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.database.connection import Base, SessionLocal, engine
from app.database.models import models as db_models
from app.main import app


def setup_function(_function):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_ai_settings_round_trip():
    client = TestClient(app)

    res = client.get('/ai/settings')
    assert res.status_code == 200
    body = res.json()
    assert body['default_mode'] in {'direct', 'mcp'}

    update = client.put(
        '/ai/settings',
        json={
            'default_mode': 'mcp',
            'default_direct_provider': 'anthropic',
            'allow_data_context_run_logs': False,
        },
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated['default_mode'] == 'mcp'
    assert updated['default_direct_provider'] == 'anthropic'
    assert updated['allow_data_context_run_logs'] is False


def test_ai_chat_stream_persists_messages():
    client = TestClient(app)

    conv = client.post('/ai/conversations', json={'title': 'Troubleshoot'})
    assert conv.status_code == 200
    conversation_id = conv.json()['id']

    stream = client.post(
        '/ai/chat/stream',
        json={
            'conversation_id': conversation_id,
            'prompt': 'Explain why this run failed',
            'context': {'run_logs': True, 'run_id': 'sample-run'},
        },
    )
    assert stream.status_code == 200
    assert 'event: meta' in stream.text
    assert 'event: done' in stream.text

    messages = client.get(f'/ai/conversations/{conversation_id}/messages')
    assert messages.status_code == 200
    rows = messages.json()
    assert len(rows) >= 2
    assert rows[0]['role'] == 'user'
    assert rows[-1]['role'] == 'assistant'


def test_ai_action_reject_flow():
    client = TestClient(app)

    conv = client.post('/ai/conversations', json={'title': 'Actions'})
    assert conv.status_code == 200
    conv_id = conv.json()['id']

    db = SessionLocal()
    try:
        workspace = db.query(db_models.Workspace).filter(db_models.Workspace.key == 'default').first()
        assert workspace is not None

        proposal = db_models.AiActionProposal(
            proposal_id='proposal-test-1',
            workspace_id=workspace.id,
            conversation_id=conv_id,
            message_id=None,
            created_by_user_id=None,
            proposal_type='sql_execute',
            status='pending',
            payload={'sql': 'select 1'},
            risk_flags=['requires_confirmation'],
            result_payload={},
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(proposal)
        db.commit()
    finally:
        db.close()

    reject = client.post('/ai/actions/proposal-test-1/reject')
    assert reject.status_code == 200
    body = reject.json()
    assert body['status'] == 'rejected'

    proposal_get = client.get('/ai/actions/proposal-test-1')
    assert proposal_get.status_code == 200
    assert proposal_get.json()['status'] == 'rejected'
