import React, { useState } from 'react';
import { FieldGrid, NumberField, ResetButton, ResultPaper } from './CalculatorCommon';

const FoamBlockCalculator: React.FC = () => {
  const [wallLength, setWallLength] = useState('');
  const [wallHeight, setWallHeight] = useState('');
  const [wallThickness, setWallThickness] = useState('');
  const [blockLength, setBlockLength] = useState('');
  const [blockHeight, setBlockHeight] = useState('');
  const [blockThickness, setBlockThickness] = useState('');
  const wallVolume = (Number(wallLength) || 0) * (Number(wallHeight) || 0) * (Number(wallThickness) || 0);
  const blockVolume = (Number(blockLength) || 0) * (Number(blockHeight) || 0) * (Number(blockThickness) || 0);
  const blocks = Math.ceil(wallVolume / (blockVolume || 1));

  const reset = () => {
    setWallLength('');
    setWallHeight('');
    setWallThickness('');
    setBlockLength('');
    setBlockHeight('');
    setBlockThickness('');
  };

  return (
    <>
      <FieldGrid columns={3}>
        <NumberField label="Длина стены, м" value={wallLength} onChange={setWallLength} />
        <NumberField label="Высота стены, м" value={wallHeight} onChange={setWallHeight} />
        <NumberField label="Толщина стены, м" value={wallThickness} onChange={setWallThickness} />
      </FieldGrid>
      <FieldGrid columns={3}>
        <NumberField label="Длина блока, м" value={blockLength} onChange={setBlockLength} />
        <NumberField label="Высота блока, м" value={blockHeight} onChange={setBlockHeight} />
        <NumberField label="Толщина блока, м" value={blockThickness} onChange={setBlockThickness} />
      </FieldGrid>
      <ResultPaper label="Пеноблоки" value={`${blocks} шт.`} color="#5d4037" background="#efebe9" borderColor="#bcaaa4" />
      <ResetButton onClick={reset} disabled={!wallLength && !wallHeight && !wallThickness && !blockLength && !blockHeight && !blockThickness} />
    </>
  );
};

export default FoamBlockCalculator;