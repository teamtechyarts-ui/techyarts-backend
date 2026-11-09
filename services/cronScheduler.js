const { generateDailyDraft, EDITORIAL_CALENDAR } = require('./blogGenerator');
const { sendDraftAlertEmail } = require('./mailer');

let lastExecution = null;
let lastGeneratedDraft = null;
let timerId = null;

/**
 * Calculate milliseconds until next target execution time
 * Target: 6:00 AM IST on the next weekday (Mon-Fri)
 */
function getMsUntilNextRun(targetHour = 6, targetMinute = 0) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(targetHour, targetMinute, 0, 0);

    // If target has passed today, move to tomorrow
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    // If tomorrow is Saturday (6), advance to Monday (1)
    if (next.getDay() === 6) {
        next.setDate(next.getDate() + 2);
    } else if (next.getDay() === 0) {
        // If Sunday (0), advance to Monday (1)
        next.setDate(next.getDate() + 1);
    }

    return {
        ms: next.getTime() - now.getTime(),
        nextRunDate: next.toISOString()
    };
}

/**
 * Perform draft generation and dispatch email alert
 */
async function runDailyCycle(options = {}) {
    console.log('[Scheduler] Executing scheduled daily blog draft routine with options:', options);
    try {
        const draft = await generateDailyDraft(options);
        lastGeneratedDraft = draft;
        lastExecution = new Date().toISOString();

        // Dispatch Email Alert to Admin
        await sendDraftAlertEmail(draft);

        console.log(`[Scheduler] Daily routine finished successfully. New draft id: ${draft.id}`);
        return { success: true, draft };
    } catch (err) {
        console.error('[Scheduler] Error during daily routine execution:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Initialize automated recurring cycle
 */
function initScheduler(targetHour = 6, targetMinute = 0) {
    if (timerId) clearTimeout(timerId);

    const { ms, nextRunDate } = getMsUntilNextRun(targetHour, targetMinute);
    console.log(`[Scheduler] Blog automation initialized. Next scheduled run at: ${nextRunDate} (in ${Math.round(ms / 1000 / 60)} minutes)`);

    timerId = setTimeout(async function executeAndReschedule() {
        await runDailyCycle();
        const next = getMsUntilNextRun(targetHour, targetMinute);
        console.log(`[Scheduler] Rescheduling next daily run for: ${next.nextRunDate}`);
        timerId = setTimeout(executeAndReschedule, next.ms);
    }, ms);
}

/**
 * Manual trigger for testing or on-demand generation from Admin
 */
async function triggerDraftNow(options = {}) {
    console.log('[Scheduler] Manual draft generation triggered by administrator with options:', options);
    return await runDailyCycle(options);
}

/**
 * Get current scheduler telemetry
 */
function getSchedulerStatus() {
    const { nextRunDate } = getMsUntilNextRun();
    const currentDay = new Date().getDay();
    const todayConfig = EDITORIAL_CALENDAR[currentDay] || EDITORIAL_CALENDAR[1];

    return {
        active: true,
        frequency: 'Weekdays (Monday to Friday) at 6:00 AM IST',
        nextScheduledRun: nextRunDate,
        lastExecution,
        lastGeneratedDraftTitle: lastGeneratedDraft ? lastGeneratedDraft.title : null,
        todaysCategory: todayConfig.category,
        todaysTheme: todayConfig.theme,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5),
        notificationRecipient: process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || 'thetechyarts@gmail.com'
    };
}

module.exports = {
    initScheduler,
    triggerDraftNow,
    getSchedulerStatus
};

