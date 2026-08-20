import React, { useState } from 'react';
import { FieldGrid, formatNumber, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const GroutCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [tileWidth, setTileWidth] = useState('');
  const [tileLength, setTileLength] = useState('');
  const [seam, setSeam] = useState('');
  const width = (Number(tileWidth) || 0) / 100;
  const length = (Number(tileLength) || 0) / 100;
  const seamMeters = (Number(seam) || 0) / 1000;
  const grout = (Number(area) || 0) * 2 * ((width + length) / (width * length || 1)) * seamMeters * 0.005 * 1600;

  return (
    <>
      <FieldGrid columns={4}>
        <NumberField label="Площадь, м²" value={area} onChange={setArea} />
        <NumberField label="Ширина плитки, см" value={tileWidth} onChange={setTileWidth} />
        <NumberField label="Длина плитки, см" value={tileLength} onChange={setTileLength} />
        <NumberField label="Шов, мм" value={seam} onChange={setSeam} />
      </FieldGrid>
      <ResultPaper label="Ориентировочный расход затирки" value={`${formatNumber(grout)} кг`} color="#37474f" background="#eceff1" borderColor="#b0bec5">
        <span />
      </ResultPaper>
      <ResetButton onClick={() => { setArea(''); setTileWidth(''); setTileLength(''); setSeam(''); }} disabled={!area && !tileWidth && !tileLength && !seam} />
    </>
  );
};

export default GroutCalculator;