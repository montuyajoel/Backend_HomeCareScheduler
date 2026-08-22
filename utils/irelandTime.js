const TIMEZONE = process.env.APP_TIMEZONE || "Europe/Dublin";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function now() {
    return new Date();
}

// Schedule.date is stored as UTC midnight for the calendar day (e.g. 2026-08-22T00:00:00.000Z).
function getScheduleCalendarDateString(dateInput) {
    if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }

    const d = new Date(dateInput);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getIrelandCalendarDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

function zonedTimeToUtc(dateStr, timeStr, timeZone = TIMEZONE) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const [h, mi, s = 0] = timeStr.split(":").map(Number);
    const pad = (n) => String(n).padStart(2, "0");
    const target = `${pad(d)}/${pad(mo)}/${y}, ${pad(h)}:${pad(mi)}:${pad(s)}`;

    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0);
    for (let offsetMs = -36 * 3600000; offsetMs <= 36 * 3600000; offsetMs += 60000) {
        const candidate = new Date(anchor + offsetMs);
        if (formatter.format(candidate) === target) {
            return candidate;
        }
    }

    throw new Error(`Unable to resolve ${dateStr} ${timeStr} in ${timeZone}`);
}

function applyTimeToDate(date, timeStr) {
    return zonedTimeToUtc(getScheduleCalendarDateString(date), timeStr);
}

function getShiftStartDate(shift) {
    return applyTimeToDate(shift.date, shift.startTime);
}

function getShiftEndDate(shift) {
    const start = getShiftStartDate(shift);
    let end = applyTimeToDate(shift.date, shift.endTime);

    // Shifts like 12:50 -> 01:20 end after midnight on the next calendar day.
    if (end <= start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    return end;
}

function getStartOfDay(date = new Date()) {
    const dateStr = getIrelandCalendarDateString(date);
    return new Date(`${dateStr}T00:00:00.000Z`);
}

function getEndOfDay(date = new Date()) {
    const start = getStartOfDay(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCMilliseconds(-1);
    return end;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function getStartOfTomorrow(date = new Date()) {
    const start = getStartOfDay(date);
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}

function isSameCalendarDay(instant, scheduleDate) {
    return getIrelandCalendarDateString(instant) === getScheduleCalendarDateString(scheduleDate);
}

function getWeekdayName(dateInput) {
    const dateStr = getScheduleCalendarDateString(dateInput);
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    return WEEKDAYS[d.getUTCDay()];
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
