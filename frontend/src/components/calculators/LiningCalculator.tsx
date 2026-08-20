import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const LiningCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [boardArea, setBoardArea] = useState('');
  const pieces = Math.ceil(((Number(area) || 0) * 1.1) / (Number(boardArea) || 1));

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь доски, м²" value={boardArea} onChange={setBoardArea} />
      </FieldGrid>
      <ResultPaper label="Вагонка/брус с запасом 10%" value={`${pieces} шт.`} color="#8d6e63" background="#fff8e1" borderColor="#ffe082" />
      <ResetButton onClick={() => { setArea(''); setBoardArea(''); }} disabled={!area && !boardArea} />
    </>
  );
};

export default LiningCalculator;