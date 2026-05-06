import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modulo } from './entities/modulo.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Módulos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('modulos')
export class ModulosController {
  constructor(
    @InjectRepository(Modulo)
    private readonly repo: Repository<Modulo>,
  ) {}

  @Get()
  listar(): Promise<Modulo[]> {
    return this.repo.find();
  }
}
