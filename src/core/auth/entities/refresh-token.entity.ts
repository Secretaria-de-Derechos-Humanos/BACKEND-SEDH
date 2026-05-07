import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'refresh_tokens', schema: 'core' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'jti', type: 'varchar', length: 36, unique: true })
  jti!: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expiracion', type: 'timestamptz' })
  expiracion!: Date;

  @Column({ name: 'revocado', type: 'boolean', default: false })
  revocado!: boolean;

  @Column({ name: 'creadoen', type: 'timestamptz', default: () => 'NOW()' })
  creadoEn!: Date;
}
