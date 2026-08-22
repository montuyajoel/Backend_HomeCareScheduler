const schedule = require("../models/Schedule");
const LeaveRequest = require("../models/LeaveRequests");
const {
    getStartOfDay,
    getEndOfDay,
    getWeekdayName,
    getScheduleCalendarDateString,
} = require("../utils/irelandTime");

const MIN_SHIFT_GAP_HOURS = 0.5;

const SKILL_EQUIVALENTS = {
    "mobility assistance": ["mobility support"],
    "mobility support": ["mobility assistance"],
};

function caregiverHasSkill(caregiverSkillsLower, need) {
    const needLower = need.toLowerCase();
    if (caregiverSkillsLower.includes(needLower)) return true;
    const equivalents = SKILL_EQUIVALENTS[needLower] || [];
    return equivalents.some((alt) => caregiverSkillsLower.includes(alt));
}

const RULE_LABELS = {
    1: "Client not found",
    2: "Client is not active",
    3: "Caregiver not found or not active",
    4: "Gender preference mismatch",
    5: "Missing required skills",
    6: "Pet allergy conflict",
    7: "Not available at requested time",
    8: "Shift conflict with existing assignment",
    9: "Caregiver has leave during this date",
    10: "Client already has an overlapping shift",
    11: "End time must be after start time",
};

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

function isWithinAvailability(caregiverDoc, weekday, startTime, endTime) {
    const shiftStart = timeToMinutes(startTime);
    const shiftEnd = timeToMinutes(endTime);
    const blocks = caregiverDoc.availability || [];
    return blocks.some((block) => {
        if (block.day !== weekday) return false;
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        return shiftStart >= blockStart && shiftEnd <= blockEnd;
    });
}

function shiftsOverlap(startA, endA, startB, endB) {
    const aStart = timeToMinutes(startA);
    const aEnd = timeToMinutes(endA);
    const bStart = timeToMinutes(startB);
    const bEnd = timeToMinutes(endB);
    return aStart < bEnd && bStart < aEnd;
}

async function checkShiftGap(caregiverId, dateObj, startTime, endTime, excludeScheduleId = null, pendingSlots = []) {
    const dayStart = getStartOfDay(dateObj);
    const dayEnd = getEndOfDay(dateObj);

    const query = {
        caregiver: caregiverId,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: "cancelled" },
    };
    if (excludeScheduleId) {
        query._id = { $ne: excludeScheduleId };
    }

    const existingShifts = await schedule.find(query);
    const allShifts = [
        ...existingShifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        ...pendingSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
    ];

    if (allShifts.length === 0) {
        return { ok: true };
    }

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const gapMinutes = MIN_SHIFT_GAP_HOURS * 60;

    for (const existing of allShifts) {
        const existingStart = timeToMinutes(existing.startTime);
        const existingEnd = timeToMinutes(existing.endTime);

        if (newStart >= existingEnd) {
            if (newStart - existingEnd < gapMinutes) {
                return {
                    ok: false,
                    reason: `only ${((newStart - existingEnd) / 60).toFixed(2)}h gap after existing shift ending ${existing.endTime}`,
                };
            }
        } else if (existingStart >= newEnd) {
            if (existingStart - newEnd < gapMinutes) {
                return {
                    ok: false,
                    reason: `only ${((existingStart - newEnd) / 60).toFixed(2)}h gap before existing shift starting ${existing.startTime}`,
                };
            }
        } else {
            return {
                ok: false,
                reason: `overlaps with existing shift ${existing.startTime}-${existing.endTime}`,
            };
        }
    }

    return { ok: true };
}

async function checkLeaveConflict(employeeCode, dateObj) {
    const dayStart = getStartOfDay(dateObj);
    const dayEnd = getEndOfDay(dateObj);

    const leave = await LeaveRequest.findOne({
        employeeCode,
        status: { $in: ["pending", "approved"] },
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart },
    });

    if (leave) {
        const fmt = (d) => {
            try {
                return getScheduleCalendarDateString(d);
            } catch {
                return "unknown";
            }
        };
        return {
            ok: false,
            reason: `caregiver has ${leave.status} ${leave.leaveType} leave (${fmt(leave.startDate)} to ${fmt(leave.endDate)})`,
        };
    }
    return { ok: true };
}

async function checkClientShiftConflict(clientId, dateObj, startTime, endTime, excludeScheduleId = null, pendingSlots = []) {
    const dayStart = getStartOfDay(dateObj);
    const dayEnd = getEndOfDay(dateObj);

    const query = {
        client: clientId,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: "cancelled" },
    };
    if (excludeScheduleId) {
        query._id = { $ne: excludeScheduleId };
    }

    const existingShifts = await schedule.find(query);
    const allSlots = [
        ...existingShifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        ...pendingSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
    ];

    for (const existing of allSlots) {
        if (shiftsOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
            return {
                ok: false,
                reason: `client already has a shift ${existing.startTime}-${existing.endTime} on this date`,
            };
        }
    }
    return { ok: true };
}

/**
 * Validates a schedule assignment. Returns { valid: true } or { valid: false, rule, message }.
 */
async function validateAssignment({
    clientDoc,
    caregiverDoc,
    date,
    startTime,
    endTime,
    excludeScheduleId = null,
    pendingSlots = [],
}) {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        return {
            valid: false,
            rule: 11,
            message: "End time must be after start time.",
            label: RULE_LABELS[11],
        };
    }

    if (!clientDoc) {
        return { valid: false, rule: 1, message: "Client not found.", label: RULE_LABELS[1] };
    }

    if (clientDoc.status !== "active") {
        return {
            valid: false,
            rule: 2,
            message: `Client ${clientDoc.clientCode} (${clientDoc.fullName}) is not active (current status: "${clientDoc.status}").`,
            label: RULE_LABELS[2],
        };
    }

    if (!caregiverDoc) {
        return { valid: false, rule: 3, message: "Caregiver not found.", label: RULE_LABELS[3] };
    }

    if (caregiverDoc.status !== "active") {
        return {
            valid: false,
            rule: 3,
            message: `Caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) is not active (current status: "${caregiverDoc.status}").`,
            label: RULE_LABELS[3],
        };
    }

    if (
        clientDoc.preferredCaregiverGender !== "No Preference" &&
        clientDoc.preferredCaregiverGender.toLowerCase() !== caregiverDoc.gender.toLowerCase()
    ) {
        return {
            valid: false,
            rule: 4,
            message: `Client ${clientDoc.clientCode} prefers a "${clientDoc.preferredCaregiverGender}" caregiver, but ${caregiverDoc.employeeCode} is "${caregiverDoc.gender}".`,
            label: RULE_LABELS[4],
        };
    }

    const caregiverSkillsLower = (caregiverDoc.skills || []).map((s) => s.toLowerCase());
    const missingSkills = (clientDoc.careNeeds || []).filter(
        (need) => !caregiverHasSkill(caregiverSkillsLower, need)
    );
    if (missingSkills.length > 0) {
        return {
            valid: false,
            rule: 5,
            message: `Caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) does not have the required skill(s): ${missingSkills.join(", ")}.`,
            label: RULE_LABELS[5],
            missingSkills,
        };
    }

    if (clientDoc.hasPets && caregiverDoc.hasPetAllergy) {
        return {
            valid: false,
            rule: 6,
            message: `Client ${clientDoc.clientCode} has pets, but caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) has a pet allergy.`,
            label: RULE_LABELS[6],
        };
    }

    const weekday = getWeekdayName(date);
    if (!isWithinAvailability(caregiverDoc, weekday, startTime, endTime)) {
        return {
            valid: false,
            rule: 7,
            message: `Caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) is not available on ${weekday} for ${startTime}-${endTime}.`,
            label: RULE_LABELS[7],
        };
    }

    const gapCheck = await checkShiftGap(
        caregiverDoc._id,
        date,
        startTime,
        endTime,
        excludeScheduleId,
        pendingSlots
    );
    if (!gapCheck.ok) {
        return {
            valid: false,
            rule: 8,
            message: `Caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) cannot take this shift: ${gapCheck.reason}.`,
            label: RULE_LABELS[8],
        };
    }

    const leaveCheck = await checkLeaveConflict(caregiverDoc.employeeCode, date);
    if (!leaveCheck.ok) {
        return {
            valid: false,
            rule: 9,
            message: `Caregiver ${caregiverDoc.employeeCode} (${caregiverDoc.fullName}) cannot take this shift: ${leaveCheck.reason}.`,
            label: RULE_LABELS[9],
        };
    }

    const clientConflict = await checkClientShiftConflict(
        clientDoc._id,
        date,
        startTime,
        endTime,
        excludeScheduleId,
        pendingSlots
    );
    if (!clientConflict.ok) {
        return {
            valid: false,
            rule: 10,
            message: `Client ${clientDoc.clientCode} (${clientDoc.fullName}) cannot be scheduled: ${clientConflict.reason}.`,
            label: RULE_LABELS[10],
        };
    }

    return { valid: true };
}

/**
 * Evaluate all active caregivers for a slot. Returns eligible and ineligible lists.
 */
async function evaluateCaregiversForSlot({ clientDoc, caregivers, date, startTime, endTime }) {
    const eligible = [];
    const ineligible = [];

    for (const cg of caregivers) {
        const result = await validateAssignment({
            clientDoc,
            caregiverDoc: cg,
            date,
            startTime,
            endTime,
        });

        const entry = {
            employeeCode: cg.employeeCode,
            fullName: cg.fullName,
            gender: cg.gender,
            skills: cg.skills || [],
            status: cg.status,
        };

        if (result.valid) {
            eligible.push(entry);
        } else {
            ineligible.push({
                ...entry,
                rule: result.rule,
                reason: result.message,
                label: result.label,
            });
        }
    }

    return { eligible, ineligible };
}

function normalizeTimeStr(timeStr) {
    if (!timeStr) return timeStr;
    const parts = timeStr.split(":");
    if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
    return timeStr;
}

function normalizeSlot(slot) {
    return {
        date: getScheduleCalendarDateString(slot.date),
        startTime: normalizeTimeStr(slot.startTime),
        endTime: normalizeTimeStr(slot.endTime),
    };
}

function normalizeSlots(slots) {
    return (slots || []).map(normalizeSlot);
}

function slotsOnSameDay(slots, dateObj, excludeIndex = -1) {
    const key = getScheduleCalendarDateString(dateObj);
    return slots
        .map((s, i) => ({ ...s, index: i }))
        .filter((s, i) => i !== excludeIndex && getScheduleCalendarDateString(s.date) === key);
}

/**
 * Reject overlapping or invalid slots within a batch (before DB/caregiver checks).
 */
function validateBatchInternal(slots) {
    if (!slots || slots.length === 0) {
        return { valid: false, message: "At least one schedule slot is required." };
    }

    if (slots.length > 60) {
        return { valid: false, message: "Maximum 60 slots per batch." };
    }

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
            return {
                valid: false,
                message: `Slot ${i + 1} (${slot.date}): end time must be after start time.`,
            };
        }
    }

    for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
            const a = slots[i];
            const b = slots[j];
            if (getScheduleCalendarDateString(a.date) !== getScheduleCalendarDateString(b.date)) {
                continue;
            }
            if (shiftsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                return {
                    valid: false,
                    message: `Overlapping slots on ${getScheduleCalendarDateString(a.date)}: ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime}.`,
                };
            }
            const gapMinutes = MIN_SHIFT_GAP_HOURS * 60;
            const aStart = timeToMinutes(a.startTime);
            const aEnd = timeToMinutes(a.endTime);
            const bStart = timeToMinutes(b.startTime);
            const bEnd = timeToMinutes(b.endTime);
            if (aStart >= bEnd && aStart - bEnd < gapMinutes) {
                return {
                    valid: false,
                    message: `Insufficient gap between slots on ${getScheduleCalendarDateString(a.date)}.`,
                };
            }
            if (bStart >= aEnd && bStart - aEnd < gapMinutes) {
                return {
                    valid: false,
                    message: `Insufficient gap between slots on ${getScheduleCalendarDateString(a.date)}.`,
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Validate caregiver assignment for every slot in a batch.
 */
async function validateAssignmentBatch({ clientDoc, caregiverDoc, slots }) {
    const normalized = normalizeSlots(slots);
    const internal = validateBatchInternal(normalized);
    if (!internal.valid) {
        return internal;
    }

    for (let i = 0; i < normalized.length; i++) {
        const slot = normalized[i];
        const normalizedDate = getStartOfDay(slot.date);
        const pendingOnDay = slotsOnSameDay(normalized, normalizedDate, i);

        const result = await validateAssignment({
            clientDoc,
            caregiverDoc,
            date: normalizedDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            pendingSlots: pendingOnDay,
        });

        if (!result.valid) {
            return {
                valid: false,
                rule: result.rule,
                message: `${getScheduleCalendarDateString(slot.date)} ${slot.startTime}-${slot.endTime}: ${result.message}`,
                slotIndex: i,
                label: result.label,
            };
        }
    }

    return { valid: true, slots: normalized };
}

/**
 * Caregivers eligible for ALL slots in a batch (intersection).
 */
async function evaluateCaregiversForBatch({ clientDoc, caregivers, slots }) {
    const normalized = normalizeSlots(slots);
    const internal = validateBatchInternal(normalized);
    if (!internal.valid) {
        return { eligible: [], ineligible: [], batchError: internal.message };
    }

    const eligible = [];
    const ineligible = [];

    for (const cg of caregivers) {
        const batchResult = await validateAssignmentBatch({
            clientDoc,
            caregiverDoc: cg,
            slots: normalized,
        });

        const entry = {
            employeeCode: cg.employeeCode,
            fullName: cg.fullName,
            gender: cg.gender,
            skills: cg.skills || [],
            status: cg.status,
        };

        if (batchResult.valid) {
            eligible.push(entry);
        } else {
            ineligible.push({
                ...entry,
                rule: batchResult.rule,
                reason: batchResult.message,
                label: batchResult.label,
            });
        }
    }

    return { eligible, ineligible, slots: normalized };
}

module.exports = {
    MIN_SHIFT_GAP_HOURS,
    RULE_LABELS,
    timeToMinutes,
    isWithinAvailability,
    checkShiftGap,
    checkLeaveConflict,
    checkClientShiftConflict,
    validateAssignment,
    evaluateCaregiversForSlot,
    normalizeSlot,
    normalizeSlots,
    validateBatchInternal,
    validateAssignmentBatch,
    evaluateCaregiversForBatch,
};
