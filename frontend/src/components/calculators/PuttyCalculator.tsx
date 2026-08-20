import React, { useState } from 'react';
import { Typography } from '@mui/material';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const PuttyCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [startConsumption, setStartConsumption] = useState('');
  const [finishConsumption, setFinishConsumption] = useState('');
  const squareMeters = Number(area) || 0;
  const start = squareMeters * (Number(startConsumption) || 0);
  const finish = squareMeters * (Number(finishConsumption) || 0);

  const reset = () => {
    setArea('');
    setStartConsumption('');
    setFinishConsumption('');
  };

  return (
    <>
      <FieldGrid columns={3}>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Старт, кг/м²" value={startConsumption} onChange={setStartConsumption} />
        <NumberField label="Финиш, кг/м²" value={finishConsumption} onChange={setFinishConsumption} />
      </FieldGrid>
      <ResultPaper label="Шпатлёвка" value={`${formatNumber(start + finish)} кг`} color="#6a1b9a" background="#f3e5f5" borderColor="#ce93d8">
        <Typography variant="body2" sx={{ mt: 1 }}>Стартовая: <strong>{formatNumber(start)} кг</strong></Typography>
        <Typography variant="body2">Финишная: <strong>{formatNumber(finish)} кг</strong></Typography>
      </ResultPaper>
      <ResetButton onClick={reset} disabled={!area && !startConsumption && !finishConsumption} />
    </>
  );
};

export default PuttyCalculator;