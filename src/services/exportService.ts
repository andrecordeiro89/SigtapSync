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

// ================================================================
// 🧾 Relatório de Anestesia (CBO 225151) — Excel
// - Uma linha por paciente/AIH contendo as anestesias em colunas sequenciais
// - Se houver mais de MAX_COLUMNS anestesias, a última coluna indica "+X"
// - Filtros: hospitalIds, dateFromISO, dateToISO (compatível com DoctorsHierarchyV2Service)
// ================================================================

export interface AnesthesiaExportFilters extends HierarchyFilters {
  maxColumnsPerPatient?: number; // padrão 5
}

export async function exportAnesthesiaExcel(filters: AnesthesiaExportFilters = {}): Promise<void> {
  const {
    maxColumnsPerPatient = 5,
    ...hierarchyFilters
  } = filters;

  const hierarchy = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2(hierarchyFilters);

  // Cabeçalho base
  const dynamicHeaders: string[] = [];
  for (let i = 1; i <= maxColumnsPerPatient; i++) {
    dynamicHeaders.push(`Anestesia ${i}`);
  }

  const header = [
    '#',
    'Nome do Paciente',
    'CNS',
    'Nº AIH',
    'Data Alta (SUS)',
    'Hospital',
    'Total Anestesias',
    ...dynamicHeaders,
    'Obs.'
  ];

  const rows: Array<Array<string | number>> = [];
  let index = 1;

  for (const card of hierarchy as any[]) {
    const hospitalNameFromCard = (card.hospitals && card.hospitals[0]?.hospital_name) || '';
    for (const p of (card.patients || [])) {
      // Filtrar procedimentos de anestesia por CBO 225151
      const anesth = (p.procedures || []).filter((proc: any) => String(proc?.cbo || '').trim() === '225151');
      if (anesth.length === 0) continue; // somente pacientes com anestesia

      // Identificadores e labels
      const patientName = p.patient_info?.name || 'Paciente';
      const cns = p.patient_info?.cns || '';
      const aihNumberRaw = (p as any)?.aih_info?.aih_number || '';
      const aihNumberClean = aihNumberRaw.toString().replace(/\D/g, '');
      const dischargeISO = (p as any)?.aih_info?.discharge_date || (p as any)?.aih_info?.admission_date;
      const dischargeLabel = dischargeISO ? format(new Date(dischargeISO), 'dd/MM/yyyy') : '';

      // Montar colunas dinâmicas
      const cols: string[] = [];
      const sorted = anesth.sort((a: any, b: any) => new Date(a.procedure_date).getTime() - new Date(b.procedure_date).getTime());
      const limit = Math.min(sorted.length, maxColumnsPerPatient);
      for (let i = 0; i < limit; i++) {
        const ap = sorted[i];
        const dateLabel = ap?.procedure_date ? format(new Date(ap.procedure_date), 'dd/MM/yyyy') : '';
        const desc = ap?.procedure_description || ap?.sigtap_description || '';
        const code = ap?.procedure_code || '';
        cols.push(`${code}${dateLabel ? ' | ' + dateLabel : ''}${desc ? ' | ' + (desc as string).slice(0, 60) : ''}`);
      }
      // Preencher vazio até o limite
      while (cols.length < maxColumnsPerPatient) cols.push('');

      const extra = sorted.length > maxColumnsPerPatient ? `+${sorted.length - maxColumnsPerPatient}` : '';

      rows.push([
        index++,
        patientName,
        cns,
        aihNumberClean,
        dischargeLabel,
        hospitalNameFromCard,
        sorted.length,
        ...cols,
        extra
      ]);
    }
  }

  if (rows.length === 0) {
    // Criar planilha vazia com cabeçalho para indicar ausência de dados
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header]);
    XLSX.utils.book_append_sheet(wb, ws, 'Anestesia');
    const fileNameEmpty = `Relatorio_Anestesia_CBO_225151_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileNameEmpty);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  (ws as any)['!cols'] = [
    { wch: 5 },   // #
    { wch: 40 },  // Paciente
    { wch: 20 },  // CNS
    { wch: 18 },  // AIH
    { wch: 16 },  // Data Alta
    { wch: 30 },  // Hospital
    { wch: 18 },  // Total Anestesias
    ...Array.from({ length: maxColumnsPerPatient }, () => ({ wch: 50 })), // colunas de anestesia
    { wch: 8 }    // Obs
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Anestesia');

  const fileName = `Relatorio_Anestesia_CBO_225151_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

 