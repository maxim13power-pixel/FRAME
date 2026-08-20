import React, { useState } from 'react';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const StretchCeilingCalculator: React.FC = () => {
  const [area, setArea] = useState('');

  return (
    <>
      <FieldGrid columns={1}><NumberField label="Площадь комнаты, м²" value={area} onChange={setArea} /></FieldGrid>
      <ResultPaper label="Площадь натяжного потолка" value={`${formatNumber(Number(area) || 0)} м²`} color="#283593" background="#e8eaf6" borderColor="#9fa8da" />
      <ResetButton onClick={() => setArea('')} disabled={!area} />
    </>
  );
};

export default StretchCeilingCalculator;