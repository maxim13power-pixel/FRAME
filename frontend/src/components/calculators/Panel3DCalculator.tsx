import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const Panel3DCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [panelArea, setPanelArea] = useState('');
  const pieces = Math.ceil((Number(area) || 0) / (Number(panelArea) || 1));

  return (
    <>
      <FieldGrid>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Площадь панели, м²" value={panelArea} onChange={setPanelArea} />
      </FieldGrid>
      <ResultPaper label="Количество 3D-панелей" value={`${pieces} шт.`} color="#006064" background="#e0f7fa" borderColor="#80deea" />
      <ResetButton onClick={() => { setArea(''); setPanelArea(''); }} disabled={!area && !panelArea} />
    </>
  );
};

export default Panel3DCalculator;