export default function ModeChip({ id, name, shortcut }) {
  const tapIcons = { 1: '×1', 2: '×2', 3: '×3' };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      background: 'var(--chip-bg)',
      border: '1px solid var(--chip-border)',
      borderRadius: '8px',
    }}>
      <span style={{
        fontSize: '11px',
        fontWeight: '700',
        fontFamily: 'var(--font-mono)',
        color: 'var(--amber-bright)',
        minWidth: '18px',
      }}>
        {tapIcons[id]}
      </span>
      <span style={{
        fontSize: '12px',
        color: 'var(--text-primary)',
        fontWeight: '500',
        flex: 1,
      }}>
        {name}
      </span>
      <span style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}>
        Ctrl+M {tapIcons[id]}
      </span>
    </div>
  );
}
