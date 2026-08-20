import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const MdfPvcPanelCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [panelArea, setPanelArea] = useState('');
  const pieces = Math.ceil(((Number(area) || 0) * 1.1) / (Number(panelArea) || 1));

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь панели, м²" value={panelArea} onChange={setPanelArea} />
      </FieldGrid>
      <ResultPaper label="МДФ/ПВХ-панели с запасом 10%" value={`${pieces} шт.`} color="#2e7d32" background="#e8f5e9" borderColor="#a5d6a7" />
      <ResetButton onClick={() => { setArea(''); setPanelArea(''); }} disabled={!area && !panelArea} />
    </>
  );
};

export default MdfPvcPanelCalculator;