import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { formatNumber } from './CalculatorUtils';

const DecorativeStoneCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const totalArea = (Number(area) || 0) * 1.1;

  return (
    <>
      <FieldGrid columns={1}><NumberField label="Площадь поверхности, м²" value={area} onChange={setArea} /></FieldGrid>
      <ResultPaper label="Камень с запасом 10%" value={`${formatNumber(totalArea)} м²`} color="#455a64" background="#eceff1" borderColor="#b0bec5" />
      <ResetButton onClick={() => setArea('')} disabled={!area} />
    </>
  );
};

export default DecorativeStoneCalculator;