import React, { useState } from 'react';
import { Typography } from '@mui/material';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { formatNumber } from './CalculatorUtils';

const DrywallCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const squareMeters = Number(area) || 0;
  const sheets = Math.ceil(squareMeters / 3);
  const profile = Math.ceil(squareMeters * 0.8);
  const screws = Math.ceil(squareMeters * 20);

  const reset = () => setArea('');

  return (
    <>
      <FieldGrid columns={1}><NumberField label="Площадь, м²" value={area} onChange={setArea} /></FieldGrid>
      <ResultPaper label="Материалы для ГКЛ" value={`${sheets} листов`} color="#1565c0">
        <Typography variant="body2" sx={{ mt: 1 }}>Профиль: <strong>{formatNumber(profile)} м</strong></Typography>
        <Typography variant="body2">Саморезы: <strong>{screws} шт.</strong></Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Расчёт: лист 3 м², профиль 0,8 м/м², 20 саморезов/м²
        </Typography>
      </ResultPaper>
      <ResetButton onClick={reset} disabled={!area} />
    </>
  );
};

export default DrywallCalculator;