import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Secure invitation token from email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'Ahmed Abdelfatah' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Min 8 chars, must include uppercase, lowercase, number',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase, one lowercase, and one number',
  })
  password: string;
}
