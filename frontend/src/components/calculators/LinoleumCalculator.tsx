import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { formatNumber } from './CalculatorUtils';

const LinoleumCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const totalArea = (Number(area) || 0) * 1.05;

  return (
    <>
      <FieldGrid columns={1}><NumberField label="Площадь пола, м²" value={area} onChange={setArea} /></FieldGrid>
      <ResultPaper label="Линолеум с запасом 5%" value={`${formatNumber(totalArea)} м²`} color="#1565c0" />
      <ResetButton onClick={() => setArea('')} disabled={!area} />
    </>
  );
};

export default LinoleumCalculator;