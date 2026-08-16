import { IsNumber, Min } from 'class-validator';

export class UpdateSpecQtyDto {
  @IsNumber({}, { message: 'Кол-во по спецификации должно быть числом' })
  @Min(0, { message: 'Кол-во не может быть отрицательным' })
  specQuantity!: number;
}