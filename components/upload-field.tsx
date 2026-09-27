'use client';

import { useState } from 'react';

export function UploadField({ name, bucket, label }: { name: string; bucket: string; label: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <label className="field">
      {label}
      <input type="hidden" name={name} value={url} />
      <input
        className="input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setPending(true);
          setError('');
          const body = new FormData();
          body.set('file', file);
          body.set('bucket', bucket);
          const response = await fetch('/api/uploads', { method: 'POST', body });
          const data = await response.json();
          setPending(false);
          if (!response.ok) setError(data.error || 'Unggahan gagal.');
          else setUrl(data.url);
        }}
      />
      {pending ? <span className="text-sm text-muted">Mengunggah...</span> : null}
      {url ? <span className="text-sm text-leaf">File tersimpan.</span> : null}
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
