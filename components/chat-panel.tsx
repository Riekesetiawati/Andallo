'use client';

import { useEffect, useState } from 'react';
import { chatAction, typingAction } from '@/app/actions';

const customerTemplates = ['Halo, kapan layanan ini diproses?', 'Apakah pesanan saya sudah dikonfirmasi?', 'Apakah Anda sudah dalam perjalanan?', 'Berapa estimasi waktu tiba?', 'Saya ingin mengubah jadwal.'];
const providerTemplates = ['Halo Kak, pesanan sudah saya terima.', 'Saya sedang menuju lokasi.', 'Estimasi tiba sekitar 10 menit.', 'Baik, saya cek jadwal terlebih dahulu.'];

export function ChatPanel({ threadId, mine, initial, role }: { threadId: string; mine: string; role: string; initial: { id: string; body: string; sender_id: string; full_name: string; created_at: string }[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const source = new EventSource('/api/realtime');
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const incoming = (data.messages || []).filter((item: { thread_id: string }) => item.thread_id === threadId);
      if (incoming.length) setMessages((current) => [...current, ...incoming.filter((item: { id: string }) => !current.some((row) => row.id === item.id))]);
    };
    return () => source.close();
  }, [threadId]);
  const templates = role === 'provider' ? providerTemplates : customerTemplates;
  return (
    <div className="card grid gap-3 p-4">
      <div className="grid max-h-[50vh] gap-2 overflow-auto">
        {messages.map((message) => (
          <div key={message.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === mine ? 'ml-auto bg-mint' : 'bg-sand'}`}>
            <p>{message.body}</p>
            <p className="text-xs text-muted">{new Date(message.created_at).toLocaleString('id-ID')}</p>
          </div>
        ))}
        {!messages.length ? <p className="text-muted">Belum ada pesan. Tulis sapaan pertama.</p> : null}
      </div>
      <div className="flex gap-2 overflow-auto">{templates.map((item) => <button key={item} type="button" className="btn shrink-0" onClick={() => setText(item)}>{item}</button>)}</div>
      <form className="flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const result = await chatAction(threadId, text);
        if (result && 'error' in result && result.error) setError(result.error);
        else { setMessages((current) => [...current, { id: crypto.randomUUID(), body: text, sender_id: mine, full_name: 'Anda', created_at: new Date().toISOString() }]); setText(''); setError(''); }
      }}>
        <input className="input" value={text} onChange={(event) => { setText(event.target.value); typingAction(threadId); }} placeholder="Tulis pesan" />
        <button className="btn btn-primary" type="submit">Kirim</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
