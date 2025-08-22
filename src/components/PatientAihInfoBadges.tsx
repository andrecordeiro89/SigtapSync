import React from 'react';
import { Badge } from './ui/badge';

export interface AihInfoBadgesProps {
	aihNumber?: string;
	mainCid?: string;
	specialty?: string;
	requestingPhysician?: string;
	careModality?: string;
	professionalCbo?: string;
	className?: string;
}

const PatientAihInfoBadges: React.FC<AihInfoBadgesProps> = ({
	aihNumber,
	mainCid,
	specialty,
	requestingPhysician,
	careModality,
	professionalCbo,
	className
}) => {
	return (
		<div className={`grid grid-cols-2 gap-2 text-[11px] text-slate-700 ${className || ''}`}>
			{aihNumber && (
				<Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 px-2 py-0.5">
					AIH: {aihNumber}
				</Badge>
			)}
			{mainCid && (
				<Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700 px-2 py-0.5">
					CID: {mainCid}
				</Badge>
			)}
			{specialty && (
				<Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 px-2 py-0.5">
					{specialty}
				</Badge>
			)}
			{!specialty && requestingPhysician && (
				<Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 px-2 py-0.5">
					{requestingPhysician}
				</Badge>
			)}
			{careModality && (
				<Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 px-2 py-0.5">
					Modalidade: {careModality}
				</Badge>
			)}
			{professionalCbo && (
				<Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 px-2 py-0.5">
					CBO: {professionalCbo}
				</Badge>
			)}
		</div>
	);
};

export default PatientAihInfoBadges;


