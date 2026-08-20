import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface RolJwt {
  r: number;
  m: number[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  telefono: string;
  nombre: string;
  apellido: string;
  puesto: string;
  dependencia: string;
  fechaIngreso: string;
  roles: RolJwt[];
  debeCambiarPassword?: boolean;
  tipo: string;
  jti: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const publicKey = config.get<string>('jwt.publicKey');
    const issuer = config.get<string>('jwt.issuer');
    const audience = config.get<string>('jwt.audience');
    if (!publicKey) {
      throw new Error('La clave pública JWT no fue cargada');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      issuer,
      audience,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    if (payload.tipo !== 'access') {
      throw new UnauthorizedException('Tipo de token incorrecto');
    }

    return payload;
  }
}
