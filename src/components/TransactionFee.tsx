import React from 'react';
import { useFee } from './useFee';

interface TransactionFeeProps {
  extrinsicId: string | undefined;
}

const TransactionFee: React.FC<TransactionFeeProps> = ({ extrinsicId }) => {
  if (!extrinsicId) {
    // console.log('[TransactionFee] No extrinsicId provided.');
    return <span>-</span>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { fee, loading, error } = useFee(extrinsicId);

  // console.log(`[TransactionFee] useFee for ${extrinsicId} - Loading: ${loading}, Fee: ${fee}, Error: ${error}`);

  if (loading) {
    return <span>...</span>; // Индикатор загрузки
  }

  if (error) {
    // console.error(`[TransactionFee] Error for ${extrinsicId}:`, error);
    return <span title={typeof error === 'string' ? error : (error as Error)?.message || 'Ошибка загрузки комиссии'}>Ошибка</span>;
  }

  if (fee === undefined || fee === null || fee === 0) {
    return <span>-</span>; // Комиссия не найдена, null или 0
  }

  // Если комиссия есть и она больше 0, отображаем ее.
  // Позже здесь можно добавить форматирование (например, деление на 1e18 и toFixed())
  // const formattedFee = (fee / 1e18).toFixed(5); 
  // return <span>{formattedFee} REEF</span>;
  return <span>{String(fee)}</span>; // Пока просто отображаем число
};

export default TransactionFee;
