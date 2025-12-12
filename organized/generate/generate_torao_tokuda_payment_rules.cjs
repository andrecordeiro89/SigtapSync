const fs = require('fs');

// Simular as regras (lidas do arquivo TypeScript)
const TORAO_TOKUDA_DOCTORS = {
  'HUMBERTO MOREIRA DA SILVA': {
    specialty: 'Oftalmologia',
    proceduresCount: 5,
    hasMultipleRule: true,
    multipleRuleDescription: 'Dois ou mais procedimentos: R$ 800,00 TOTAL'
  },
  'JOSE GABRIEL GUERREIRO': {
    specialty: 'Cirurgia Vascular',
    proceduresCount: 2,
    hasMultipleRule: false
  },
  'HELIO SHINDY KISSINA': {
    specialty: 'Urologia',
    proceduresCount: 22,
    hasMultipleRule: true,
    multipleRulesCount: 18
  },
  'ROGERIO YOSHIKAZU NABESHIMA': {
    specialty: 'Cirurgia Vascular',
    proceduresCount: 2,
    hasMultipleRule: false
  },
  'FABIANE GREGORIO BATISTELA': {
    specialty: 'Cirurgia Geral',
    proceduresCount: 10,
    hasMultipleRule: true,
    multipleRulesCount: 16
  },
  'JOÃO VICTOR RODRIGUES': {
    specialty: 'Cirurgia Geral',
    proceduresCount: 10,
    hasMultipleRule: false
  },
  'JOAO VICTOR RODRIGUES': {
    specialty: 'Cirurgia Geral',
    proceduresCount: 11,
    hasMultipleRule: false
  }
};

console.log('🏥 RELATÓRIO: Regras de Pagamento - Hospital Torao Tokuda (Apucarana)\n');
console.log('═'.repeat(80));
console.log('\n📋 RESUMO GERAL\n');

const totalDoctors = Object.keys(TORAO_TOKUDA_DOCTORS).length;
const doctorsWithMultipleRules = Object.values(TORAO_TOKUDA_DOCTORS).filter(d => d.hasMultipleRule).length;
const totalProcedures = Object.values(TORAO_TOKUDA_DOCTORS).reduce((sum, d) => sum + d.proceduresCount, 0);

console.log(`Total de médicos com regras: ${totalDoctors}`);
console.log(`Médicos com regras de múltiplos procedimentos: ${doctorsWithMultipleRules}`);
console.log(`Total de procedimentos com valores definidos: ${totalProcedures}`);

console.log('\n' + '═'.repeat(80));
console.log('\n👨‍⚕️ MÉDICOS E SUAS REGRAS\n');

Object.entries(TORAO_TOKUDA_DOCTORS).forEach(([name, data], index) => {
  console.log(`${index + 1}. ${name}`);
  console.log(`   Especialidade: ${data.specialty}`);
  console.log(`   Procedimentos individuais: ${data.proceduresCount}`);
  if (data.hasMultipleRule) {
    if (data.multipleRulesCount) {
      console.log(`   ✅ Regras de múltiplos procedimentos: ${data.multipleRulesCount} combinações`);
    } else {
      console.log(`   ✅ Regra de múltiplos procedimentos: ${data.multipleRuleDescription}`);
    }
  } else {
    console.log(`   ℹ️  Sem regras especiais de múltiplos procedimentos`);
  }
  console.log('');
});

console.log('═'.repeat(80));
console.log('\n📄 ARQUIVO DE REGRAS: src/components/DoctorPaymentRules.tsx');
console.log('📍 Seção: TORAO_TOKUDA_APUCARANA');
console.log('\n═'.repeat(80));

