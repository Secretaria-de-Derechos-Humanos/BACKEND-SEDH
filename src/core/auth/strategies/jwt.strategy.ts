import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface RolJwt {
  r: number;   // idrol
  m: number[]; // ids de módulos
}

export interface JwtPayload {
  sub: string;           // uuid del usuario
  email: string;
  telefono: string;
  nombre: string;
  apellido: string;
  puesto: string;
  dependencia: string;
  fechaIngreso: string;
  roles: RolJwt[];
  tipo: string;
  jti: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.publicKey'),
      algorithms: ['RS256'],
      issuer: config.get<string>('jwt.issuer'),
      audience: config.get<string>('jwt.audience'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.tipo !== 'access') {
      throw new UnauthorizedException('Tipo de token incorrecto');
    }
    return payload;
  }
}
