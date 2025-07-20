import { DoctorWithPatients } from '../services/doctorPatientService';

// ✅ FUNÇÃO PARA CALCULAR ESTATÍSTICAS DO MÉDICO
export const calculateDoctorStats = (doctorData: DoctorWithPatients) => {
  const totalProcedures = doctorData.patients.reduce((sum, patient) => sum + patient.procedures.length, 0);
  const totalValue = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures.reduce((procSum, proc) => procSum + (proc.value_reais || 0), 0), 0
  );
  const totalAIHs = doctorData.patients.length;
  const avgTicket = totalAIHs > 0 ? totalValue / totalAIHs : 0;
  
  const approvedProcedures = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures.filter(proc => proc.approval_status === 'approved').length, 0
  );
  const approvalRate = totalProcedures > 0 ? (approvedProcedures / totalProcedures) * 100 : 0;
  
  return {
    totalProcedures,
    totalValue,
    totalAIHs,
    avgTicket,
    approvalRate
  };
};