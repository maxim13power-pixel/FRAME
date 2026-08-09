// backend/src/objects/dto/create-object.dto.ts
export class CreateObjectDto {
  name: string;
  address: string;
  startDate: string;   // формат ISO (например, "2026-03-01")
  endDate: string;
}