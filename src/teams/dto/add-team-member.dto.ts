import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTeamMemberDto {
  @ApiProperty({ description: 'Organization member ID or user ID' })
  @IsString()
  @IsNotEmpty()
  memberId: string;
}
