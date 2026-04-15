/**
 * Overall class rank per term: students ranked by mean subject percentage in that term.
 * Uses competition ranking (ties share rank; next rank skips).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<Record<string, { position: number; outOf: number }>>}
 */
async function computeClassPositionByTerm(prisma, studentId, classId, termIds) {
  if (!classId || !termIds.length) return {};
  const rows = await prisma.result.findMany({
    where: { termId: { in: termIds }, student: { classId } },
    select: { studentId: true, totalScore: true, termId: true },
  });

  const byTerm = {};
  for (const tid of termIds) {
    byTerm[tid] = {};
  }
  for (const r of rows) {
    if (r.totalScore === null || r.totalScore === undefined) continue;
    if (!byTerm[r.termId]) byTerm[r.termId] = {};
    const bucket = byTerm[r.termId];
    if (!bucket[r.studentId]) bucket[r.studentId] = { sum: 0, n: 0 };
    bucket[r.studentId].sum += r.totalScore;
    bucket[r.studentId].n += 1;
  }

  const out = {};
  for (const tid of termIds) {
    const agg = byTerm[tid] || {};
    const list = Object.entries(agg).map(([sid, { sum, n }]) => ({
      studentId: sid,
      avg: sum / n,
    }));
    if (list.length === 0) continue;
    list.sort((a, b) => b.avg - a.avg || a.studentId.localeCompare(b.studentId));
    let pos = 1;
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i].avg < list[i - 1].avg) pos = i + 1;
      if (list[i].studentId === studentId) {
        out[tid] = { position: pos, outOf: list.length };
        break;
      }
    }
  }
  return out;
}

module.exports = { computeClassPositionByTerm };
