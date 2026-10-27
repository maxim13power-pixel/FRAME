import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ObjectsModule } from './objects/objects.module';
import { ProjectsModule } from './projects/projects.module';
import { MaterialsModule } from './materials/materials.module';
import { PriceListModule } from './price-list/price-list.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AccessModule } from './access/access.module';
import { InviteModule } from './invite/invite.module';
import { ChangeModule } from './change/change.module'; // ⭐ P0-6
import { RentalsModule } from './rentals/rentals.module'; // ⭐ Аренда
import { UsersModule } from './users/users.module'; // ⭐ Участники (сводный список)
import { WarehouseModule } from './warehouse/warehouse.module'; // ⭐ Склад
import { ReportsModule } from './reports/reports.module'; // ⭐ Отчёты (сметы/акты)
import { AnalyticsModule } from './analytics/analytics.module'; // ⭐ Срез 3: Аналитика
import { BrigadesModule } from './brigades/brigades.module'; // ⭐ Срез 4: Бригады
import { EstimateTemplatesModule } from './estimate-templates/estimate-templates.module'; // ⭐ №129
import { AuditModule } from './audit/audit.module'; // ⭐ №131
import { EstimateRecalcModule } from './estimate-recalc/estimate-recalc.module'; // ⭐ №170
import { AccessRequestModule } from './access-request/access-request.module'; // ⭐ №178
import { ObjectTemplatesModule } from './object-templates/object-templates.module'; // ⭐ №175
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // явно укажем путь
    }),
    AuthModule,
    ObjectsModule,
    ProjectsModule,
    MaterialsModule,
    PriceListModule,
    DashboardModule,
    AccessModule,
    InviteModule,
    ChangeModule, // ⭐ P0-6
    RentalsModule, // ⭐ Аренда
    UsersModule, // ⭐ Участники (сводный список)
    WarehouseModule, // ⭐ Склад
    ReportsModule, // ⭐ Отчёты (сметы/акты)
    AnalyticsModule, // ⭐ Срез 3: Аналитика
    BrigadesModule, // ⭐ Срез 4: Бригады
    EstimateTemplatesModule, // ⭐ №129: шаблоны смет
    AuditModule, // ⭐ №131: аудит-лог (global)
    EstimateRecalcModule, // ⭐ №170: пересчёт сметы по справочнику
    AccessRequestModule, // ⭐ №178: заявки на право создавать проекты
    ObjectTemplatesModule, // ⭐ №175: шаблоны объектов
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
