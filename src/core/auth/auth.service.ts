import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuariosService.findByEmail(dto.emailInstitucional);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordValida = await bcrypt.compare(dto.contrasena, usuario.contrasena);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    await this.usuariosService.actualizarUltimoAcceso(usuario.idUsuario);

    const payload = { sub: usuario.idUsuario, email: usuario.emailInstitucional };
    const accessToken = this.jwtService.sign(payload, {
      algorithm: 'RS256',
      expiresIn: this.config.get<string>('jwt.accessExpiration', '15m'),
    });

    return { accessToken };
  }
}
