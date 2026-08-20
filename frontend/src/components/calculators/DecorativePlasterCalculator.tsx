import React, { useState } from 'react';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const DecorativePlasterCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [consumption, setConsumption] = useState('');
  const weight = (Number(area) || 0) * (Number(consumption) || 0);

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Расход, кг/м²" value={consumption} onChange={setConsumption} />
      </FieldGrid>
      <ResultPaper label="Декоративная штукатурка" value={`${formatNumber(weight)} кг`} color="#795548" background="#efebe9" borderColor="#bcaaa4" />
      <ResetButton onClick={() => { setArea(''); setConsumption(''); }} disabled={!area && !consumption} />
    </>
  );
};

export default DecorativePlasterCalculator;