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
		<div className={`grid grid-cols-2 gap-2 text-[11px] text-slate-700 w-fit ${className || ''}`}>
			{aihNumber && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					AIH: {aihNumber}
				</Badge>
			)}
			{mainCid && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					CID: {mainCid}
				</Badge>
			)}
			{specialty && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					{specialty}
				</Badge>
			)}
			{!specialty && requestingPhysician && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					{requestingPhysician}
				</Badge>
			)}
			{careModality && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					Modalidade: {careModality}
				</Badge>
			)}
			{professionalCbo && (
				<Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 px-2 py-0.5 max-w-[220px] truncate">
					CBO: {professionalCbo}
				</Badge>
			)}
		</div>
	);
};

export default PatientAihInfoBadges;


