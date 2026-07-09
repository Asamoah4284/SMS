/**
 * Resolve required books for a student in a term (class-wide + individual assignments).
 */
async function getStudentBookLines(prisma, studentDbId, termId) {
  const student = await prisma.student.findUnique({
    where: { id: studentDbId },
    select: { id: true, classId: true },
  });
  if (!student) return { books: [], totalDue: 0, totalPaid: 0, balance: 0 };

  const assignments = await prisma.bookAssignment.findMany({
    where: {
      termId,
      isRequired: true,
      OR: [
        { studentId: studentDbId },
        ...(student.classId ? [{ classId: student.classId, studentId: null }] : []),
      ],
      book: { isActive: true },
    },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          description: true,
          priceGhs: true,
          coverUrl: true,
        },
      },
    },
  });

  const byBookId = new Map();
  for (const a of assignments) {
    if (!byBookId.has(a.bookId)) byBookId.set(a.bookId, a.book);
  }

  const payments = await prisma.bookPayment.findMany({
    where: {
      studentId: studentDbId,
      termId,
      paymentStatus: 'FULLY_PAID',
    },
  });
  const paidByBook = new Map(payments.map((p) => [p.bookId, p]));

  let totalDue = 0;
  let totalPaid = 0;
  const books = [];

  for (const [bookId, book] of byBookId) {
    const price = book.priceGhs;
    const payment = paidByBook.get(bookId);
    const paid = payment ? payment.amountPaid : 0;
    const remaining = Math.max(0, price - paid);
    totalDue += price;
    totalPaid += paid;
    books.push({
      bookId,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      description: book.description,
      priceGhs: price,
      coverUrl: book.coverUrl,
      paid,
      remaining,
      isPaid: remaining <= 0.004,
      paidAt: payment?.paidAt ?? null,
      paymentMethod: payment?.paymentMethod ?? null,
    });
  }

  books.sort((a, b) => a.title.localeCompare(b.title));

  return {
    books,
    totalDue,
    totalPaid,
    balance: Math.max(0, totalDue - totalPaid),
  };
}

module.exports = { getStudentBookLines };
