import React from 'react';
import type { TransactionItemProps } from '../types/transaction';
const TransactionItem: React.FC<TransactionItemProps> = ({ transfer, address, copyToClipboard, openInExplorer }) => {
  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      background: transfer.from.id === address ? '#ffe5d1' : '#e5e8ff',
      color: '#222',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        {transfer.from.id === address ? 'Отправлено' : 'Получено'}
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Количество:</b> {parseFloat(transfer.amount) / 1e18} REEF
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888', marginRight: 6 }}>От:</span>
        <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{transfer.from.id}</span>
        <button onClick={() => copyToClipboard(transfer.from.id)} style={{ marginRight: 6 }}>Копировать</button>
        <button onClick={() => openInExplorer(transfer.from.id)}>Открыть в Reefscan</button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888', marginRight: 6 }}>Кому:</span>
        <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{transfer.to.id}</span>
        <button onClick={() => copyToClipboard(transfer.to.id)} style={{ marginRight: 6 }}>Копировать</button>
        <button onClick={() => openInExplorer(transfer.to.id)}>Открыть в Reefscan</button>
      </div>
    </div>
  );
};

export default TransactionItem;
