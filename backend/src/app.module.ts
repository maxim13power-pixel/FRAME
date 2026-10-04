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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
