export const parseSafeDate = (fecha) => {
  if (!fecha) return new Date();
  // If it's a Firestore Timestamp instance
  if (typeof fecha.toDate === 'function') {
    return fecha.toDate();
  }
  // If it's a raw timestamp object { seconds, nanoseconds }
  if (fecha.seconds !== undefined) {
    return new Date(fecha.seconds * 1000);
  }
  // If it's a string or number
  const parsed = new Date(fecha);
  // Guarantee a valid date is returned to prevent format() from throwing Invalid Date
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};
