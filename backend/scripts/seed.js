/**
 * Seed script — runs via `npm run seed` (and automatically by prisma migrate dev).
 *
 * Creates:
 *   1. The fixed skill taxonomy (~36 skills, no free-text allowed).
 *   2. ~12 demo users. Their offered/wanted skills are deliberately wired so:
 *      - A clean 3-user cycle exists  (Aarav -> Simran -> Rohan -> Aarav)
 *      - A clean 4-user cycle exists  (Priya -> Neha -> Vikram -> Ananya -> Priya)
 *      - A direct 1-to-1 swap pair exists (Kunal <-> Meera) that now forms a
 *        2-person match
 *      - Some users stay unmatched    (the waiting pool)
 *   3. Priya is flagged `isAdmin` so the admin analytics page can be demoed.
 *
 * All demo users share the password:  password123
 */
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const SKILLS = [
  // Programming & tech
  'Python', 'JavaScript', 'Java', 'C++', 'SQL', 'Web Development', 'React', 'Node.js',
  // Design & creative
  'Graphic Design', 'Photoshop', 'UI/UX Design', 'Figma', 'Video Editing', 'Photography', 'Animation',
  // Arts & hobbies
  'Guitar', 'Piano', 'Singing', 'Drawing & Sketching', 'Dance', 'Cooking', 'Origami',
  // Academic & soft skills
  'Public Speaking', 'Excel', 'PowerPoint', 'Academic Writing', 'English Conversation',
  'Hindi', 'Spanish', 'French', 'German', 'Mathematics Tutoring', 'Physics Tutoring',
  'Chess', 'Fitness & Yoga', 'Meditation', 'Resume Writing',
];

/**
 * Demo users. Each entry:
 *   offered: skills they can teach
 *   wanted:  skills they want to learn
 *
 * 3-way cycle (Aarav -> Simran -> Rohan -> Aarav):
 *   Aarav  wants Photography  <- offered by Simran
 *   Simran wants Guitar       <- offered by Rohan
 *   Rohan  wants Python       <- offered by Aarav
 *
 * 4-way cycle (Priya -> Neha -> Vikram -> Ananya -> Priya):
 *   Priya  wants Spanish        <- offered by Neha
 *   Neha   wants Video Editing  <- offered by Vikram
 *   Vikram wants Public Speaking <- offered by Ananya
 *   Ananya wants Excel          <- offered by Priya
 *
 * Direct swap pair (2-person cycle — found by the engine):
 *   Kunal  offers JavaScript, wants Cooking    (wants what Meera offers)
 *   Meera  offers Cooking,     wants JavaScript (wants what Kunal offers)
 */
const DEMO_USERS = [
  { name: 'Aarav Sharma',  email: 'aarav@demo.com',    department: 'CSE',     offered: ['Python'],              wanted: ['Photography'] },
  { name: 'Simran Kaur',   email: 'simran@demo.com',   department: 'Design',   offered: ['Photography'],        wanted: ['Guitar'] },
  { name: 'Rohan Verma',   email: 'rohan@demo.com',    department: 'Music',    offered: ['Guitar'],             wanted: ['Python'] },

  { name: 'Priya Iyer',    email: 'priya@demo.com',    department: 'Commerce', offered: ['Excel'],              wanted: ['Spanish'], isAdmin: true },
  { name: 'Neha Gupta',    email: 'neha@demo.com',     department: 'Mass Com', offered: ['Spanish'],            wanted: ['Video Editing'] },
  { name: 'Vikram Singh',  email: 'vikram@demo.com',   department: 'CSE',     offered: ['Video Editing'],       wanted: ['Public Speaking'] },
  { name: 'Ananya Das',    email: 'ananya@demo.com',   department: 'MBA',      offered: ['Public Speaking'],     wanted: ['Excel'] },

  // Direct swap pair — forms a valid 2-person cycle match
  { name: 'Kunal Mehta',   email: 'kunal@demo.com',    department: 'CSE',     offered: ['JavaScript'],          wanted: ['Cooking'] },
  { name: 'Meera Nair',    email: 'meera@demo.com',    department: 'Hotel Mgmt', offered: ['Cooking'],          wanted: ['JavaScript'] },

  // Waiting pool — no one offers what they want yet
  { name: 'Ishaan Joshi',  email: 'ishaan@demo.com',   department: 'Physics', offered: ['Physics Tutoring'],    wanted: ['Piano'] },
  { name: 'Sara Khan',     email: 'sara@demo.com',     department: 'English', offered: ['English Conversation'], wanted: ['German'] },
  { name: 'Dev Patel',     email: 'dev@demo.com',      department: 'CSE',     offered: ['React'],               wanted: ['Figma'] },

  // Credit fallback pool (Phase 3):
  //   Vihaan wants Physics Tutoring <- offered by Ishaan (no closing edge -> no cycle)
  //   Riya  offers Piano (Ishaan wants it) but wants German (nobody offers it)
  //   -> both stay unmatched by the engine, but teach-now/redeem sessions work
  { name: 'Vihaan Rao',    email: 'vihaan@demo.com',   department: 'Arch',     offered: ['Drawing & Sketching'], wanted: ['Physics Tutoring'] },
  { name: 'Riya Bose',     email: 'riya@demo.com',     department: 'Fine Arts', offered: ['Piano'],               wanted: ['German'] },
];

async function main() {
  console.log('Seeding skill taxonomy...');
  const skillByName = new Map();
  for (const name of SKILLS) {
    const skill = await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    skillByName.set(name, skill.id);
  }

  console.log(`  ${SKILLS.length} skills ready.`);

  console.log('Seeding demo users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const freshDatabase = (await prisma.user.count()) === 0;

  for (const demo of DEMO_USERS) {
    // Idempotent: wipe the user's skills first, then recreate
    const existing = await prisma.user.findUnique({ where: { email: demo.email } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: demo.name, department: demo.department, passwordHash, isAdmin: !!demo.isAdmin },
        })
      : await prisma.user.create({
          data: {
            name: demo.name,
            email: demo.email,
            passwordHash,
            department: demo.department,
            isAdmin: !!demo.isAdmin,
          },
        });

    await prisma.userOfferedSkill.deleteMany({ where: { userId: user.id } });
    await prisma.userWantedSkill.deleteMany({ where: { userId: user.id } });

    await prisma.userOfferedSkill.createMany({
      data: demo.offered.map((name) => ({
        userId: user.id,
        skillId: skillByName.get(name),
        level: (demo.offeredLevels && demo.offeredLevels[name]) || 'INTERMEDIATE',
      })),
    });
    await prisma.userWantedSkill.createMany({
      data: demo.wanted.map((name) => ({
        userId: user.id,
        skillId: skillByName.get(name),
        level: (demo.wantedLevels && demo.wantedLevels[name]) || 'BEGINNER',
      })),
    });
  }

  console.log(`  ${DEMO_USERS.length} demo users seeded (password: password123).`);

  // Clear old match + feature data so a fresh seed always starts clean.
  // On an existing database this is skipped unless SEED_FRESH=1 is set —
  // otherwise every container restart would wipe user progress.
  if (freshDatabase || process.env.SEED_FRESH === '1') {
    await prisma.matchCycleParticipant.deleteMany();
    await prisma.matchCycle.deleteMany();
    await prisma.blockedEdge.deleteMany();
    await prisma.message.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.rating.deleteMany();
    await prisma.credit.deleteMany();
    await prisma.creditSession.deleteMany();
    await prisma.skillVerification.deleteMany();
    console.log('Cleared previous matches, messages, notifications, ratings, credits and verifications.');
  } else {
    console.log('Database already in use — kept existing matches/progress (set SEED_FRESH=1 to wipe).');
  }
  console.log('Run `npm run dev`, then call POST /api/match/run');
  console.log('to trigger matching and see the 2-way (Kunal <-> Meera), 3-way and 4-way cycles appear.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
