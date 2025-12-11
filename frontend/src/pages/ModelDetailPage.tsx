import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/api';
import { Model, ModelDiff } from '@/types';

const ModelTimeline: React.FC<{ model: Model }> = ({ model }) => {
  return (
    <div>
      <h2>Model Timeline</h2>
      {/* Implementation of the timeline view */}
    </div>
  );
};

const DiffViewer: React.FC<{ diff: ModelDiff }> = ({ diff }) => {
  return (
    <div>
      <h2>Diff Viewer</h2>
      {/* Implementation of the diff viewer */}
    </div>
  );
};

const ModelDetailPage: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const [model, setModel] = useState<Model | null>(null);
  const [diff, setDiff] = useState<ModelDiff | null>(null);

  useEffect(() => {
    const fetchModel = async () => {
      const response = await api.get<Model>(`/models/${modelId}`);
      setModel(response.data);
    };
    fetchModel();
  }, [modelId]);

  const handleCompare = async (otherModelId: string) => {
    const response = await api.get<ModelDiff>(`/diff/${modelId}/${otherModelId}`);
    setDiff(response.data);
  };

  if (!model) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{model.name}</h1>
      <ModelTimeline model={model} />
      {diff && <DiffViewer diff={diff} />}
    </div>
  );
};

export default ModelDetailPage;
