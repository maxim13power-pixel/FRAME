// backend/src/projects/dto/create-project.dto.ts
//export class CreateProjectDto {
  //name: string;
  //startDate: string;
  //endDate: string;
  //objectId: number;
//}
import { IsString, IsNotEmpty, IsDateString, IsInt } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Название проекта обязательно' })
  name: string;

  @IsDateString({}, { message: 'Дата начала имеет неверный формат' })
  @IsNotEmpty({ message: 'Дата начала обязательна' })
  startDate: string;

  @IsDateString({}, { message: 'Дата окончания имеет неверный формат' })
  @IsNotEmpty({ message: 'Дата окончания обязательна' })
  endDate: string;

  @IsInt({ message: 'objectId должен быть числом' })
  objectId: number;
}