import React, { useState } from 'react';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const CeilingInsulationCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const totalArea = (Number(area) || 0) * 1.05;

  return (
    <>
      <FieldGrid columns={1}><NumberField label="Площадь потолка, м²" value={area} onChange={setArea} /></FieldGrid>
      <ResultPaper label="Утеплитель с запасом 5%" value={`${formatNumber(totalArea)} м²`} color="#2e7d32" background="#e8f5e9" borderColor="#a5d6a7" />
      <ResetButton onClick={() => setArea('')} disabled={!area} />
    </>
  );
};

export default CeilingInsulationCalculator;