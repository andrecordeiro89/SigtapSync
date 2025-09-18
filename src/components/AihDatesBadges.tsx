import React from 'react';

export interface AihDatesBadgesProps {
	admissionDate?: string;
	dischargeDate?: string;
	competencia?: string;
	className?: string;
}

import { formatDateBrTz } from '@/lib/utils';
const formatDate = (date?: string) => formatDateBrTz(date);

const formatCompetencia = (competencia?: string, fallback?: string) => {
	const ref = competencia || fallback;
	if (!ref) return '';
	const m = String(ref).match(/^(\d{4})-(\d{2})/);
	if (m) {
		const year = Number(m[1]);
		const month = Number(m[2]);
		const d = new Date(year, month - 1, 1);
		return `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(d.getFullYear()).slice(-2)}`;
	}
	try {
		const d = new Date(ref);
		const y = d.getUTCFullYear();
		const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
		const dd = new Date(y, Number(mm) - 1, 1);
		return `${dd.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(dd.getFullYear()).slice(-2)}`;
	} catch {
		return '';
	}
};

const AihDatesBadges: React.FC<AihDatesBadgesProps> = ({ admissionDate, dischargeDate, competencia, className }) => {
	const compLabel = formatCompetencia(competencia, dischargeDate || admissionDate);
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
			<span className="text-xs text-slate-700"><span className="font-semibold">Admissão:</span> {formatDate(admissionDate)}</span>
			<span className="text-xs text-slate-700" title={dischargeDate ? undefined : 'Sem data de alta; período considera apenas internação'}>
				<span className="font-semibold">Alta:</span> {dischargeDate ? formatDate(dischargeDate) : '—'}
			</span>
			{compLabel && (
				<span className="text-xs text-slate-700" title="Competência SUS"><span className="font-semibold">Competência:</span> {compLabel}</span>
			)}
		</div>
	);
};

export default AihDatesBadges;


