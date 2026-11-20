import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';
import { allPositive, formatNumber } from './CalculatorUtils';

const GroutCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [tileWidth, setTileWidth] = useState('');
  const [tileLength, setTileLength] = useState('');
  const [seam, setSeam] = useState('');
  const width = (Number(tileWidth) || 0) / 100;
  const length = (Number(tileLength) || 0) / 100;
  const seamMeters = (Number(seam) || 0) / 1000;
  // ⭐ №366: (W+L)/(W×L) уже даёт длину шва на 1 м² в двух направлениях —
  // лишний множитель 2 завышал расход ровно вдвое. Плюс не считаем без размеров.
  const grout = allPositive(Number(area), width, length, seamMeters)
    ? (Number(area) * ((width + length) / (width * length)) * seamMeters * 0.005 * 1600)
    : Number.NaN;

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