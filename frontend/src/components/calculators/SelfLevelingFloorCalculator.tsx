import React, { useState } from 'react';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const SelfLevelingFloorCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [thickness, setThickness] = useState('');
  const [consumption, setConsumption] = useState('');
  const weight = (Number(area) || 0) * (Number(thickness) || 0) * (Number(consumption) || 0);

  return (
    <>
      <FieldGrid columns={3}>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Толщина, мм" value={thickness} onChange={setThickness} />
        <NumberField label="Расход, кг/м² на 1 мм" value={consumption} onChange={setConsumption} />
      </FieldGrid>
      <ResultPaper label="Смесь для наливного пола" value={`${formatNumber(weight)} кг`} color="#0277bd" background="#e1f5fe" borderColor="#81d4fa" />
      <ResetButton onClick={() => { setArea(''); setThickness(''); setConsumption(''); }} disabled={!area && !thickness && !consumption} />
    </>
  );
};

export default SelfLevelingFloorCalculator;