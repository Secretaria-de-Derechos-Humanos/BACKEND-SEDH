import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find();
  }

  async findByModule(module: string): Promise<Permission[]> {
    return this.permissionRepo.find({ where: { module } });
  }

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const exists = await this.permissionRepo.findOne({
      where: { module: dto.module, subModule: dto.subModule ?? null, action: dto.action },
    });
    if (exists) throw new ConflictException('El permiso ya existe');

    const permission = this.permissionRepo.create(dto);
    return this.permissionRepo.save(permission);
  }

  async remove(id: string): Promise<void> {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
    await this.permissionRepo.softRemove(permission);
  }
}
