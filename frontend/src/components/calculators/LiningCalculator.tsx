import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { allPositive } from './CalculatorUtils';

const LiningCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [boardArea, setBoardArea] = useState('');
  const pieces = allPositive(Number(area), Number(boardArea))
    ? Math.ceil((Number(area) * 1.1) / Number(boardArea))
    : Number.NaN;

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь доски, м²" value={boardArea} onChange={setBoardArea} />
      </FieldGrid>
      <ResultPaper label="Вагонка/брус с запасом 10%" value={Number.isFinite(pieces) ? `${pieces} шт.` : '—'} color="#8d6e63" background="#fff8e1" borderColor="#ffe082" />
      <ResetButton onClick={() => { setArea(''); setBoardArea(''); }} disabled={!area && !boardArea} />
    </>
  );
};

export default LiningCalculator;