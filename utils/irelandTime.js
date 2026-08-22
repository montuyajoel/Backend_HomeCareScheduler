const TIMEZONE = process.env.APP_TIMEZONE || "Europe/Dublin";

// Vercel runs in UTC; set process timezone so local Date methods use Ireland time.
if (!process.env.TZ) {
    process.env.TZ = TIMEZONE;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function now() {
    return new Date();
}

function getStartOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getEndOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getStartOfTomorrow(date = new Date()) {
    return getStartOfDay(addDays(date, 1));
}

function isSameCalendarDay(a, b) {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

function getWeekdayName(dateInput) {
    const d =
        typeof dateInput === "string" && !dateInput.includes("T")
            ? new Date(`${dateInput}T12:00:00`)
            : new Date(dateInput);
    return WEEKDAYS[d.getDay()];
}

function applyTimeToDate(date, timeStr) {
    const [hour, minute, second = 0] = timeStr.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hour, minute, second, 0);
    return d;
}

function getShiftStartDate(shift) {
    return applyTimeToDate(shift.date, shift.startTime);
}

function getShiftEndDate(shift) {
    return applyTimeToDate(shift.date, shift.endTime);
}

function formatDateTime(date) {
    return new Date(date).toLocaleString("en-IE", { timeZone: TIMEZONE });
}

module.exports = {
    TIMEZONE,
    now,
    getStartOfDay,
    getEndOfDay,
    addDays,
    getStartOfTomorrow,
    isSameCalendarDay,
    getWeekdayName,
    applyTimeToDate,
    getShiftStartDate,
    getShiftEndDate,
    formatDateTime,
};
