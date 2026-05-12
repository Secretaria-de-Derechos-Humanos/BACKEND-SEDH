import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Usuario[]> {
    return this.repo.find();
  }

  async findById(idUsuario: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { emailInstitucional: email } });
  }

  async crear(dto: CrearUsuarioDto): Promise<Usuario> {
    const existe = await this.repo.findOne({ where: { emailInstitucional: dto.emailInstitucional } });
    if (existe) throw new ConflictException('El correo institucional ya está registrado');

    const hash = await bcrypt.hash(dto.contrasena, 12);
    const usuario = this.repo.create({
      emailInstitucional: dto.emailInstitucional,
      contrasena: hash,
      creadoPor: dto.creadoPor ?? null,
    });
    return this.repo.save(usuario);
  }

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    const usuario = await this.findById(idUsuario);
    if (dto.activo !== undefined) usuario.activo = dto.activo;
    if (dto.actualizadoPor) {
      usuario.actualizadoPor = dto.actualizadoPor;
      usuario.actualizadoEn = new Date();
    }
    return this.repo.save(usuario);
  }

  async actualizarUltimoAcceso(idUsuario: string): Promise<void> {
    await this.repo.update({ idUsuario }, { ultimoAcceso: new Date() });
  }

  async obtenerHeatmapActividades(email: string): Promise<unknown> {
    const result = await this.dataSource.query(
      `SELECT core.obtener_heatmap_actividades_usuario($1)`,
      [email],
    );
    return result[0]['obtener_heatmap_actividades_usuario'];
  }
}
