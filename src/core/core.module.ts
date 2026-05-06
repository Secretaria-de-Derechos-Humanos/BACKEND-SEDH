import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesModule } from './roles/roles.module';
import { ModulosModule } from './modulos/modulos.module';
import { PermisosModule } from './permisos/permisos.module';

@Module({
  imports: [AuthModule, UsuariosModule, RolesModule, ModulosModule, PermisosModule],
  exports: [AuthModule, UsuariosModule, RolesModule, ModulosModule, PermisosModule],
})
export class CoreModule {}
