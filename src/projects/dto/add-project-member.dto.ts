import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddProjectMemberDto {
  @ApiProperty({ description: 'Organization Member ID or User ID to add to the project' })
  @IsString()
  @IsNotEmpty()
  memberId: string;
}
