import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { allPositive } from './CalculatorUtils';

const PorcelainTileCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [tileArea, setTileArea] = useState('');
  const pieces = allPositive(Number(area), Number(tileArea))
    ? Math.ceil((Number(area) * 1.1) / Number(tileArea))
    : Number.NaN;

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь плитки, м²" value={tileArea} onChange={setTileArea} />
      </FieldGrid>
      <ResultPaper label="Керамогранит/плитка с запасом 10%" value={Number.isFinite(pieces) ? `${pieces} шт.` : '—'} color="#4527a0" background="#ede7f6" borderColor="#b39ddb" />
      <ResetButton onClick={() => { setArea(''); setTileArea(''); }} disabled={!area && !tileArea} />
    </>
  );
};

export default PorcelainTileCalculator;