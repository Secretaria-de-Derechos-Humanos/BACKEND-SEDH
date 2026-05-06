import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [AuthModule, UsersModule, RolesModule, PermissionsModule],
  exports: [AuthModule, UsersModule, RolesModule, PermissionsModule],
})
export class CoreModule {}
