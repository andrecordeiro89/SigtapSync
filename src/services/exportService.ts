import { DoctorsHierarchyV2Service, type HierarchyFilters } from './doctorsHierarchyV2';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface AllPatientsExportFilters extends HierarchyFilters {}

export async function exportAllPatientsExcel(filters: AllPatientsExportFilters = {}): Promise<void> {
  const hierarchy = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2(filters);

  // Montar linhas únicas por paciente (por cartão). Não deduplica entre médicos/hospitais.
  const rows: Array<Array<string | number>> = [];

  // Cabeçalho
  const header = ['#', 'Nome do Paciente', 'Nº AIH', 'Data Alta (SUS)', 'Valor Total', 'Médico', 'Hospital'];

  let index = 1;
  for (const card of hierarchy) {
    const doctorName = card.doctor_info?.name || '';
    const hospitalName = (card.hospitals && card.hospitals[0]?.hospital_name) || '';
    for (const p of (card.patients || [])) {
      const patientName = p.patient_info?.name || 'Paciente';
      const aihNumberRaw = (p as any)?.aih_info?.aih_number || '';
      const aihNumberClean = aihNumberRaw.toString().replace(/\D/g, '');
      const dischargeISO = (p as any)?.aih_info?.discharge_date || (p as any)?.aih_info?.admission_date;
      const dischargeLabel = dischargeISO ? format(new Date(dischargeISO), 'dd/MM/yyyy') : '';
      const totalReais = Number(p.total_value_reais || 0);

      rows.push([
        index++,
        patientName,
        aihNumberClean,
        dischargeLabel,
        totalReais,
        doctorName,
        hospitalName,
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  (ws as any)['!cols'] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');

  const fileName = `Relatorio_Pacientes_Todos_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

 