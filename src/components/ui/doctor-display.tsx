import React from 'react';
import { useDoctor, Doctor } from '../../hooks/useDoctors';
import { Badge } from './badge';
import { Skeleton } from './skeleton';
import { UserCheck, AlertTriangle, Stethoscope } from 'lucide-react';

interface DoctorDisplayProps {
  cns: string;
  hospitalId?: string;
  type: 'solicitante' | 'responsavel' | 'autorizador';
  className?: string;
  showFullInfo?: boolean;
}

const DoctorDisplay: React.FC<DoctorDisplayProps> = ({
  cns,
  hospitalId,
  type,
  className = '',
  showFullInfo = false
}) => {
  const { doctor, loading, error } = useDoctor(cns, hospitalId);

  // Configuração visual por tipo
  const getTypeConfig = () => {
    switch (type) {
      case 'solicitante':
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          icon: <UserCheck className="w-3 h-3" />,
          label: 'CNS Solicitante'
        };
      case 'responsavel':
        return {
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-700',
          borderColor: 'border-purple-200',
          icon: <Stethoscope className="w-3 h-3" />,
          label: 'CNS Responsável'
        };
      case 'autorizador':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          icon: <UserCheck className="w-3 h-3" />,
          label: 'CNS Autorizador'
        };
    }
  };

  const config = getTypeConfig();

  // Se não há CNS, mostrar N/A
  if (!cns || cns === 'N/A' || cns.trim() === '') {
    return (
      <div className={className}>
        <label className="text-xs font-medium text-gray-600">{config.label}</label>
        <div className={`text-gray-500 text-sm px-2 py-1 rounded border ${config.bgColor} ${config.borderColor}`}>
          N/A
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {type === 'solicitante' && 'Médico solicitante'}
          {type === 'responsavel' && 'Médico responsável'}
          {type === 'autorizador' && 'Médico que autorizou'}
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <label className="text-xs font-medium text-gray-600">{config.label}</label>
        <div className={`px-2 py-1 rounded border ${config.bgColor} ${config.borderColor}`}>
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Buscando médico...</p>
      </div>
    );
  }

  // CNS Autorizador - apenas código (sem busca de nome)
  if (type === 'autorizador') {
    return (
      <div className={className}>
        <label className="text-xs font-medium text-gray-600">{config.label}</label>
        <div className={`text-gray-900 text-sm font-mono px-2 py-1 rounded ${config.bgColor}`}>
          {cns}
        </div>
        <p className="text-xs text-gray-500 mt-1">Médico que autorizou</p>
      </div>
    );
  }

  // Médico encontrado - Mostrar nome + CNS
  if (doctor) {
    return (
      <div className={className}>
        <label className="text-xs font-medium text-gray-600">{config.label}</label>
        <div className={`p-2 rounded border ${config.bgColor} ${config.borderColor}`}>
          <div className="flex items-center space-x-2 mb-1">
            {config.icon}
            <span className={`text-sm font-semibold ${config.textColor}`}>
              {doctor.name}
            </span>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            CNS: {doctor.cns}
          </div>
          {showFullInfo && doctor.specialty && (
            <div className="text-xs text-gray-500 mt-1">
              {doctor.specialty}
              {doctor.crm && doctor.crm_state && (
                <span className="ml-2">• CRM: {doctor.crm}/{doctor.crm_state}</span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {type === 'solicitante' && 'Médico solicitante'}
          {type === 'responsavel' && 'Médico responsável'}
        </p>
      </div>
    );
  }

  // Médico não encontrado - Mostrar apenas CNS com warning
  return (
    <div className={className}>
      <label className="text-xs font-medium text-gray-600">{config.label}</label>
      <div className={`p-2 rounded border border-orange-200 bg-orange-50`}>
        <div className="flex items-center space-x-2 mb-1">
          <AlertTriangle className="w-3 h-3 text-orange-600" />
          <span className="text-sm font-mono text-gray-700">
            {cns}
          </span>
        </div>
        <div className="text-xs text-orange-600">
          Médico não encontrado na base
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {type === 'solicitante' && 'Médico solicitante'}
        {type === 'responsavel' && 'Médico responsável'}
      </p>
    </div>
  );
};

export default DoctorDisplay;

/**
 * Componente simplificado para exibir apenas o nome do médico inline
 */
export const DoctorNameInline: React.FC<{
  cns: string;
  hospitalId?: string;
  fallback?: string;
}> = ({ cns, hospitalId, fallback = 'Médico não encontrado' }) => {
  const { doctor, loading } = useDoctor(cns, hospitalId);

  if (loading) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }

  if (doctor) {
    return (
      <span className="font-medium text-gray-900" title={`CNS: ${doctor.cns}`}>
        {doctor.name}
      </span>
    );
  }

  return (
    <span className="text-gray-500 text-sm" title={`CNS: ${cns}`}>
      {fallback}
    </span>
  );
};

/**
 * Componente compacto para badges de médicos
 */
export const DoctorBadge: React.FC<{
  cns: string;
  hospitalId?: string;
  type: 'solicitante' | 'responsavel';
}> = ({ cns, hospitalId, type }) => {
  const { doctor, loading } = useDoctor(cns, hospitalId);

  const variant = type === 'solicitante' ? 'blue' : 'purple';

  if (loading) {
    return <Skeleton className="h-6 w-20 rounded-full" />;
  }

  if (doctor) {
    return (
      <Badge 
        variant="outline" 
        className={`
          ${variant === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700'}
          text-xs font-medium
        `}
        title={`CNS: ${doctor.cns}`}
      >
        {doctor.name}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 text-xs">
      CNS: {cns}
    </Badge>
  );
}; 