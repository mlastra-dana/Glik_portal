export const benefits = [
  {
    title: 'Precisión documental',
    description:
      'Identifica si cada archivo corresponde al tipo exigido para cada expediente de motocicleta.'
  },
  {
    title: 'Consistencia por expediente',
    description:
      'Verifica coincidencia de placa y serial para reducir reprocesos y riesgos operativos.'
  },
  {
    title: 'Flujo operativo más ágil',
    description:
      'Entrega resultados en segundos con un panel claro para decisiones rápidas del equipo.'
  }
];

export const flowSteps = [
  {
    title: '1. Carga de documentos',
    description: 'Adjunta factura, certificado de origen, fotoplaca y fotoserial en un solo flujo.'
  },
  {
    title: '2. Validación automática',
    description:
      'El portal simula reglas de clasificación documental y coherencia de expediente.'
  },
  {
    title: '3. Resultado y acción',
    description:
      'Obtén estado final con checklist y deriva a revisión manual cuando existan observaciones.'
  }
];

export const faqs = [
  {
    question: '¿Necesito integrar un backend para probar el portal?',
    answer:
      'No. Esta versión opera con mocks para simular validaciones y decisiones de estado.'
  },
  {
    question: '¿Qué pasa si la validación detecta inconsistencias?',
    answer:
      'El expediente se marca con observaciones o revisión manual y bloquea la continuación automática.'
  },
  {
    question: '¿Puedo desplegarlo directamente en AWS Amplify?',
    answer:
      'Sí. El proyecto usa Vite con salida SPA compatible con un flujo estándar de Amplify.'
  }
];
