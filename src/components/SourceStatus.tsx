'use client';

interface SourceStatusProps {
  sourceId: string;
  documents?: any[];
  lastJob?: any;
}

export function SourceStatus({ sourceId, documents = [], lastJob }: SourceStatusProps) {
  // Check if source has successful documents
  const hasDocuments = documents.length > 0;
  const lastSuccessfulJob = lastJob?.status === 'success';
  const lastFailedJob = lastJob?.status === 'error';
  const hasNeverBeenCrawled = !lastJob;

  // Determine status and styling
  let status = 'pending';
  let statusColor = 'gray';
  let statusIcon = '⏳';
  let statusText = 'Não testada';

  if (hasDocuments && lastSuccessfulJob) {
    status = 'success';
    statusColor = 'green';
    statusIcon = '✅';
    statusText = 'Documentos salvos';
  } else if (lastFailedJob) {
    status = 'error';
    statusColor = 'red';
    statusIcon = '❌';
    statusText = 'Falhou';
  } else if (hasNeverBeenCrawled) {
    status = 'pending';
    statusColor = 'gray';
    statusIcon = '⏳';
    statusText = 'Não testada';
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
      statusColor === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
      statusColor === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
      'bg-gray-50 text-gray-600 border-gray-200'
    }`}>
      <span className="mr-1">{statusIcon}</span>
      <span>{statusText}</span>
      {hasDocuments && (
        <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
          {documents.length}
        </span>
      )}
    </div>
  );
}
