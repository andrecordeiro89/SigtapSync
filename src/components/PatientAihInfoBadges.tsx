import React from 'react';

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
				<span className="truncate max-w-[220px]"><span className="font-semibold">AIH:</span> {aihNumber}</span>
			)}
			{mainCid && (
				<span className="truncate max-w-[220px]"><span className="font-semibold">CID:</span> {mainCid}</span>
			)}
			{specialty && (
				<span className="truncate max-w-[220px]">{specialty}</span>
			)}
			{!specialty && requestingPhysician && (
				<span className="truncate max-w-[220px]">{requestingPhysician}</span>
			)}
			{careModality && (
				<span className="truncate max-w-[220px]"><span className="font-semibold">Modalidade:</span> {careModality}</span>
			)}
			{professionalCbo && (
				<span className="truncate max-w-[220px]"><span className="font-semibold">CBO:</span> {professionalCbo}</span>
			)}
		</div>
	);
};

export default PatientAihInfoBadges;


