const fs = require('fs');
let content = fs.readFileSync('src/components/DoctorPaymentRules.tsx', 'utf8');

// Médicos que ainda precisam receber as regras
const doctorsToAdd = [
  'JOAO VICTOR RODRIGUES', // Hospital 18 Dezembro
  'ALEXANDRE PORTELLA PLIACEKOS',
  'ISIDORO ANTONIO VILLAMAYOR ALVAREZ',
  'JOSE LUIZ BERTOLI NETO',
  'PAULO RODOLPHO CAMARGO',
  'RAPHAEL BEZERRA DE MENEZES COSTA',
  'PEDRO ROGERIO DE SA NEVES',
  'LEONARDO FLORES'
];

let modifiedCount = 0;

doctorsToAdd.forEach(doctor => {
  // Encontra o padrão: doctorName + última regra 04.07.02.021-7 (ESFINCTEROTOMIA) seguido do fechamento do array
  const regex = new RegExp(
    `(doctorName: '${doctor}',[\\s\\S]*?` +
    `procedureCode: '04\\.07\\.02\\.021-7',\\s*` +
    `standardValue: 450\\.00,\\s*` +
    `secondaryValue: 100\\.00,\\s*` +
    `description: 'ESFINCTEROTOMIA INTERNA[^']*'\\s*` +
    `})\\s*` +
    `(\\]\\s*,)`
  );

  if (regex.test(content)) {
    content = content.replace(regex, 
      `$1,\n      {\n        procedureCode: '04.07.04.022-6',\n        standardValue: 300.00,\n        description: 'REPARACAO DE OUTRAS HERNIAS - R$ 300,00'\n      },\n      {\n        procedureCode: '04.09.06.013-5',\n        standardValue: 1000.00,\n        description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'\n      }\n    $2`
    );
    modifiedCount++;
    console.log(`✅ ${doctor} - regras adicionadas`);
  } else {
    console.log(`⚠️  ${doctor} - não encontrado ou já possui regras`);
  }
});

fs.writeFileSync('src/components/DoctorPaymentRules.tsx', content, 'utf8');
console.log(`\n✅ Total: ${modifiedCount} médicos atualizados!`);

