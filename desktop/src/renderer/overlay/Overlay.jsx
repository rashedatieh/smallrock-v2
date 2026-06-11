import { useState, useEffect } from 'react';

const KIND_STYLES = {
  info:  { bg: 'rgba(15, 12, 8, 0.92)',  border: 'rgba(245,158,11,0.25)', color: '#f0ebe0' },
  error: { bg: 'rgba(180, 20, 20, 0.92)', border: 'rgba(239,68,68,0.4)',  color: '#fff' },
  warn:  { bg: 'rgba(15, 12, 8, 0.92)',  border: 'rgba(245,158,11,0.4)',  color: '#fbbf24' },
};

export default function Overlay() {
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('info');

  useEffect(() => {
    if (window.overlay) {
      window.overlay.onUpdate(({ message, kind: k }) => {
        setMsg(message);
        setKind(k ?? 'info');
      });
    }
  }, []);

  const s = KIND_STYLES[kind] ?? KIND_STYLES.info;

  if (!msg) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      padding: '10px 16px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '10px',
      color: s.color,
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
      maxWidth: '280px',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {msg}
    </div>
  );
}
