/**
 * Reset script: wipes all tables and re-creates only the Platform Owner.
 * Run: npx ts-node -P tsconfig.json --skip-project prisma/seeds/reset-and-seed-owner.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing all tables...');

  // Delete in dependency order (children before parents) to avoid FK violations
  await prisma.activityLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.meetingParticipant.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.messageAttachment.deleteMany({});
  await prisma.taskAttachment.deleteMany({});
  await prisma.taskLabel.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.taskAssignee.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectTeam.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.file.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ All tables cleared.');

  // Re-create the Platform Owner
  console.log('🌱 Creating Platform Owner...');

  const passwordHash = await bcrypt.hash('SyncUp#Ahmed2026!Secured', 10);

  const owner = await prisma.user.create({
    data: {
      email: 'aabdelfatah732@gmail.com',
      fullName: 'Ahmed Abdelfatah',
      passwordHash,
      isPlatformOwner: true,
      jobTitle: 'Founder & Platform Owner',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Platform Owner created: ${owner.email} (id: ${owner.id})`);
  console.log('🎉 Done! Database is clean with only the Platform Owner.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
