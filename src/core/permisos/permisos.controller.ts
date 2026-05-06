import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permiso } from './entities/permiso.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Permisos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('permisos')
export class PermisosController {
  constructor(
    @InjectRepository(Permiso)
    private readonly repo: Repository<Permiso>,
  ) {}

  @Get()
  listar(@Query('modulo') idModulo?: number): Promise<Permiso[]> {
    if (idModulo) {
      return this.repo.find({ where: { idModulo: Number(idModulo) }, relations: ['modulo'] });
    }
    return this.repo.find({ relations: ['modulo'] });
  }
}
