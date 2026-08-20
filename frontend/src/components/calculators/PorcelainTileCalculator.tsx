import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const PorcelainTileCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [tileArea, setTileArea] = useState('');
  const pieces = Math.ceil(((Number(area) || 0) * 1.1) / (Number(tileArea) || 1));

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь плитки, м²" value={tileArea} onChange={setTileArea} />
      </FieldGrid>
      <ResultPaper label="Керамогранит/плитка с запасом 10%" value={`${pieces} шт.`} color="#4527a0" background="#ede7f6" borderColor="#b39ddb" />
      <ResetButton onClick={() => { setArea(''); setTileArea(''); }} disabled={!area && !tileArea} />
    </>
  );
};

export default PorcelainTileCalculator;