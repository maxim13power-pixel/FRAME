import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { allPositive } from './CalculatorUtils';

const MdfPvcPanelCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [panelArea, setPanelArea] = useState('');
  const pieces = allPositive(Number(area), Number(panelArea))
    ? Math.ceil((Number(area) * 1.1) / Number(panelArea))
    : Number.NaN;

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь панели, м²" value={panelArea} onChange={setPanelArea} />
      </FieldGrid>
      <ResultPaper label="МДФ/ПВХ-панели с запасом 10%" value={Number.isFinite(pieces) ? `${pieces} шт.` : '—'} color="#2e7d32" background="#e8f5e9" borderColor="#a5d6a7" />
      <ResetButton onClick={() => { setArea(''); setPanelArea(''); }} disabled={!area && !panelArea} />
    </>
  );
};

export default MdfPvcPanelCalculator;