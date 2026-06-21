import { useTranslation } from 'react-i18next';
import type { ConsistencyReport } from '../../domain/types';

interface Props {
  report: ConsistencyReport | null;
  loading?: boolean;
}

export default function ConsistencyBadge({ report, loading }: Props) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        {t('A verificar…')}
      </span>
    );
  }
  if (!report) return null;

  if (report.isConsistent) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
        {t('✓ Consistente (z = {{z}})', { z: report.consistencyMargin.toFixed(3) })}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">
      {t('✗ Inconsistente ({{n}} pares)', { n: report.inconsistentPairs.length })}
    </span>
  );
}
