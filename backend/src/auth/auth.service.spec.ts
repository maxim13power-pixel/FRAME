// ⭐ Временно закомментировано — шаблонный тест без реальной логики.
// TypeScript не видит типы Jest (@types/jest не настроен в tsconfig.json).
// Когда дойдём до e2e-тестов — настроим Jest и вернём сюда реальные тесты.
//
// import { Test, TestingModule } from '@nestjs/testing';
// import { AuthService } from './auth.service';
//
// describe('AuthService', () => {
//   let service: AuthService;
//
//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [AuthService],
//     }).compile();
//
//     service = module.get<AuthService>(AuthService);
//   });
//
//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });
// });