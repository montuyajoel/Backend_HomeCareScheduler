const { createTransport } = require("nodemailer");
const { logExternal } = require("../middleware/logger");

const sendEmail = async ({ to, subject, text }) => {
    const startTime = Date.now();

    try {
        const transporter = createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
        const mailOptions = {
            from: `"HomeCare Scheduler" <${process.env.EMAIL_USER}>`,
            to, 
            subject,
            text,   
        };

        const info = await transporter.sendMail(mailOptions);
        const durationMs = Date.now() - startTime;

        logExternal('SMTP', `Sent email to ${to} ("${subject}")`, 200, durationMs);

        return info;
    } catch (error) {
        const durationMs = Date.now() - startTime;

        logExternal('SMTP', `Failed sending email to ${to}: ${error.message}`, 'FAILED', durationMs);

        throw error;
    }
};

module.exports = { sendEmail };