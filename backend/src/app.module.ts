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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
