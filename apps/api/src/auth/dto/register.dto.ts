import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'nickname: only letters, digits, and underscore',
  })
  nickname!: string;

  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'tag: exactly 4 digits',
  })
  tag!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
